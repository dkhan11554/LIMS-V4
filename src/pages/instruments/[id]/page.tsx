import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft, Microscope, Calendar, Wrench, Plus,
  CheckCircle2, XCircle, AlertTriangle, Gauge, Edit2, Clock
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:             { label: "Active",          color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  inactive:           { label: "Inactive",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  under_calibration:  { label: "Calibration",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  under_maintenance:  { label: "Maintenance",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  decommissioned:     { label: "Decommissioned",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const CAL_RESULT: Record<string, string> = {
  pass: "text-green-600",
  fail: "text-destructive",
  conditional: "text-orange-500",
};

const MAINT_TYPE_LABEL: Record<string, string> = {
  preventive: "Preventive",
  corrective: "Corrective",
  breakdown: "Breakdown",
};

const OUTCOME_LABEL: Record<string, string> = {
  resolved: "Resolved",
  pending: "Pending",
  escalated: "Escalated",
};

function AddCalibrationDialog({
  instrumentId, open, onClose,
}: { instrumentId: string; open: boolean; onClose: () => void }) {
  const add = useMutation(api.instruments.addCalibration);
  const [form, setForm] = useState({
    calibrationType: "internal", scheduledDate: "",
    completedDate: "", result: "", certificateNumber: "",
    externalProvider: "", nextDueDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.scheduledDate) { toast.error("Scheduled date is required"); return; }
    setSaving(true);
    try {
      await add({
        instrumentId: instrumentId as never,
        calibrationType: form.calibrationType,
        scheduledDate: form.scheduledDate,
        completedDate: form.completedDate || undefined,
        result: (form.result as "pass" | "fail" | "conditional") || undefined,
        certificateNumber: form.certificateNumber || undefined,
        externalProvider: form.externalProvider || undefined,
        nextDueDate: form.nextDueDate || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Calibration record added");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to save calibration");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add Calibration Record</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.calibrationType} onValueChange={(v) => set("calibrationType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="verification">Verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Scheduled Date *</Label>
            <Input type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Completed Date</Label>
            <Input type="date" value={form.completedDate} onChange={(e) => set("completedDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Result</Label>
            <Select value={form.result} onValueChange={(v) => set("result", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="conditional">Conditional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Certificate Number</Label>
            <Input value={form.certificateNumber} onChange={(e) => set("certificateNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Next Due Date</Label>
            <Input type="date" value={form.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>External Provider</Label>
            <Input value={form.externalProvider} onChange={(e) => set("externalProvider", e.target.value)} placeholder="Calibration lab name" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMaintenanceDialog({
  instrumentId, open, onClose,
}: { instrumentId: string; open: boolean; onClose: () => void }) {
  const add = useMutation(api.instruments.addMaintenance);
  const [form, setForm] = useState({
    maintenanceType: "preventive", description: "",
    maintenanceDate: "", completedDate: "", outcome: "",
    externalProvider: "", cost: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.maintenanceDate) {
      toast.error("Description and date are required"); return;
    }
    setSaving(true);
    try {
      await add({
        instrumentId: instrumentId as never,
        maintenanceType: form.maintenanceType as "preventive" | "corrective" | "breakdown",
        description: form.description,
        maintenanceDate: form.maintenanceDate,
        completedDate: form.completedDate || undefined,
        outcome: (form.outcome as "resolved" | "pending" | "escalated") || undefined,
        externalProvider: form.externalProvider || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        notes: form.notes || undefined,
      });
      toast.success("Maintenance record added");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to save maintenance");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add Maintenance Record</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.maintenanceType} onValueChange={(v) => set("maintenanceType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventive</SelectItem>
                <SelectItem value="corrective">Corrective</SelectItem>
                <SelectItem value="breakdown">Breakdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input type="date" value={form.maintenanceDate} onChange={(e) => set("maintenanceDate", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description *</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was done?" />
          </div>
          <div className="space-y-1">
            <Label>Completed Date</Label>
            <Input type="date" value={form.completedDate} onChange={(e) => set("completedDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Outcome</Label>
            <Select value={form.outcome} onValueChange={(v) => set("outcome", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>External Provider</Label>
            <Input value={form.externalProvider} onChange={(e) => set("externalProvider", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cost</Label>
            <Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0.00" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstrumentDetailInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "calibration" | "maintenance">("overview");
  const [addCalOpen, setAddCalOpen] = useState(false);
  const [addMaintOpen, setAddMaintOpen] = useState(false);

  const instrument = useQuery(api.instruments.getInstrument, id ? { instrumentId: id as never } : "skip");

  if (!instrument && instrument !== null) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!instrument) {
    return <div className="p-8 text-muted-foreground">Instrument not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[instrument.status] ?? { label: instrument.status, color: "" };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "calibration", label: `Calibrations (${instrument.calibrations.length})` },
    { id: "maintenance", label: `Maintenance (${instrument.maintenance.length})` },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/instruments")} className="mt-0.5">
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{instrument.name}</h1>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
            {instrument.calibrationOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                <AlertTriangle size={11} /> Cal Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{instrument.instrumentCode}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer",
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Instrument Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Type", instrument.type?.replace("_", " ")],
                ["Manufacturer", instrument.manufacturer],
                ["Model", instrument.model],
                ["Serial Number", instrument.serialNumber],
                ["Asset Number", instrument.assetNumber],
                ["Location", instrument.location],
              ].map(([label, val]) => val && (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Calibration Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Interval", instrument.calibrationIntervalDays ? `${instrument.calibrationIntervalDays} days` : undefined],
                ["Last Calibrated", instrument.lastCalibrationDate ? format(parseISO(instrument.lastCalibrationDate), "dd MMM yyyy") : undefined],
                ["Next Due", instrument.nextCalibrationDue ? format(parseISO(instrument.nextCalibrationDue), "dd MMM yyyy") : undefined],
                ["Purchase Date", instrument.purchaseDate ? format(parseISO(instrument.purchaseDate), "dd MMM yyyy") : undefined],
                ["Warranty Expiry", instrument.warrantyExpiry ? format(parseISO(instrument.warrantyExpiry), "dd MMM yyyy") : undefined],
              ].map(([label, val]) => val && (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-medium", label === "Next Due" && instrument.calibrationOverdue ? "text-destructive" : "")}>{val}</span>
                </div>
              ))}
              {instrument.notes && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="mt-0.5 text-xs">{instrument.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calibrations */}
      {activeTab === "calibration" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddCalOpen(true)} size="sm">
              <Plus size={14} className="mr-1" /> Add Calibration
            </Button>
          </div>
          {instrument.calibrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gauge size={36} className="mx-auto mb-3 opacity-30" />
              <p>No calibration records yet.</p>
              <Button className="mt-3" size="sm" onClick={() => setAddCalOpen(true)}>Add First Record</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instrument.calibrations.map((c) => (
                <Card key={c._id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{c.calibrationType ?? "Internal"} Calibration</span>
                        {c.result && (
                          <span className={cn("text-xs font-semibold uppercase", CAL_RESULT[c.result])}>{c.result}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-x-3">
                        <span>Scheduled: {format(parseISO(c.scheduledDate), "dd MMM yyyy")}</span>
                        {c.completedDate && <span>Completed: {format(parseISO(c.completedDate), "dd MMM yyyy")}</span>}
                        {c.performerName && <span>By: {c.performerName}</span>}
                        {c.externalProvider && <span>Provider: {c.externalProvider}</span>}
                      </div>
                      {c.certificateNumber && <p className="text-xs">Cert: {c.certificateNumber}</p>}
                      {c.nextDueDate && <p className="text-xs text-muted-foreground">Next due: {format(parseISO(c.nextDueDate), "dd MMM yyyy")}</p>}
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Maintenance */}
      {activeTab === "maintenance" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddMaintOpen(true)} size="sm">
              <Plus size={14} className="mr-1" /> Add Maintenance
            </Button>
          </div>
          {instrument.maintenance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench size={36} className="mx-auto mb-3 opacity-30" />
              <p>No maintenance records yet.</p>
              <Button className="mt-3" size="sm" onClick={() => setAddMaintOpen(true)}>Add First Record</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instrument.maintenance.map((m) => (
                <Card key={m._id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{MAINT_TYPE_LABEL[m.maintenanceType]}</span>
                      {m.outcome && (
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
                          m.outcome === "resolved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          m.outcome === "escalated" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        )}>{OUTCOME_LABEL[m.outcome]}</span>
                      )}
                      {m.cost !== undefined && <span className="text-xs text-muted-foreground ml-auto">Cost: ${m.cost.toFixed(2)}</span>}
                    </div>
                    <p className="text-sm">{m.description}</p>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>Date: {format(parseISO(m.maintenanceDate), "dd MMM yyyy")}</span>
                      {m.completedDate && <span>Completed: {format(parseISO(m.completedDate), "dd MMM yyyy")}</span>}
                      {m.performerName && <span>By: {m.performerName}</span>}
                      {m.externalProvider && <span>Provider: {m.externalProvider}</span>}
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <AddCalibrationDialog instrumentId={id!} open={addCalOpen} onClose={() => setAddCalOpen(false)} />
      <AddMaintenanceDialog instrumentId={id!} open={addMaintOpen} onClose={() => setAddMaintOpen(false)} />
    </div>
  );
}

export default function InstrumentDetailPage() {
  return <Authenticated><InstrumentDetailInner /></Authenticated>;
}
