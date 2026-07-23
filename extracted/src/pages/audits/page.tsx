import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet.tsx";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription as EmptyDesc, EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  ClipboardCheck, Plus, Eye, Pencil, CalendarDays, User, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Type helpers ──────────────────────────────────────────
type AuditType = "internal" | "external" | "regulatory" | "supplier" | "customer";
type AuditStatus = "planned" | "in_progress" | "report_pending" | "closed";
type FindingType = "major" | "minor" | "observation" | "opportunity";
type FindingStatus = "open" | "in_progress" | "closed";

// ─── Badge color maps ──────────────────────────────────────
const AUDIT_TYPE_COLORS: Record<AuditType, string> = {
  internal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  external: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  regulatory: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  supplier: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  customer: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

const AUDIT_STATUS_COLORS: Record<AuditStatus, string> = {
  planned: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  report_pending: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  closed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const FINDING_TYPE_COLORS: Record<FindingType, string> = {
  major: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  minor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  observation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  opportunity: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const FINDING_STATUS_COLORS: Record<FindingStatus, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function formatLabel(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

// ─── Inner component ───────────────────────────────────────
function AuditManagementInner() {
  const { labId } = useActiveLab();
  const audits = useQuery(api.audits.listAudits, labId ? { laboratoryId: labId } : "skip");
  const users = useQuery(api.users.listUsers, {});
  const createAudit = useMutation(api.audits.createAudit);
  const updateAudit = useMutation(api.audits.updateAudit);
  const addFinding = useMutation(api.audits.addFinding);
  const updateFinding = useMutation(api.audits.updateFinding);

  // Dialog states
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<Id<"audits"> | null>(null);
  const [editStatusId, setEditStatusId] = useState<Id<"audits"> | null>(null);
  const [showAddFinding, setShowAddFinding] = useState(false);

  // Form states — Plan Audit
  const [planTitle, setPlanTitle] = useState("");
  const [planType, setPlanType] = useState<AuditType | "">("");
  const [planDate, setPlanDate] = useState("");
  const [planAuditor, setPlanAuditor] = useState<string>("");
  const [planScope, setPlanScope] = useState("");
  const [planObjectives, setPlanObjectives] = useState("");
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);

  // Form states — Edit Status
  const [editStatus, setEditStatus] = useState<AuditStatus>("planned");
  const [editConductedDate, setEditConductedDate] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Form states — Add Finding
  const [findingType, setFindingType] = useState<FindingType | "">("");
  const [findingDesc, setFindingDesc] = useState("");
  const [findingRequirement, setFindingRequirement] = useState("");
  const [findingEvidence, setFindingEvidence] = useState("");
  const [findingDueDate, setFindingDueDate] = useState("");
  const [findingResponsible, setFindingResponsible] = useState<string>("");
  const [isFindingSubmitting, setIsFindingSubmitting] = useState(false);

  // Detail query
  const auditDetail = useQuery(
    api.audits.getAudit,
    selectedAuditId ? { auditId: selectedAuditId } : "skip"
  );

  // ─── KPI calculations ────────────────────────────────────
  const totalAudits = audits?.length ?? 0;
  const inProgress = audits?.filter((a) => a.status === "in_progress").length ?? 0;
  const findingsOpen = audits?.reduce((sum, a) => sum + a.openFindings, 0) ?? 0;
  const currentYear = new Date().getFullYear();
  const closedThisYear = audits?.filter(
    (a) => a.status === "closed" && a.closedDate?.startsWith(String(currentYear))
  ).length ?? 0;

  // ─── All findings for Findings tab ───────────────────────
  const allFindings = audits?.flatMap((a) => {
    // We only have summary counts in list view, so use detail for the full findings table
    return [];
  });
  // We'll query all audits' findings via a separate approach: iterate audit details
  // For the findings tab, we flatten from the list query enriched data
  // Since listAudits doesn't return individual findings, we use a derived approach
  // Actually, let's gather findings from getAudit for each audit — but that's N queries.
  // Better: build findings from the list data we already have enriched with counts,
  // and show a dedicated findings list query. Since there's no dedicated endpoint,
  // let's render a simplified findings list by fetching each audit detail on demand.

  // For the findings tab, we'll use a dedicated component that loads all audit details.

  // ─── Handlers ────────────────────────────────────────────
  const handleCreateAudit = async () => {
    if (!labId || !planTitle.trim() || !planType || !planDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsPlanSubmitting(true);
    try {
      await createAudit({
        laboratoryId: labId,
        title: planTitle.trim(),
        auditType: planType as AuditType,
        plannedDate: planDate,
        leadAuditor: planAuditor ? (planAuditor as Id<"users">) : undefined,
        scope: planScope || undefined,
        objectives: planObjectives || undefined,
      });
      toast.success("Audit planned successfully");
      setShowPlanDialog(false);
      resetPlanForm();
    } catch {
      toast.error("Failed to create audit");
    } finally {
      setIsPlanSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editStatusId) return;
    setIsEditSubmitting(true);
    try {
      await updateAudit({
        auditId: editStatusId,
        status: editStatus,
        conductedDate: editConductedDate || undefined,
        closedDate: editStatus === "closed" ? new Date().toISOString() : undefined,
      });
      toast.success("Audit status updated");
      setEditStatusId(null);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleAddFinding = async () => {
    if (!selectedAuditId || !labId || !findingType || !findingDesc.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsFindingSubmitting(true);
    try {
      await addFinding({
        auditId: selectedAuditId,
        laboratoryId: labId,
        type: findingType as FindingType,
        description: findingDesc.trim(),
        requirement: findingRequirement || undefined,
        evidence: findingEvidence || undefined,
        dueDate: findingDueDate || undefined,
        responsibleId: findingResponsible ? (findingResponsible as Id<"users">) : undefined,
      });
      toast.success("Finding added");
      setShowAddFinding(false);
      resetFindingForm();
    } catch {
      toast.error("Failed to add finding");
    } finally {
      setIsFindingSubmitting(false);
    }
  };

  const handleUpdateFindingStatus = async (findingId: Id<"auditFindings">, status: FindingStatus) => {
    try {
      await updateFinding({
        findingId,
        status,
        closedDate: status === "closed" ? new Date().toISOString() : undefined,
      });
      toast.success("Finding updated");
    } catch {
      toast.error("Failed to update finding");
    }
  };

  const resetPlanForm = () => {
    setPlanTitle("");
    setPlanType("");
    setPlanDate("");
    setPlanAuditor("");
    setPlanScope("");
    setPlanObjectives("");
  };

  const resetFindingForm = () => {
    setFindingType("");
    setFindingDesc("");
    setFindingRequirement("");
    setFindingEvidence("");
    setFindingDueDate("");
    setFindingResponsible("");
  };

  const openEditStatus = (auditId: Id<"audits">, currentStatus: AuditStatus) => {
    setEditStatusId(auditId);
    setEditStatus(currentStatus);
    setEditConductedDate("");
  };

  // ─── Loading state ───────────────────────────────────────
  if (!labId || audits === undefined) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Management</h1>
            <p className="text-sm text-muted-foreground">Internal, External & Regulatory Audits</p>
          </div>
        </div>
        <Button onClick={() => setShowPlanDialog(true)} className="cursor-pointer gap-2">
          <Plus className="h-4 w-4" />
          Plan Audit
        </Button>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Audits" value={totalAudits} icon={<ClipboardCheck className="h-4 w-4" />} />
        <KpiCard title="In Progress" value={inProgress} icon={<CalendarDays className="h-4 w-4" />} />
        <KpiCard title="Findings Open" value={findingsOpen} icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard title="Closed This Year" value={closedThisYear} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {/* ─── Tabs ──────────────────────────────────────── */}
      <Tabs defaultValue="audits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audits" className="cursor-pointer">Audits</TabsTrigger>
          <TabsTrigger value="findings" className="cursor-pointer">Findings</TabsTrigger>
        </TabsList>

        {/* ── Audits Tab ────────────────────────────────── */}
        <TabsContent value="audits">
          {audits.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
                <EmptyTitle>No audits yet</EmptyTitle>
                <EmptyDesc>Plan your first audit to get started with quality assurance</EmptyDesc>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setShowPlanDialog(true)} className="cursor-pointer">
                  Plan Audit
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {audits.map((audit) => (
                <Card key={audit._id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-muted-foreground">{audit.auditNumber}</p>
                        <CardTitle className="text-base mt-1 truncate">{audit.title}</CardTitle>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={cn("text-xs", AUDIT_TYPE_COLORS[audit.auditType as AuditType])}>
                          {formatLabel(audit.auditType)}
                        </Badge>
                        <Badge className={cn("text-xs", AUDIT_STATUS_COLORS[audit.status as AuditStatus])}>
                          {formatLabel(audit.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Planned: {formatDate(audit.plannedDate)}</span>
                    </div>
                    {audit.conductedDate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>Conducted: {formatDate(audit.conductedDate)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>{audit.leadAuditorName ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Findings: {audit.findingsCount} total / {audit.openFindings} open</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedAuditId(audit._id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer gap-1"
                        onClick={() => openEditStatus(audit._id, audit.status as AuditStatus)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Status
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Findings Tab ──────────────────────────────── */}
        <TabsContent value="findings">
          <FindingsTab
            audits={audits}
            users={users}
            onUpdateStatus={handleUpdateFindingStatus}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Plan Audit Dialog ─────────────────────────── */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan New Audit</DialogTitle>
            <DialogDescription>Create a new audit with basic details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Annual Internal Quality Audit"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audit Type *</Label>
                <Select value={planType} onValueChange={(v) => setPlanType(v as AuditType)}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                    <SelectItem value="regulatory">Regulatory</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Planned Date *</Label>
                <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lead Auditor</Label>
              <Select value={planAuditor} onValueChange={setPlanAuditor}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select auditor" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u._id} value={u._id}>{u.name ?? u.email ?? "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Textarea
                placeholder="Areas, departments, or processes to be audited"
                value={planScope}
                onChange={(e) => setPlanScope(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Objectives</Label>
              <Textarea
                placeholder="Key objectives for this audit"
                value={planObjectives}
                onChange={(e) => setPlanObjectives(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPlanDialog(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleCreateAudit} disabled={isPlanSubmitting} className="cursor-pointer">
              {isPlanSubmitting ? "Creating..." : "Plan Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Status Dialog ────────────────────────── */}
      <Dialog open={!!editStatusId} onOpenChange={(open) => { if (!open) setEditStatusId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Audit Status</DialogTitle>
            <DialogDescription>Change the current status of this audit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AuditStatus)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="report_pending">Report Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === "in_progress" && (
              <div className="space-y-2">
                <Label>Conducted Date</Label>
                <Input
                  type="date"
                  value={editConductedDate}
                  onChange={(e) => setEditConductedDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditStatusId(null)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isEditSubmitting} className="cursor-pointer">
              {isEditSubmitting ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Audit Detail Sheet ────────────────────────── */}
      <Sheet open={!!selectedAuditId} onOpenChange={(open) => { if (!open) setSelectedAuditId(null); }}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {auditDetail?.auditNumber ?? "Loading..."} — {auditDetail?.title ?? ""}
            </SheetTitle>
            <SheetDescription>Full audit details and findings</SheetDescription>
          </SheetHeader>

          {!auditDetail ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Audit info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge className={cn("mt-1", AUDIT_TYPE_COLORS[auditDetail.auditType as AuditType])}>
                    {formatLabel(auditDetail.auditType)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={cn("mt-1", AUDIT_STATUS_COLORS[auditDetail.status as AuditStatus])}>
                    {formatLabel(auditDetail.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Planned Date</p>
                  <p className="font-medium">{formatDate(auditDetail.plannedDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conducted Date</p>
                  <p className="font-medium">{formatDate(auditDetail.conductedDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lead Auditor</p>
                  <p className="font-medium">{auditDetail.leadAuditorName ?? "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Closed Date</p>
                  <p className="font-medium">{formatDate(auditDetail.closedDate)}</p>
                </div>
              </div>

              {auditDetail.scope && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Scope</p>
                  <p className="mt-1">{auditDetail.scope}</p>
                </div>
              )}
              {auditDetail.objectives && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Objectives</p>
                  <p className="mt-1">{auditDetail.objectives}</p>
                </div>
              )}

              {/* Findings table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Findings ({auditDetail.findings?.length ?? 0})</h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAddFinding(true)}
                    className="cursor-pointer gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Finding
                  </Button>
                </div>

                {auditDetail.findings && auditDetail.findings.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Finding #</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Responsible</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Closure</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditDetail.findings.map((f) => (
                          <TableRow key={f._id}>
                            <TableCell className="font-mono text-xs">{f.findingNumber}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", FINDING_TYPE_COLORS[f.type as FindingType])}>
                                {formatLabel(f.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{f.description}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", FINDING_STATUS_COLORS[f.status as FindingStatus])}>
                                {formatLabel(f.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>{f.responsibleName ?? "—"}</TableCell>
                            <TableCell>{formatDate(f.dueDate)}</TableCell>
                            <TableCell>{formatDate(f.closedDate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No findings recorded yet.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Add Finding Dialog ────────────────────────── */}
      <Dialog open={showAddFinding} onOpenChange={setShowAddFinding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Finding</DialogTitle>
            <DialogDescription>Record a new finding for this audit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={findingType} onValueChange={(v) => setFindingType(v as FindingType)}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="opportunity">Opportunity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={findingDueDate} onChange={(e) => setFindingDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the finding in detail"
                value={findingDesc}
                onChange={(e) => setFindingDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Requirement</Label>
              <Input
                placeholder="ISO clause or internal procedure reference"
                value={findingRequirement}
                onChange={(e) => setFindingRequirement(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence</Label>
              <Textarea
                placeholder="Objective evidence observed"
                value={findingEvidence}
                onChange={(e) => setFindingEvidence(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsible</Label>
              <Select value={findingResponsible} onValueChange={setFindingResponsible}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u._id} value={u._id}>{u.name ?? u.email ?? "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddFinding(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleAddFinding} disabled={isFindingSubmitting} className="cursor-pointer">
              {isFindingSubmitting ? "Adding..." : "Add Finding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KPI Card component ──────────────────────────────────────
function KpiCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Findings Tab component ──────────────────────────────────
function FindingsTab({
  audits,
  users,
  onUpdateStatus,
}: {
  audits: Array<{
    _id: Id<"audits">;
    auditNumber: string;
    findingsCount: number;
    openFindings: number;
  }>;
  users: Array<{ _id: Id<"users">; name?: string; email?: string }> | undefined;
  onUpdateStatus: (findingId: Id<"auditFindings">, status: FindingStatus) => Promise<void>;
}) {
  // Load detailed findings for all audits by selecting one at a time
  // We fetch all audit details and merge the findings
  // To avoid N queries, we'll display findings from the first few audits
  // Actually we need a paginated approach. Let's query each audit.
  // For now, let's iterate and use individual queries.

  // We'll just show a consolidated view using individual getAudit calls
  // But that's expensive. Instead, let's show the findings grouped.
  // The best UX: fetch all audit IDs and query each.

  const auditIds = audits.map((a) => a._id);

  return <FindingsTableLoader auditIds={auditIds} users={users} onUpdateStatus={onUpdateStatus} />;
}

function FindingsTableLoader({
  auditIds,
  users,
  onUpdateStatus,
}: {
  auditIds: Id<"audits">[];
  users: Array<{ _id: Id<"users">; name?: string; email?: string }> | undefined;
  onUpdateStatus: (findingId: Id<"auditFindings">, status: FindingStatus) => Promise<void>;
}) {
  // Query each audit's details to get findings — using first audit for now
  // A better approach: query findings across all audits
  // Since we don't have a dedicated `listAllFindings` endpoint, we'll
  // load each audit detail. This uses N queries but is necessary.
  // To keep it manageable, we render a sub-component per audit.

  if (auditIds.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><AlertTriangle /></EmptyMedia>
          <EmptyTitle>No findings</EmptyTitle>
          <EmptyDesc>Findings will appear here once audits are conducted</EmptyDesc>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Finding #</TableHead>
            <TableHead>Audit</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Responsible</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditIds.map((auditId) => (
            <FindingsRowsForAudit
              key={auditId}
              auditId={auditId}
              users={users}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FindingsRowsForAudit({
  auditId,
  users,
  onUpdateStatus,
}: {
  auditId: Id<"audits">;
  users: Array<{ _id: Id<"users">; name?: string; email?: string }> | undefined;
  onUpdateStatus: (findingId: Id<"auditFindings">, status: FindingStatus) => Promise<void>;
}) {
  const audit = useQuery(api.audits.getAudit, { auditId });

  if (!audit || !audit.findings || audit.findings.length === 0) return null;

  return (
    <>
      {audit.findings.map((f) => {
        const responsibleUser = users?.find((u) => u._id === f.responsibleId);
        return (
          <TableRow key={f._id}>
            <TableCell className="font-mono text-xs">{f.findingNumber}</TableCell>
            <TableCell className="text-xs">{audit.auditNumber}</TableCell>
            <TableCell>
              <Badge className={cn("text-xs", FINDING_TYPE_COLORS[f.type as FindingType])}>
                {formatLabel(f.type)}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[180px] truncate text-sm">{f.description}</TableCell>
            <TableCell>
              <Badge className={cn("text-xs", FINDING_STATUS_COLORS[f.status as FindingStatus])}>
                {formatLabel(f.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">{responsibleUser?.name ?? f.responsibleName ?? "—"}</TableCell>
            <TableCell className="text-sm">{formatDate(f.dueDate)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {f.status !== "in_progress" && f.status !== "closed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer h-7 text-xs"
                    onClick={() => onUpdateStatus(f._id as Id<"auditFindings">, "in_progress")}
                  >
                    Start
                  </Button>
                )}
                {f.status !== "closed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer h-7 text-xs text-green-600"
                    onClick={() => onUpdateStatus(f._id as Id<"auditFindings">, "closed")}
                  >
                    Close
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

// ─── Default export ──────────────────────────────────────────
export default function AuditManagementPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager", "qa_officer"]}>
      <AuditManagementInner />
    </PageGuard>
  );
}
