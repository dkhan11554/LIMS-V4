import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  Archive, MapPin, Package, Thermometer, DoorOpen,
  ChevronRight, ChevronDown, Plus, BoxIcon, Undo2,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils.ts";
import { addMonths, isBefore, differenceInDays, format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────────

type StorageLocation = {
  _id: Id<"storageLocations">;
  name: string;
  code: string;
  locationType: "room" | "cabinet" | "refrigerator" | "freezer" | "shelf" | "rack" | "box";
  parentId?: Id<"storageLocations">;
  temperature?: string;
  capacity?: number;
  currentOccupancy?: number;
  notes?: string;
};

type StorageAssignment = {
  _id: Id<"sampleStorageAssignments">;
  sampleId: Id<"samples">;
  locationId: Id<"storageLocations">;
  position?: string;
  checkInDate: string;
  retentionExpiry?: string;
  status: string;
  sampleName?: string;
  limsNumber?: string;
  locationName?: string;
  locationCode?: string;
};

// ─── Helper: location type icon ─────────────────────────────────────────────────

function LocationIcon({ type }: { type: string }) {
  switch (type) {
    case "room":
      return <DoorOpen size={16} className="text-blue-600 dark:text-blue-400" />;
    case "freezer":
    case "refrigerator":
      return <Thermometer size={16} className="text-cyan-600 dark:text-cyan-400" />;
    case "box":
      return <BoxIcon size={16} className="text-amber-600 dark:text-amber-400" />;
    default:
      return <Package size={16} className="text-muted-foreground" />;
  }
}

// ─── Helper: build location path ────────────────────────────────────────────────

function buildLocationPath(locationId: Id<"storageLocations">, locations: StorageLocation[]): string {
  const parts: string[] = [];
  let current: StorageLocation | undefined = locations.find((l) => l._id === locationId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? locations.find((l) => l._id === current!.parentId) : undefined;
  }
  return parts.join(" > ");
}

// ─── Storage Map Tree Node ──────────────────────────────────────────────────────

function TreeNode({
  location,
  allLocations,
  onAddChild,
}: {
  location: StorageLocation;
  allLocations: StorageLocation[];
  onAddChild: (parentId: Id<"storageLocations">) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allLocations.filter((l) => l.parentId === location._id);
  const hasChildren = children.length > 0;
  const occupancyPct = location.capacity
    ? Math.min(100, Math.round(((location.currentOccupancy ?? 0) / location.capacity) * 100))
    : null;

  return (
    <div className="pl-4">
      <div className="flex items-center gap-2 py-1.5 group">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted cursor-pointer",
            !hasChildren && "invisible"
          )}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <LocationIcon type={location.locationType} />
        <span className="font-medium text-sm">{location.name}</span>
        <span className="text-xs text-muted-foreground font-mono">{location.code}</span>
        {location.temperature && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {location.temperature}
          </Badge>
        )}
        {occupancyPct !== null && (
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  occupancyPct >= 90
                    ? "bg-red-500"
                    : occupancyPct >= 70
                      ? "bg-amber-500"
                      : "bg-green-500"
                )}
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {location.currentOccupancy ?? 0}/{location.capacity}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => onAddChild(location._id)}
        >
          <Plus size={12} />
        </Button>
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-border ml-2.5">
          {children.map((child) => (
            <TreeNode
              key={child._id}
              location={child}
              allLocations={allLocations}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
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

// ─── Add Location Dialog ────────────────────────────────────────────────────────

function AddLocationDialog({
  open,
  onOpenChange,
  parentId,
  locations,
  labId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentId: Id<"storageLocations"> | undefined;
  locations: StorageLocation[];
  labId: Id<"laboratories">;
}) {
  const createLocation = useMutation(api.storage.createLocation);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [locationType, setLocationType] = useState<string>("");
  const [selectedParent, setSelectedParent] = useState<string>(parentId ?? "");
  const [temperature, setTemperature] = useState("");
  const [capacity, setCapacity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset fields when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName("");
      setCode("");
      setLocationType("");
      setSelectedParent(parentId ?? "");
      setTemperature("");
      setCapacity("");
      setNotes("");
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim() || !locationType) {
      toast.error("Name, Code, and Location Type are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await createLocation({
        laboratoryId: labId,
        name: name.trim(),
        code: code.trim(),
        locationType: locationType as "room" | "cabinet" | "refrigerator" | "freezer" | "shelf" | "rack" | "box",
        parentId: selectedParent ? (selectedParent as Id<"storageLocations">) : undefined,
        temperature: temperature.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Location created");
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create location");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Storage Location</DialogTitle>
          <DialogDescription>Define a new storage location in your laboratory</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Freezer A" />
          </div>
          <div className="space-y-1.5">
            <Label>Code <span className="text-destructive">*</span></Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. FRZ-A-01" />
          </div>
          <div className="space-y-1.5">
            <Label>Location Type <span className="text-destructive">*</span></Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room">Room</SelectItem>
                <SelectItem value="cabinet">Cabinet</SelectItem>
                <SelectItem value="refrigerator">Refrigerator</SelectItem>
                <SelectItem value="freezer">Freezer</SelectItem>
                <SelectItem value="shelf">Shelf</SelectItem>
                <SelectItem value="rack">Rack</SelectItem>
                <SelectItem value="box">Box</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Parent Location</Label>
            <Select value={selectedParent} onValueChange={setSelectedParent}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="None (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc._id} value={loc._id}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperature</Label>
              <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. -20C" />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 100" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} className="cursor-pointer">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="cursor-pointer">
            {isSubmitting ? "Creating..." : "Create Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Storage Map Tab ────────────────────────────────────────────────────────────

function StorageMapTab({ locations, labId }: { locations: StorageLocation[]; labId: Id<"laboratories"> }) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<Id<"storageLocations"> | undefined>(undefined);

  const topLevel = locations.filter((l) => !l.parentId);

  const handleAddChild = (parentId: Id<"storageLocations">) => {
    setAddParentId(parentId);
    setAddDialogOpen(true);
  };

  if (locations.length === 0) {
    return (
      <>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
            <EmptyTitle>No storage locations defined</EmptyTitle>
            <EmptyDescription>Create your first storage location to start tracking sample positions</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => { setAddParentId(undefined); setAddDialogOpen(true); }} className="cursor-pointer">
              <Plus size={14} className="mr-1" /> Add Location
            </Button>
          </EmptyContent>
        </Empty>
        <AddLocationDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          parentId={addParentId}
          locations={locations}
          labId={labId}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="space-y-0.5">
            {topLevel.map((loc) => (
              <TreeNode
                key={loc._id}
                location={loc}
                allLocations={locations}
                onAddChild={handleAddChild}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <AddLocationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        parentId={addParentId}
        locations={locations}
        labId={labId}
      />
    </>
  );
}

// ─── Stored Samples Tab ─────────────────────────────────────────────────────────

function StoredSamplesTab({
  assignments,
  locations,
}: {
  assignments: StorageAssignment[];
  locations: StorageLocation[];
}) {
  const retrieveSample = useMutation(api.storage.retrieveSample);
  const [retrieving, setRetrieving] = useState<string | null>(null);

  const handleRetrieve = async (assignmentId: Id<"sampleStorageAssignments">) => {
    setRetrieving(assignmentId);
    try {
      await retrieveSample({ assignmentId });
      toast.success("Sample retrieved from storage");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retrieve sample");
    } finally {
      setRetrieving(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Archive /></EmptyMedia>
          <EmptyTitle>No samples in storage</EmptyTitle>
          <EmptyDescription>Assign samples to storage locations to track them here</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const now = new Date();

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">LIMS#</th>
                <th className="text-left p-3 font-medium">Sample Name</th>
                <th className="text-left p-3 font-medium">Location</th>
                <th className="text-left p-3 font-medium">Position</th>
                <th className="text-left p-3 font-medium">Check-In</th>
                <th className="text-left p-3 font-medium">Retention Expiry</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((a) => {
                const locationPath = buildLocationPath(a.locationId, locations);
                const expiryDate = a.retentionExpiry ? new Date(a.retentionExpiry) : null;
                const isExpired = expiryDate ? isBefore(expiryDate, now) : false;
                const daysUntilExpiry = expiryDate ? differenceInDays(expiryDate, now) : null;
                const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

                return (
                  <tr key={a._id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs font-bold">{a.limsNumber ?? "—"}</td>
                    <td className="p-3">{a.sampleName ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-48 truncate" title={locationPath}>
                      {locationPath || a.locationName || "—"}
                    </td>
                    <td className="p-3">{a.position || "—"}</td>
                    <td className="p-3 text-xs">
                      {a.checkInDate ? format(new Date(a.checkInDate), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="p-3">
                      {expiryDate ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isExpired && "text-red-600 dark:text-red-400",
                            isExpiringSoon && !isExpired && "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {format(expiryDate, "dd MMM yyyy")}
                          {isExpired && " (expired)"}
                          {isExpiringSoon && !isExpired && ` (${daysUntilExpiry}d)`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="p-3">
                      {a.status === "in_storage" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1 text-xs cursor-pointer"
                          disabled={retrieving === a._id}
                          onClick={() => handleRetrieve(a._id)}
                        >
                          <Undo2 size={12} />
                          {retrieving === a._id ? "..." : "Retrieve"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge for storage ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    in_storage: { label: "In Storage", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    retrieved: { label: "Retrieved", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    disposed: { label: "Disposed", className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}

// ─── Assign Sample Tab ──────────────────────────────────────────────────────────

function AssignSampleTab({
  locations,
  labId,
}: {
  locations: StorageLocation[];
  labId: Id<"laboratories">;
}) {
  const samples = useQuery(api.samples.listSamples, labId ? { laboratoryId: labId } : "skip");
  const assignSample = useMutation(api.storage.assignSampleToStorage);

  const [limsSearch, setLimsSearch] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [position, setPosition] = useState("");
  const [retentionPeriod, setRetentionPeriod] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchedSample = useMemo(() => {
    if (!samples || !limsSearch.trim()) return null;
    return samples.find((s) => s.limsNumber.toLowerCase() === limsSearch.trim().toLowerCase()) ?? null;
  }, [samples, limsSearch]);

  const handleSubmit = async () => {
    if (!matchedSample) {
      toast.error("No sample found with that LIMS number");
      return;
    }
    if (!selectedLocationId) {
      toast.error("Please select a storage location");
      return;
    }

    let retentionExpiry: string | undefined;
    if (retentionPeriod === "custom") {
      retentionExpiry = customDate || undefined;
    } else if (retentionPeriod) {
      const months = Number(retentionPeriod);
      retentionExpiry = addMonths(new Date(), months).toISOString();
    }

    setIsSubmitting(true);
    try {
      await assignSample({
        sampleId: matchedSample._id,
        locationId: selectedLocationId as Id<"storageLocations">,
        laboratoryId: labId,
        position: position.trim() || undefined,
        retentionExpiry,
        notes: notes.trim() || undefined,
      });
      toast.success(`Sample ${matchedSample.limsNumber} assigned to storage`);
      setLimsSearch("");
      setSelectedLocationId("");
      setPosition("");
      setRetentionPeriod("");
      setCustomDate("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign sample");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assign Sample to Storage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Sample LIMS Number <span className="text-destructive">*</span></Label>
          <Input
            value={limsSearch}
            onChange={(e) => setLimsSearch(e.target.value)}
            placeholder="e.g. LAB-2026-000001"
          />
          {limsSearch.trim() && (
            <p className={cn("text-xs", matchedSample ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
              {matchedSample
                ? `Found: ${matchedSample.sampleName} (${matchedSample.limsNumber})`
                : "No sample found — type the exact LIMS number"}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Storage Location <span className="text-destructive">*</span></Label>
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc._id} value={loc._id}>
                  {buildLocationPath(loc._id, locations)} ({loc.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Position</Label>
          <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Row 3, Slot B" />
        </div>

        <div className="space-y-1.5">
          <Label>Retention Period</Label>
          <Select value={retentionPeriod} onValueChange={setRetentionPeriod}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select retention period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 month</SelectItem>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
              <SelectItem value="60">60 months</SelectItem>
              <SelectItem value="custom">Custom date</SelectItem>
            </SelectContent>
          </Select>
          {retentionPeriod === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Storage notes..." rows={2} />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting || !matchedSample || !selectedLocationId} className="w-full cursor-pointer">
          {isSubmitting ? "Assigning..." : "Assign to Storage"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

function SampleStorageInner() {
  const { labId } = useActiveLab();
  const locations = useQuery(api.storage.getAllLocations, labId ? { laboratoryId: labId } : "skip");
  const assignments = useQuery(api.storage.listStorageAssignments, labId ? { laboratoryId: labId } : "skip");

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // KPI calculations
  const locationCount = locations?.length ?? 0;
  const inStorageCount = assignments?.filter((a) => a.status === "in_storage").length ?? 0;
  const expiringCount = useMemo(() => {
    if (!assignments) return 0;
    const now = new Date();
    return assignments.filter((a) => {
      if (a.status !== "in_storage" || !a.retentionExpiry) return false;
      const expiry = new Date(a.retentionExpiry);
      const days = differenceInDays(expiry, now);
      return days >= 0 && days <= 30;
    }).length;
  }, [assignments]);

  if (!labId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No laboratory configured</p>
      </div>
    );
  }

  const isLoading = locations === undefined || assignments === undefined;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Archive size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sample Storage</h1>
            <p className="text-sm text-muted-foreground">
              Physical sample locations, retention & retrieval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="cursor-pointer"
            onClick={() => { setAddDialogOpen(true); }}
          >
            <Plus size={14} className="mr-1" /> Add Location
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Locations Defined" value={locationCount} icon={<MapPin size={20} />} />
          <KpiCard title="Samples In Storage" value={inStorageCount} icon={<Archive size={20} />} />
          <KpiCard title="Expiring Retention (30d)" value={expiringCount} icon={<Thermometer size={20} />} />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map" className="cursor-pointer">Storage Map</TabsTrigger>
          <TabsTrigger value="samples" className="cursor-pointer">Stored Samples</TabsTrigger>
          <TabsTrigger value="assign" className="cursor-pointer">Assign Sample</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <StorageMapTab locations={locations} labId={labId} />
          )}
        </TabsContent>

        <TabsContent value="samples" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <StoredSamplesTab assignments={assignments} locations={locations} />
          )}
        </TabsContent>

        <TabsContent value="assign" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <AssignSampleTab locations={locations} labId={labId} />
          )}
        </TabsContent>
      </Tabs>

      {/* Top-level Add Location Dialog */}
      {locations && (
        <AddLocationDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          parentId={undefined}
          locations={locations}
          labId={labId}
        />
      )}
    </div>
  );
}

export default function SampleStoragePage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager", "supervisor", "analyst"]}>
      <SampleStorageInner />
    </PageGuard>
  );
}
