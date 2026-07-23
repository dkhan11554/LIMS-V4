import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import {
  Truck,
  Plus,
  Search,
  Edit,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  PackageCheck,
  Clock,
  Users,
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  Award,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel";

// --- Types ---

type SupplierCategory = "chemical" | "equipment" | "consumable" | "reference_material" | "service" | "other";
type QualificationStatus = "pending" | "qualified" | "conditional" | "disqualified" | "under_review";

type Supplier = {
  _id: Id<"suppliers">;
  _creationTime: number;
  supplierCode: string;
  name: string;
  category: SupplierCategory;
  qualificationStatus: QualificationStatus;
  country?: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  contactName?: string;
  certifications?: string[];
  qualificationDate?: string;
  requalificationDate?: string;
  qualificationNotes?: string;
  performanceScore?: number;
  isActive: boolean;
};

type FormData = {
  name: string;
  category: SupplierCategory;
  country: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  contactName: string;
  certifications: string[];
  qualificationStatus: QualificationStatus;
  qualificationDate: string;
  requalificationDate: string;
  performanceScore: number;
  qualificationNotes: string;
};

// --- Constants ---

const QUALIFICATION_STATUS_CONFIG: Record<QualificationStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  qualified: { label: "Qualified", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  conditional: { label: "Conditional", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  disqualified: { label: "Disqualified", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  under_review: { label: "Under Review", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const CATEGORY_CONFIG: Record<SupplierCategory, { label: string; className: string }> = {
  chemical: { label: "Chemical", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  equipment: { label: "Equipment", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  consumable: { label: "Consumable", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  reference_material: { label: "Reference Material", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  service: { label: "Service", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
};

const EMPTY_FORM: FormData = {
  name: "",
  category: "chemical",
  country: "",
  address: "",
  website: "",
  phone: "",
  email: "",
  contactName: "",
  certifications: [],
  qualificationStatus: "pending",
  qualificationDate: "",
  requalificationDate: "",
  performanceScore: 50,
  qualificationNotes: "",
};

// --- Helpers ---

function QualStatusBadge({ status }: { status: QualificationStatus }) {
  const config = QUALIFICATION_STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: SupplierCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}

function isRequalDueSoon(requalDate: string | undefined): boolean {
  if (!requalDate) return false;
  const diff = new Date(requalDate).getTime() - Date.now();
  return diff <= 90 * 24 * 60 * 60 * 1000;
}

function isRequalOverdue(requalDate: string | undefined): boolean {
  if (!requalDate) return false;
  return new Date(requalDate).getTime() < Date.now();
}

function formatDate(date: string | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

function PerformanceBar({ score }: { score: number | undefined }) {
  const value = score ?? 0;
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{value}</span>
    </div>
  );
}

// --- Main Inner Component ---

function SupplierManagementInner() {
  const { labId } = useActiveLab();
  const suppliers = useQuery(api.suppliers.listSuppliers, labId ? { laboratoryId: labId } : "skip");
  const createSupplier = useMutation(api.suppliers.createSupplier);
  const updateSupplier = useMutation(api.suppliers.updateSupplier);
  const deleteSupplier = useMutation(api.suppliers.deleteSupplier);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"suppliers"> | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [certInput, setCertInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Derived data
  const activeSuppliers = useMemo(() => suppliers?.filter((s) => s.isActive) ?? [], [suppliers]);

  const stats = useMemo(() => {
    const total = activeSuppliers.length;
    const qualified = activeSuppliers.filter((s) => s.qualificationStatus === "qualified").length;
    const pending = activeSuppliers.filter((s) => s.qualificationStatus === "pending").length;
    const requalDue = activeSuppliers.filter((s) => isRequalDueSoon(s.requalificationDate)).length;
    return { total, qualified, pending, requalDue };
  }, [activeSuppliers]);

  const filteredSuppliers = useMemo(() => {
    return activeSuppliers.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
        (s.contactName?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || s.qualificationStatus === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [activeSuppliers, search, categoryFilter, statusFilter]);

  const approvedSuppliers = useMemo(
    () => activeSuppliers.filter((s) => s.qualificationStatus === "qualified" || s.qualificationStatus === "conditional"),
    [activeSuppliers]
  );

  const requalAlerts = useMemo(
    () => activeSuppliers.filter((s) => isRequalDueSoon(s.requalificationDate)),
    [activeSuppliers]
  );

  // Form handlers
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCertInput("");
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier._id);
    setForm({
      name: supplier.name,
      category: supplier.category,
      country: supplier.country ?? "",
      address: supplier.address ?? "",
      website: supplier.website ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      contactName: supplier.contactName ?? "",
      certifications: supplier.certifications ?? [],
      qualificationStatus: supplier.qualificationStatus,
      qualificationDate: supplier.qualificationDate ?? "",
      requalificationDate: supplier.requalificationDate ?? "",
      performanceScore: supplier.performanceScore ?? 50,
      qualificationNotes: supplier.qualificationNotes ?? "",
    });
    setCertInput("");
    setDialogOpen(true);
  };

  const addCertification = () => {
    const trimmed = certInput.trim();
    if (trimmed && !form.certifications.includes(trimmed)) {
      setForm((prev) => ({ ...prev, certifications: [...prev.certifications, trimmed] }));
      setCertInput("");
    }
  };

  const removeCertification = (cert: string) => {
    setForm((prev) => ({ ...prev, certifications: prev.certifications.filter((c) => c !== cert) }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (!labId) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateSupplier({
          supplierId: editingId,
          name: form.name,
          category: form.category,
          country: form.country || undefined,
          address: form.address || undefined,
          website: form.website || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          contactName: form.contactName || undefined,
          certifications: form.certifications.length > 0 ? form.certifications : undefined,
          qualificationStatus: form.qualificationStatus,
          qualificationDate: form.qualificationDate || undefined,
          requalificationDate: form.requalificationDate || undefined,
          performanceScore: form.performanceScore,
          qualificationNotes: form.qualificationNotes || undefined,
        });
        toast.success("Supplier updated successfully");
      } else {
        await createSupplier({
          laboratoryId: labId,
          name: form.name,
          category: form.category,
          country: form.country || undefined,
          address: form.address || undefined,
          website: form.website || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          contactName: form.contactName || undefined,
          certifications: form.certifications.length > 0 ? form.certifications : undefined,
          qualificationNotes: form.qualificationNotes || undefined,
        });
        toast.success("Supplier created successfully");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(editingId ? "Failed to update supplier" : "Failed to create supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQualify = async (supplierId: Id<"suppliers">) => {
    try {
      await updateSupplier({
        supplierId,
        qualificationStatus: "qualified",
        qualificationDate: new Date().toISOString(),
      });
      toast.success("Supplier qualified");
    } catch {
      toast.error("Failed to qualify supplier");
    }
  };

  const handleDisqualify = async (supplierId: Id<"suppliers">) => {
    try {
      await updateSupplier({ supplierId, qualificationStatus: "disqualified" });
      toast.success("Supplier disqualified");
    } catch {
      toast.error("Failed to disqualify supplier");
    }
  };

  // Loading state
  if (!suppliers) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supplier Management</h1>
            <p className="text-sm text-muted-foreground">Approved Supplier List & Qualification Management</p>
          </div>
        </div>
        <Button onClick={openCreate} className="cursor-pointer">
          <Plus className="w-4 h-4 mr-2" />
          New Supplier
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Suppliers</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30">
                <PackageCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Qualified</p>
                <p className="text-2xl font-bold">{stats.qualified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Qualification</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requalification Due</p>
                <p className="text-2xl font-bold">{stats.requalDue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" className="cursor-pointer">All Suppliers</TabsTrigger>
          <TabsTrigger value="approved" className="cursor-pointer">Approved List</TabsTrigger>
          <TabsTrigger value="requalification" className="cursor-pointer">Requalification Alerts</TabsTrigger>
        </TabsList>

        {/* All Suppliers Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44 cursor-pointer">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="chemical">Chemical</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="consumable">Consumable</SelectItem>
                <SelectItem value="reference_material">Reference Material</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 cursor-pointer">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="conditional">Conditional</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredSuppliers.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Truck /></EmptyMedia>
                <EmptyTitle>No suppliers found</EmptyTitle>
                <EmptyDescription>
                  {activeSuppliers.length === 0
                    ? "Get started by adding your first supplier."
                    : "Try adjusting your filters or search criteria."}
                </EmptyDescription>
              </EmptyHeader>
              {activeSuppliers.length === 0 && (
                <EmptyContent>
                  <Button size="sm" onClick={openCreate} className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-1" /> Add Supplier
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Qual Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier._id}>
                      <TableCell className="font-mono text-xs">{supplier.supplierCode}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{supplier.name}</TableCell>
                      <TableCell><CategoryBadge category={supplier.category} /></TableCell>
                      <TableCell><QualStatusBadge status={supplier.qualificationStatus} /></TableCell>
                      <TableCell className="text-muted-foreground">{supplier.country || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {supplier.contactName || supplier.email || "—"}
                      </TableCell>
                      <TableCell className="w-28">
                        <PerformanceBar score={supplier.performanceScore} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(supplier.qualificationDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(supplier)}
                            className="cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {supplier.qualificationStatus !== "qualified" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQualify(supplier._id)}
                              className="cursor-pointer text-green-600 hover:text-green-700"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisqualify(supplier._id)}
                              className="cursor-pointer text-red-600 hover:text-red-700"
                            >
                              <ShieldX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Approved List Tab */}
        <TabsContent value="approved" className="space-y-4">
          {approvedSuppliers.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><PackageCheck /></EmptyMedia>
                <EmptyTitle>No approved suppliers</EmptyTitle>
                <EmptyDescription>
                  Qualify suppliers to see them appear in the approved supplier list.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {approvedSuppliers.map((supplier) => (
                <Card key={supplier._id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{supplier.name}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{supplier.supplierCode}</p>
                      </div>
                      <QualStatusBadge status={supplier.qualificationStatus} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={supplier.category} />
                    </div>

                    {/* Contact info */}
                    <div className="space-y-1.5 text-sm">
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Certifications */}
                    {supplier.certifications && supplier.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {supplier.certifications.map((cert) => (
                          <Badge key={cert} variant="secondary" className="text-[10px]">
                            <Award className="w-3 h-3 mr-0.5" />
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <div>
                        <p className="font-medium text-foreground">Qualified</p>
                        <p>{formatDate(supplier.qualificationDate)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Requalification</p>
                        <p className={cn(isRequalOverdue(supplier.requalificationDate) && "text-red-600 dark:text-red-400 font-medium")}>
                          {formatDate(supplier.requalificationDate)}
                        </p>
                      </div>
                    </div>

                    {/* Performance */}
                    <div className="pt-1">
                      <p className="text-xs font-medium mb-1">Performance Score</p>
                      <PerformanceBar score={supplier.performanceScore} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requalification Alerts Tab */}
        <TabsContent value="requalification" className="space-y-4">
          {requalAlerts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
                <EmptyTitle>No requalification alerts</EmptyTitle>
                <EmptyDescription>
                  All suppliers are up to date with their qualification requirements.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {requalAlerts.map((supplier) => {
                const overdue = isRequalOverdue(supplier.requalificationDate);
                return (
                  <Card
                    key={supplier._id}
                    className={cn(
                      "border-l-4",
                      overdue ? "border-l-red-500" : "border-l-amber-500"
                    )}
                  >
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-lg",
                            overdue
                              ? "bg-red-100 dark:bg-red-900/30"
                              : "bg-amber-100 dark:bg-amber-900/30"
                          )}>
                            <AlertTriangle className={cn(
                              "w-4.5 h-4.5",
                              overdue
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{supplier.name}</p>
                              <span className="text-xs font-mono text-muted-foreground">{supplier.supplierCode}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <CategoryBadge category={supplier.category} />
                              <span className={cn(
                                "text-xs font-medium",
                                overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                              )}>
                                {overdue ? "Overdue" : "Due soon"} — {formatDate(supplier.requalificationDate)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(supplier)}
                            className="cursor-pointer"
                          >
                            <Edit className="w-4 h-4 mr-1" /> Review
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQualify(supplier._id)}
                            className="cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4 mr-1" /> Requalify
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Supplier" : "New Supplier"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update supplier details and qualification information." : "Add a new supplier to the approved supplier list."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Supplier name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as SupplierCategory }))}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chemical">Chemical</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="reference_material">Reference Material</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="e.g. United States"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@supplier.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* Contact Name */}
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                placeholder="John Smith"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>

            {/* Certifications */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Certifications</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. ISO 9001"
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCertification();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addCertification} className="cursor-pointer shrink-0">
                  Add
                </Button>
              </div>
              {form.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.certifications.map((cert) => (
                    <Badge key={cert} variant="secondary" className="gap-1">
                      {cert}
                      <button
                        type="button"
                        onClick={() => removeCertification(cert)}
                        className="ml-0.5 hover:text-destructive cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Qualification Status (edit only) */}
            {editingId && (
              <div className="space-y-1.5">
                <Label>Qualification Status</Label>
                <Select
                  value={form.qualificationStatus}
                  onValueChange={(v) => setForm((f) => ({ ...f, qualificationStatus: v as QualificationStatus }))}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                    <SelectItem value="disqualified">Disqualified</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Qualification Date (edit only) */}
            {editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="qualDate">Qualification Date</Label>
                <Input
                  id="qualDate"
                  type="date"
                  value={form.qualificationDate ? form.qualificationDate.split("T")[0] : ""}
                  onChange={(e) => setForm((f) => ({ ...f, qualificationDate: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                />
              </div>
            )}

            {/* Requalification Date (edit only) */}
            {editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="requalDate">Requalification Date</Label>
                <Input
                  id="requalDate"
                  type="date"
                  value={form.requalificationDate ? form.requalificationDate.split("T")[0] : ""}
                  onChange={(e) => setForm((f) => ({ ...f, requalificationDate: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                />
              </div>
            )}

            {/* Performance Score (edit only) */}
            {editingId && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Performance Score: {form.performanceScore}</Label>
                <Slider
                  value={[form.performanceScore]}
                  onValueChange={(v) => setForm((f) => ({ ...f, performanceScore: v[0] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional qualification notes..."
                value={form.qualificationNotes}
                onChange={(e) => setForm((f) => ({ ...f, qualificationNotes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Saving..." : editingId ? "Update Supplier" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager"]}>
      <SupplierManagementInner />
    </PageGuard>
  );
}
