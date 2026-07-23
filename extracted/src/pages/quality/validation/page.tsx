/**
 * Result Validation & Westgard Rules — M33
 * Spec-based OOS/OOT flags + Westgard multi-rule engine + electronic sign-off
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Dot,
} from "recharts";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle,
  ClipboardCheck, Clock, Info, TrendingUp, ChevronRight, Plus,
  BarChart3, Flag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Validation = {
  _id: Id<"resultValidations">;
  sampleTestId: Id<"sampleTests">;
  sampleId: Id<"samples">;
  testId: Id<"tests">;
  laboratoryId: Id<"laboratories">;
  measuredValue: number;
  unit?: string;
  lowerLimit?: number;
  upperLimit?: number;
  specStatus?: string;
  westgardViolations?: string[];
  westgardStatus?: string;
  trendAlerts?: string[];
  validationStatus: string;
  validatedBy?: Id<"users">;
  validatedAt?: string;
  validationNotes?: string;
  isOutlier?: boolean;
  outlierReason?: string;
  limsNumber?: string;
  sampleName?: string;
  testName?: string;
  testCode?: string;
  validatorName?: string;
  _creationTime: number;
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const VALIDATION_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",  icon: <Clock size={11} /> },
  flagged:  { label: "Flagged",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",              icon: <Flag size={11} /> },
  accepted: { label: "Accepted", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",      icon: <CheckCircle2 size={11} /> },
  rejected: { label: "Rejected", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",             icon: <XCircle size={11} /> },
};

const SPEC_STATUS: Record<string, { label: string; cls: string }> = {
  pass:        { label: "Pass",        cls: "text-green-600 dark:text-green-400" },
  fail_oos:    { label: "OOS",         cls: "text-red-600 dark:text-red-400 font-bold" },
  warn_alert:  { label: "Alert",       cls: "text-amber-600 dark:text-amber-400" },
  warn_action: { label: "Action",      cls: "text-orange-600 dark:text-orange-400" },
  no_spec:     { label: "No spec",     cls: "text-muted-foreground" },
};

function ValidationStatusBadge({ status }: { status: string }) {
  const s = VALIDATION_STATUS[status] ?? { label: status, cls: "bg-muted text-foreground", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", s.cls)}>
      {s.icon}{s.label}
    </span>
  );
}

function WestgardBadge({ violations, status }: { violations?: string[]; status?: string }) {
  if (!violations?.length) return <span className="text-xs text-green-600 dark:text-green-400 font-medium">—</span>;
  const cls = status === "reject" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return (
    <div className="flex flex-col gap-0.5">
      {violations.map((v, i) => (
        <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1", cls)}>
          <ShieldAlert size={9} />{v.split(":")[0]}
        </span>
      ))}
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────────

function TrendChart({ rows, testName }: { rows: Validation[]; testName: string }) {
  if (rows.length < 3) return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
      Need at least 3 results to plot trend
    </div>
  );

  const values = rows.map((r) => r.measuredValue);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (values.length - 1));

  const data = rows.map((r, i) => ({
    run: i + 1,
    date: format(new Date(r._creationTime), "MMM d"),
    value: r.measuredValue,
    status: r.validationStatus,
    specStatus: r.specStatus,
  }));

  const CustomDot = (props: { cx?: number; cy?: number; payload?: typeof data[number] }) => {
    const { cx = 0, cy = 0, payload } = props;
    if (!payload) return null;
    const fill = payload.specStatus === "fail_oos" ? "#ef4444"
      : payload.specStatus === "warn_alert" || payload.specStatus === "warn_action" ? "#f59e0b"
      : payload.status === "accepted" ? "#22c55e" : "#6366f1";
    return <Dot cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />;
  };

  return (
    <div>
      <p className="text-sm font-semibold mb-2">{testName} — Trend (Mean ± 2SD)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={55} />
          <Tooltip formatter={(v: unknown) => [(v as number).toFixed(3), "Value"]} />
          {sd > 0 && <>
            <ReferenceLine y={avg + 2 * sd} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: "+2SD", position: "insideRight", fontSize: 9, fill: "#f59e0b" }} />
            <ReferenceLine y={avg}           stroke="#6366f1" strokeWidth={2} label={{ value: "Mean", position: "insideRight", fontSize: 9, fill: "#6366f1" }} />
            <ReferenceLine y={avg - 2 * sd} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: "-2SD", position: "insideRight", fontSize: 9, fill: "#f59e0b" }} />
          </>}
          <Line type="linear" dataKey="value" stroke="#6366f1" strokeWidth={1.5} dot={<CustomDot />} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sign-off dialog ──────────────────────────────────────────────────────────

function SignOffDialog({ v: rec, onClose }: { v: Validation; onClose: () => void }) {
  const signOff = useMutation(api.validation.signOffValidation);
  const [notes, setNotes] = useState("");
  const [isOutlier, setIsOutlier] = useState(rec.isOutlier ?? false);
  const [outlierReason, setOutlierReason] = useState(rec.outlierReason ?? "");
  const [saving, setSaving] = useState(false);

  async function handle(accept: boolean) {
    setSaving(true);
    try {
      await signOff({ id: rec._id, accept, notes: notes || undefined, isOutlier, outlierReason: outlierReason || undefined });
      toast.success(accept ? "Result accepted" : "Result rejected");
      onClose();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Validate Result</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground">Sample</p>
              <p className="font-semibold">{rec.limsNumber ?? "—"}</p>
            </div>
            <div className="border rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground">Test</p>
              <p className="font-semibold">{rec.testName ?? "—"}</p>
            </div>
            <div className="border rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground">Measured Value</p>
              <p className="font-bold font-mono">{rec.measuredValue} {rec.unit ?? ""}</p>
            </div>
            <div className="border rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground">Spec Limits</p>
              <p className="font-mono text-xs">
                {rec.lowerLimit !== undefined ? `≥${rec.lowerLimit}` : "—"} / {rec.upperLimit !== undefined ? `≤${rec.upperLimit}` : "—"}
              </p>
            </div>
          </div>

          {/* Westgard violations */}
          {rec.westgardViolations?.length ? (
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                <ShieldAlert size={12} />Westgard Violations
              </p>
              <ul className="space-y-0.5">
                {rec.westgardViolations.map((v, i) => (
                  <li key={i} className="text-xs text-amber-800 dark:text-amber-300">{v}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Outlier flag */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="outlier" checked={isOutlier} onChange={(e) => setIsOutlier(e.target.checked)} className="cursor-pointer" />
            <Label htmlFor="outlier" className="cursor-pointer">Mark as statistical outlier (exclude from batch stats)</Label>
          </div>
          {isOutlier && (
            <Input placeholder="Reason for outlier exclusion…" value={outlierReason} onChange={(e) => setOutlierReason(e.target.value)} />
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Validation Notes</Label>
            <Textarea rows={2} placeholder="Add justification or comments…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="ghost" onClick={() => handle(false)} disabled={saving} className="text-destructive hover:text-destructive">
            <XCircle size={14} className="mr-1.5" />Reject
          </Button>
          <Button onClick={() => handle(true)} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Validation dialog ────────────────────────────────────────────────────

function AddValidationDialog({ laboratoryId, onClose }: { laboratoryId: Id<"laboratories">; onClose: () => void }) {
  const create = useMutation(api.validation.createValidation);
  const samples = useQuery(api.samples.listSamples, { laboratoryId, status: undefined });
  const specSets = useQuery(api.calculations.listSpecSets, { laboratoryId });

  const [form, setForm] = useState({
    sampleTestId: "" as Id<"sampleTests"> | "",
    sampleId: "" as Id<"samples"> | "",
    testId: "" as Id<"tests"> | "",
    measuredValue: "",
    unit: "",
    specSetId: "" as Id<"specificationSets"> | "",
    specParameterId: "" as Id<"specificationParameters"> | "",
    // manual override
    lowerLimit: "",
    upperLimit: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedSpecSet = specSets?.find((s) => s._id === form.specSetId);
  const specParams = useQuery(
    api.calculations.getSpecSet,
    form.specSetId ? { id: form.specSetId as Id<"specificationSets"> } : "skip",
  );

  async function handleSave() {
    if (!form.sampleTestId || !form.sampleId || !form.testId || !form.measuredValue) {
      toast.error("Fill in required fields");
      return;
    }
    setSaving(true);
    try {
      await create({
        sampleTestId: form.sampleTestId as Id<"sampleTests">,
        sampleId: form.sampleId as Id<"samples">,
        laboratoryId,
        testId: form.testId as Id<"tests">,
        measuredValue: Number(form.measuredValue),
        unit: form.unit || undefined,
        specSetId: form.specSetId ? form.specSetId as Id<"specificationSets"> : undefined,
        specParameterId: form.specParameterId ? form.specParameterId as Id<"specificationParameters"> : undefined,
      });
      toast.success("Validation record created");
      onClose();
    } catch { toast.error("Failed to create"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Result Validation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Measured Value *</Label>
              <Input type="number" step="any" value={form.measuredValue} onChange={(e) => set("measuredValue", e.target.value)} placeholder="e.g. 98.5" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="e.g. mg/L, %" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sample Test ID *</Label>
              <Input value={form.sampleTestId} onChange={(e) => set("sampleTestId", e.target.value)} placeholder="Paste sampleTest ID" />
            </div>
            <div className="space-y-1.5">
              <Label>Sample ID *</Label>
              <Input value={form.sampleId} onChange={(e) => set("sampleId", e.target.value)} placeholder="Paste sample ID" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Test ID *</Label>
            <Input value={form.testId} onChange={(e) => set("testId", e.target.value)} placeholder="Paste test ID" />
          </div>
          <div className="space-y-1.5">
            <Label>Specification Set</Label>
            <Select value={form.specSetId || "none"} onValueChange={(v) => set("specSetId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select spec set (optional)…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No spec set</SelectItem>
                {(specSets ?? []).map((s) => <SelectItem key={s._id} value={s._id}>{s.name} ({s.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {specParams?.parameters?.length ? (
            <div className="space-y-1.5">
              <Label>Spec Parameter</Label>
              <Select value={form.specParameterId || "none"} onValueChange={(v) => set("specParameterId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select parameter…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {specParams.parameters.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.parameterName} {p.lowerLimit !== undefined ? `(${p.lowerLimit}–${p.upperLimit ?? "∞"})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : null}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Westgard Reference Card ──────────────────────────────────────────────────

const RULES = [
  { code: "1-2S",  type: "Warning", desc: "One control value exceeds the mean ± 2SD. Indicates potential imprecision." },
  { code: "1-3S",  type: "Reject",  desc: "One control value exceeds the mean ± 3SD. Indicates random error. Run must be rejected." },
  { code: "2-2S",  type: "Reject",  desc: "Two consecutive control values both exceed either +2SD or -2SD. Systematic error." },
  { code: "R-4S",  type: "Reject",  desc: "The range between two consecutive control values exceeds 4SD. Random error." },
  { code: "4-1S",  type: "Warning", desc: "Four consecutive control values all exceed the same 1SD limit on one side." },
  { code: "10x",   type: "Warning", desc: "Ten consecutive control values fall on the same side of the mean. Systematic shift." },
  { code: "7T",    type: "Warning", desc: "Seven consecutive values trend consistently up or down. Gradual drift." },
];

function WestgardReference() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The Westgard multi-rule method uses a combination of statistical rules to detect both random and systematic error in QC data.
        Rules are applied sequentially; a reject violation stops the run.
      </p>
      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold w-20">Rule</th>
              <th className="text-left px-3 py-2.5 font-semibold w-28">Type</th>
              <th className="text-left px-3 py-2.5 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.code} className="border-b last:border-0">
                <td className="px-3 py-2.5 font-mono font-bold text-primary">{r.code}</td>
                <td className="px-3 py-2.5">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", r.type === "Reject" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                    {r.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ValidationPage() {
  const { lab: activeLab, labs, labId } = useActiveLab();
  const laboratoryId = activeLab?._id;

  const stats = useQuery(api.validation.getValidationStats, laboratoryId ? { laboratoryId } : "skip");
  const validations = useQuery(api.validation.listValidations, laboratoryId ? { laboratoryId } : "skip") as Validation[] | undefined;

  const [statusFilter, setStatusFilter] = useState("all");
  const [signOff, setSignOff] = useState<Validation | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [trendId, setTrendId] = useState<Id<"tests"> | null>(null);
  const trendRows = useQuery(api.validation.getTestTrend, trendId && laboratoryId ? { laboratoryId, testId: trendId } : "skip") as Validation[] | undefined;

  const filtered = useMemo(() => {
    if (!validations) return [];
    if (statusFilter === "all") return validations;
    return validations.filter((v) => v.validationStatus === statusFilter);
  }, [validations, statusFilter]);

  if (!laboratoryId) return <div className="text-sm text-muted-foreground p-4">No active laboratory selected</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Result Validation</h1>
            <p className="text-sm text-muted-foreground">Spec limits · Westgard rules · Electronic sign-off · Trend analysis</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="cursor-pointer">
          <Plus size={15} className="mr-1.5" />New Validation
        </Button>
      </div>

      <Tabs defaultValue="validations">
        <TabsList>
          <TabsTrigger value="validations">Validation Queue</TabsTrigger>
          <TabsTrigger value="trend">Trend Analysis</TabsTrigger>
          <TabsTrigger value="rules">Westgard Reference</TabsTrigger>
        </TabsList>

        {/* ─── Validation Queue ─────────────────────────────── */}
        <TabsContent value="validations" className="space-y-4 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total",          value: stats?.total ?? 0,         color: "text-primary" },
              { label: "Pending",        value: stats?.pending ?? 0,       color: "text-yellow-600 dark:text-yellow-400" },
              { label: "Flagged",        value: stats?.flagged ?? 0,       color: "text-red-600 dark:text-red-400" },
              { label: "Accepted",       value: stats?.accepted ?? 0,      color: "text-green-600 dark:text-green-400" },
              { label: "Rejected",       value: stats?.rejected ?? 0,      color: "text-gray-500" },
              { label: "OOS",            value: stats?.oos ?? 0,           color: "text-red-600 dark:text-red-400" },
              { label: "Westgard Fails", value: stats?.westgardFails ?? 0, color: "text-amber-600 dark:text-amber-400" },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "flagged", "accepted", "rejected"].map((s) => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "ghost"} className="cursor-pointer capitalize" onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : VALIDATION_STATUS[s]?.label ?? s}
              </Button>
            ))}
          </div>

          {/* Table */}
          {!validations ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ShieldCheck size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No validation records</p>
              <p className="text-xs text-muted-foreground mt-1">Create a validation record to check a result against spec limits and Westgard rules</p>
            </CardContent></Card>
          ) : (
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2.5 font-semibold">Sample</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Test</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Value</th>
                    <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">Spec</th>
                    <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Westgard</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={r._id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/10 transition-colors",
                        i % 2 !== 0 && "bg-muted/5",
                        r.specStatus === "fail_oos" && "bg-red-50/50 dark:bg-red-950/20",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{r.limsNumber ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{r.sampleName}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.testName ?? r.testCode ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold">
                        {r.measuredValue} <span className="text-xs text-muted-foreground font-normal">{r.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        {r.specStatus ? (
                          <span className={cn("text-xs font-semibold", SPEC_STATUS[r.specStatus]?.cls)}>
                            {SPEC_STATUS[r.specStatus]?.label}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <WestgardBadge violations={r.westgardViolations} status={r.westgardStatus} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ValidationStatusBadge status={r.validationStatus} />
                        {r.isOutlier && <span className="text-[10px] text-muted-foreground ml-1">(outlier)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {(r.validationStatus === "pending" || r.validationStatus === "flagged") && (
                          <Button size="sm" variant="ghost" className="cursor-pointer text-xs" onClick={() => setSignOff(r)}>
                            <ClipboardCheck size={13} className="mr-1" />Sign Off
                          </Button>
                        )}
                        {r.testId && (
                          <Button size="sm" variant="ghost" className="cursor-pointer text-xs ml-1" onClick={() => setTrendId(trendId === r.testId ? null : r.testId)}>
                            <BarChart3 size={13} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─── Trend Analysis ───────────────────────────────── */}
        <TabsContent value="trend" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the chart icon next to any result in the queue to load its trend, or select a test below.
          </p>
          {trendRows && trendRows.length > 0 ? (
            <Card><CardContent className="pt-5">
              <TrendChart rows={trendRows} testName={trendRows[0] ? (validations?.find((v) => v.testId === trendId)?.testName ?? "Test") : "Test"} />
            </CardContent></Card>
          ) : (
            <Card><CardContent className="py-10 text-center">
              <TrendingUp size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No trend loaded</p>
              <p className="text-xs text-muted-foreground mt-1">Click the chart icon on a result row to display its trend</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ─── Westgard Reference ───────────────────────────── */}
        <TabsContent value="rules" className="mt-4">
          <Card><CardContent className="pt-5"><WestgardReference /></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {signOff && <SignOffDialog v={signOff} onClose={() => setSignOff(null)} />}
      {showAdd && laboratoryId && <AddValidationDialog laboratoryId={laboratoryId} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
