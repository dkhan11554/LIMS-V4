import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ConvexError } from "convex/values";
import {
  Microscope, Plus, Search, Calendar, Wrench, AlertTriangle,
  CheckCircle2, Clock, XCircle, Gauge
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active:             { label: "Active",            color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",      icon: <CheckCircle2 size={12} /> },
  inactive:           { label: "Inactive",          color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",             icon: <XCircle size={12} /> },
  under_calibration:  { label: "Calibration",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",          icon: <Gauge size={12} /> },
  under_maintenance:  { label: "Maintenance",       color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",  icon: <Wrench size={12} /> },
  decommissioned:     { label: "Decommissioned",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",              icon: <XCircle size={12} /> },
};

const INSTRUMENT_TYPES = [
  "analyser", "balance", "pH_meter", "autoclave", "centrifuge",
  "spectrophotometer", "HPLC", "GC", "PCR", "microscope", "incubator", "other",
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function AddInstrumentDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.instruments.createInstrument);
  const [form, setForm] = useState({
    name: "", type: "", manufacturer: "", model: "", serialNumber: "", assetNumber: "",
    location: "", calibrationIntervalDays: "", lastCalibrationDate: "", nextCalibrationDue: "",
    purchaseDate: "", warrantyExpiry: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await create({
        name: form.name,
        type: form.type || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        assetNumber: form.assetNumber || undefined,
        laboratoryId: labId as never,
        location: form.location || undefined,
        calibrationIntervalDays: form.calibrationIntervalDays ? Number(form.calibrationIntervalDays) : undefined,
        lastCalibrationDate: form.lastCalibrationDate || undefined,
        nextCalibrationDue: form.nextCalibrationDue || undefined,
        purchaseDate: form.purchaseDate || undefined,
        warrantyExpiry: form.warrantyExpiry || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Instrument added");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to add instrument");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Instrument</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HPLC System A" />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {INSTRUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Lab Room 3" />
          </div>
          <div className="space-y-1">
            <Label>Manufacturer</Label>
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Agilent" />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. 1260 Infinity II" />
          </div>
          <div className="space-y-1">
            <Label>Serial Number</Label>
            <Input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Asset Number</Label>
            <Input value={form.assetNumber} onChange={(e) => set("assetNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Calibration Interval (days)</Label>
            <Input type="number" value={form.calibrationIntervalDays} onChange={(e) => set("calibrationIntervalDays", e.target.value)} placeholder="365" />
          </div>
          <div className="space-y-1">
            <Label>Next Calibration Due</Label>
            <Input type="date" value={form.nextCalibrationDue} onChange={(e) => set("nextCalibrationDue", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Purchase Date</Label>
            <Input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Warranty Expiry</Label>
            <Input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Add Instrument"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type InstrumentListItem = {
  _id: string;
  name: string;
  instrumentCode: string;
  status: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  calibrationOverdue: boolean;
  nextCalibrationDue?: string;
};

function InstrumentCard({ instrument }: { instrument: InstrumentListItem }) {
  const navigate = useNavigate();
  if (!instrument) return null;

  const dueDate = instrument.nextCalibrationDue
    ? format(parseISO(instrument.nextCalibrationDue), "dd MMM yyyy")
    : "—";

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border"
      onClick={() => navigate(`/instruments/${instrument._id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
              <Microscope size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{instrument.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{instrument.instrumentCode}</p>
            </div>
          </div>
          <StatusBadge status={instrument.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {instrument.manufacturer && (
          <p className="text-xs text-muted-foreground">{instrument.manufacturer} {instrument.model && `· ${instrument.model}`}</p>
        )}
        {instrument.location && (
          <p className="text-xs text-muted-foreground">📍 {instrument.location}</p>
        )}
        <div className="flex items-center gap-1 text-xs">
          <Calendar size={11} className="text-muted-foreground" />
          <span className="text-muted-foreground">Cal due:</span>
          <span className={cn("font-medium", instrument.calibrationOverdue ? "text-destructive" : "")}>
            {dueDate}
          </span>
          {instrument.calibrationOverdue && <AlertTriangle size={11} className="text-destructive" />}
        </div>
      </CardContent>
    </Card>
  );
}

function InstrumentsInner() {
  const { labId } = useActiveLab();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const instruments = useQuery(api.instruments.listInstruments, labId ? { laboratoryId: labId as never } : "skip");
  const calsDue = useQuery(api.instruments.getCalibrationsDue, labId ? { laboratoryId: labId as never, daysAhead: 30 } : "skip");

  if (!labId) return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;

  const filtered = (instruments ?? []).filter((i) => {
    const matchSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.instrumentCode.toLowerCase().includes(search.toLowerCase()) ||
      (i.manufacturer ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const overdueCount = (calsDue ?? []).filter((i) => i.overdue).length;
  const dueCount = (calsDue ?? []).filter((i) => !i.overdue).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Microscope size={22} className="text-primary" /> Instruments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Instrument register, calibration schedules and maintenance logs</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus size={16} className="mr-1" /> Add Instrument</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: instruments?.length ?? 0, icon: <Microscope size={18} />, color: "text-primary" },
          { label: "Active", value: (instruments ?? []).filter((i) => i.status === "active").length, icon: <CheckCircle2 size={18} />, color: "text-green-600" },
          { label: "Cal Overdue", value: overdueCount, icon: <AlertTriangle size={18} />, color: "text-destructive" },
          { label: "Due ≤30 days", value: dueCount, icon: <Clock size={18} />, color: "text-orange-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{instruments === undefined ? <Skeleton className="h-7 w-10" /> : s.value}</p>
              </div>
              <span className={s.color}>{s.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search instruments…" className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calibration alerts */}
      {overdueCount > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle size={16} />
          <span><strong>{overdueCount}</strong> instrument{overdueCount > 1 ? "s are" : " is"} overdue for calibration.</span>
        </div>
      )}

      {/* Grid */}
      {instruments === undefined ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Microscope size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No instruments found</p>
          <p className="text-sm">Add your first instrument to get started.</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" />Add Instrument</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((i) => <InstrumentCard key={i._id} instrument={i} />)}
        </div>
      )}

      <AddInstrumentDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

export default function InstrumentsPage() {
  return <Authenticated><InstrumentsInner /></Authenticated>;
}
