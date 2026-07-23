/**
 * Instrument QC Dashboard — Milestone 18
 * Levey-Jennings charts + Westgard rule detection per instrument/analyte
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Dot
} from "recharts";
import {
  Plus, AlertTriangle, CheckCircle2, Activity, Beaker,
  ShieldAlert, BarChart3, Trash2, Download
} from "lucide-react";
import Papa from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────

type QcResult = {
  _id: Id<"instrumentQcResults">;
  instrumentId: Id<"instruments">;
  analyte: string;
  controlLevel: string;
  controlLotNumber?: string;
  targetMean: number;
  targetSd: number;
  measuredValue: number;
  runDate: string;
  runNumber?: number;
  operatorName?: string;
  westgardViolations?: string[];
  accepted: boolean;
  notes?: string;
};

type InstrumentOption = {
  _id: Id<"instruments">;
  name: string;
  instrumentCode: string;
};

// ─── Westgard Badge ───────────────────────────────────────────────────────────

function WestgardBadge({ violations, accepted }: { violations?: string[]; accepted: boolean }) {
  if (!violations?.length) return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 size={12} />Pass
    </span>
  );
  const hasReject = violations.some((v) => v.includes("reject"));
  return (
    <div className="space-y-0.5">
      {violations.map((v, i) => (
        <div key={i} className={cn("text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1", hasReject ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
          <ShieldAlert size={9} />{v.split(":")[0]}
        </div>
      ))}
    </div>
  );
}

// ─── Levey-Jennings Chart ─────────────────────────────────────────────────────

function LeveyJenningsChart({ results, analyte, level }: { results: QcResult[]; analyte: string; level: string }) {
  const filtered = results
    .filter((r) => r.analyte === analyte && r.controlLevel === level)
    .sort((a, b) => a.runDate.localeCompare(b.runDate));

  if (filtered.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No QC runs for this level yet</div>
  );

  const mean = filtered[0]?.targetMean ?? 0;
  const sd = filtered[0]?.targetSd ?? 1;

  const data = filtered.map((r, i) => ({
    run: i + 1,
    date: new Date(r.runDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: r.measuredValue,
    z: (r.measuredValue - mean) / sd,
    accepted: r.accepted,
    violations: r.westgardViolations ?? [],
  }));

  // Custom dot: red for rejections, amber for warnings, green for pass
  const CustomDot = (props: { cx?: number; cy?: number; payload?: typeof data[number] }) => {
    const { cx = 0, cy = 0, payload } = props;
    if (!payload) return null;
    const hasReject = payload.violations.some((v) => v.includes("reject"));
    const hasWarn = payload.violations.length > 0 && !hasReject;
    const fill = hasReject ? "#ef4444" : hasWarn ? "#f59e0b" : "#22c55e";
    return <Dot cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-sm font-semibold">{analyte} — {level}</span>
        <span className="text-xs text-muted-foreground">Mean: {mean.toFixed(2)} ± SD: {sd.toFixed(2)}</span>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Pass</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Warning</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Reject</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[(mean - 3.5 * sd).toFixed(2), (mean + 3.5 * sd).toFixed(2)]} tickFormatter={(v: number) => v.toFixed(2)} width={55} />
          <Tooltip
            formatter={(v: unknown) => [(v as number).toFixed(3), "Value"]}
            labelFormatter={(label: unknown) => `Run: ${String(label)}`}
          />
          {/* Control limit lines */}
          <ReferenceLine y={mean + 3 * sd} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "+3SD", position: "insideRight", fontSize: 9, fill: "#ef4444" }} />
          <ReferenceLine y={mean + 2 * sd} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: "+2SD", position: "insideRight", fontSize: 9, fill: "#f59e0b" }} />
          <ReferenceLine y={mean + sd} stroke="#d1d5db" strokeDasharray="2 4" strokeWidth={1} />
          <ReferenceLine y={mean} stroke="#6366f1" strokeWidth={2} label={{ value: "Mean", position: "insideRight", fontSize: 9, fill: "#6366f1" }} />
          <ReferenceLine y={mean - sd} stroke="#d1d5db" strokeDasharray="2 4" strokeWidth={1} />
          <ReferenceLine y={mean - 2 * sd} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: "-2SD", position: "insideRight", fontSize: 9, fill: "#f59e0b" }} />
          <ReferenceLine y={mean - 3 * sd} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "-3SD", position: "insideRight", fontSize: 9, fill: "#ef4444" }} />
          <Line type="linear" dataKey="value" stroke="#6366f1" strokeWidth={1.5} dot={<CustomDot />} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Add QC Result Form ───────────────────────────────────────────────────────

function AddQcForm({
  instrumentId,
  laboratoryId,
  analytes,
  onClose,
}: {
  instrumentId: Id<"instruments">;
  laboratoryId: Id<"laboratories">;
  analytes: string[];
  onClose: () => void;
}) {
  const addQc = useMutation(api.instrumentIntegration.addQcResult);
  const users = useQuery(api.users.listUsers, {});

  const [form, setForm] = useState({
    analyte: analytes[0] ?? "",
    newAnalyte: "",
    controlLevel: "Normal",
    controlLotNumber: "",
    targetMean: "",
    targetSd: "",
    measuredValue: "",
    runDate: new Date().toISOString().slice(0, 10),
    runNumber: "",
    operatorId: "" as Id<"users"> | "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const finalAnalyte = form.analyte === "__new__" ? form.newAnalyte : form.analyte;

  async function handleSave() {
    if (!finalAnalyte || !form.targetMean || !form.targetSd || !form.measuredValue || !form.runDate) {
      toast.error("Fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      await addQc({
        instrumentId,
        laboratoryId,
        analyte: finalAnalyte,
        controlLevel: form.controlLevel,
        controlLotNumber: form.controlLotNumber || undefined,
        targetMean: Number(form.targetMean),
        targetSd: Number(form.targetSd),
        measuredValue: Number(form.measuredValue),
        runDate: form.runDate,
        runNumber: form.runNumber ? Number(form.runNumber) : undefined,
        operatorId: form.operatorId || undefined,
        notes: form.notes || undefined,
      });
      toast.success("QC result recorded");
      onClose();
    } catch {
      toast.error("Failed to save QC result");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Analyte *</Label>
          <Select value={form.analyte} onValueChange={(v) => set("analyte", v)}>
            <SelectTrigger><SelectValue placeholder="Select or add…" /></SelectTrigger>
            <SelectContent>
              {analytes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              <SelectItem value="__new__">+ Add new analyte…</SelectItem>
            </SelectContent>
          </Select>
          {form.analyte === "__new__" && <Input placeholder="Analyte name…" value={form.newAnalyte} onChange={(e) => set("newAnalyte", e.target.value)} />}
        </div>
        <div className="space-y-1.5">
          <Label>Control Level *</Label>
          <Select value={form.controlLevel} onValueChange={(v) => set("controlLevel", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Target Mean *</Label>
          <Input type="number" step="any" value={form.targetMean} onChange={(e) => set("targetMean", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Target SD *</Label>
          <Input type="number" step="any" min="0" value={form.targetSd} onChange={(e) => set("targetSd", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Measured Value *</Label>
          <Input type="number" step="any" value={form.measuredValue} onChange={(e) => set("measuredValue", e.target.value)} placeholder="Result from instrument" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Run Date *</Label>
          <Input type="date" value={form.runDate} onChange={(e) => set("runDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Run Number</Label>
          <Input type="number" value={form.runNumber} onChange={(e) => set("runNumber", e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label>Control Lot #</Label>
          <Input value={form.controlLotNumber} onChange={(e) => set("controlLotNumber", e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Operator</Label>
        <Select value={form.operatorId} onValueChange={(v) => set("operatorId", v)}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {users?.map((u) => <SelectItem key={u._id} value={u._id}>{u.name ?? u.email ?? u._id}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Saving…" : "Record QC Result"}</Button>
      </DialogFooter>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InstrumentQcPage() {
  const { labId } = useActiveLab();
  const instruments = useQuery(api.instruments.listInstruments, labId ? { laboratoryId: labId } : "skip");

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<Id<"instruments"> | null>(null);
  const [selectedAnalyte, setSelectedAnalyte] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);

  const effectiveInstrumentId = selectedInstrumentId ?? (instruments?.[0]?._id ?? null);

  const analytes = useQuery(
    api.instrumentIntegration.listAnalytesForInstrument,
    effectiveInstrumentId ? { instrumentId: effectiveInstrumentId } : "skip",
  );
  const qcResults = useQuery(
    api.instrumentIntegration.listQcResults,
    effectiveInstrumentId ? { instrumentId: effectiveInstrumentId, analyte: selectedAnalyte !== "all" ? selectedAnalyte : undefined } : "skip",
  );
  const deleteQc = useMutation(api.instrumentIntegration.deleteQcResult);

  const filteredResults = useMemo(() => {
    if (!qcResults) return [];
    return selectedAnalyte !== "all" ? qcResults.filter((r) => r.analyte === selectedAnalyte) : qcResults;
  }, [qcResults, selectedAnalyte]);

  const analyteLevels = useMemo(() => {
    const pairs = new Set<string>();
    filteredResults.forEach((r) => pairs.add(`${r.analyte}|||${r.controlLevel}`));
    return [...pairs].map((p) => {
      const [a, l] = p.split("|||");
      return { analyte: a ?? "", level: l ?? "" };
    });
  }, [filteredResults]);

  // Stats
  const totalRuns = filteredResults.length;
  const violations = filteredResults.filter((r) => (r.westgardViolations?.length ?? 0) > 0).length;
  const rejections = filteredResults.filter((r) => !r.accepted).length;
  const acceptRate = totalRuns > 0 ? Math.round(((totalRuns - rejections) / totalRuns) * 100) : 100;

  function exportCsv() {
    if (!filteredResults.length) { toast.error("No data to export"); return; }
    const rows = filteredResults.map((r) => ({
      "Analyte": r.analyte,
      "Level": r.controlLevel,
      "Lot#": r.controlLotNumber ?? "",
      "Mean": r.targetMean,
      "SD": r.targetSd,
      "Value": r.measuredValue,
      "Z-score": ((r.measuredValue - r.targetMean) / r.targetSd).toFixed(2),
      "Run Date": r.runDate,
      "Run#": r.runNumber ?? "",
      "Operator": r.operatorName ?? "",
      "Westgard Violations": (r.westgardViolations ?? []).join("; "),
      "Accepted": r.accepted ? "Yes" : "No",
      "Notes": r.notes ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qc_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("QC data exported");
  }

  if (!labId) return <Skeleton className="h-64 w-full" />;

  return (
    <PageGuard allowed={["system_admin", "lab_manager", "supervisor", "analyst", "qa_officer"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Activity size={24} className="text-primary" />Instrument QC Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Levey-Jennings charts and Westgard rule monitoring per instrument</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download size={14} className="mr-1.5" />Export CSV</Button>
            <Button size="sm" onClick={() => setShowAddForm(true)}><Plus size={14} className="mr-1.5" />Record QC Result</Button>
          </div>
        </div>

        {/* Instrument selector */}
        {instruments && instruments.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {instruments.map((inst) => (
              <button
                key={inst._id}
                onClick={() => { setSelectedInstrumentId(inst._id); setSelectedAnalyte("all"); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer",
                  effectiveInstrumentId === inst._id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
              >
                {inst.name}
              </button>
            ))}
          </div>
        )}

        {!instruments ? <Skeleton className="h-64 w-full" /> : instruments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Beaker /></EmptyMedia>
              <EmptyTitle>No instruments</EmptyTitle>
              <EmptyDescription>Add instruments first, then record QC results here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total QC Runs", value: totalRuns, icon: <BarChart3 size={18} />, color: "text-blue-500" },
                { label: "Westgard Violations", value: violations, icon: <AlertTriangle size={18} />, color: violations > 0 ? "text-amber-500" : "text-green-500" },
                { label: "Rejected Runs", value: rejections, icon: <ShieldAlert size={18} />, color: rejections > 0 ? "text-red-500" : "text-green-500" },
                { label: "Acceptance Rate", value: `${acceptRate}%`, icon: <CheckCircle2 size={18} />, color: acceptRate >= 95 ? "text-green-500" : acceptRate >= 85 ? "text-amber-500" : "text-red-500" },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <span className={kpi.color}>{kpi.icon}</span>
                    </div>
                    <p className={cn("text-2xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Analyte filter */}
            {analytes && analytes.length > 0 && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm text-muted-foreground">Analyte:</span>
                {["all", ...analytes].map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedAnalyte(a)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer",
                      selectedAnalyte === a ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                    )}
                  >
                    {a === "all" ? "All Analytes" : a}
                  </button>
                ))}
              </div>
            )}

            <Tabs defaultValue="charts">
              <TabsList>
                <TabsTrigger value="charts">Levey-Jennings Charts</TabsTrigger>
                <TabsTrigger value="table">Run Data Table</TabsTrigger>
                <TabsTrigger value="violations">Violations Log</TabsTrigger>
              </TabsList>

              {/* ── Charts ── */}
              <TabsContent value="charts" className="mt-4">
                {!qcResults ? <Skeleton className="h-64 w-full" /> : analyteLevels.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Activity /></EmptyMedia>
                      <EmptyTitle>No QC data yet</EmptyTitle>
                      <EmptyDescription>Record QC results to see Levey-Jennings control charts</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" onClick={() => setShowAddForm(true)}><Plus size={13} className="mr-1" />Record First QC Result</Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="space-y-6">
                    {analyteLevels.map(({ analyte, level }) => (
                      <Card key={`${analyte}-${level}`}>
                        <CardContent className="pt-4">
                          <LeveyJenningsChart results={filteredResults as QcResult[]} analyte={analyte} level={level} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Table ── */}
              <TabsContent value="table" className="mt-4">
                {!qcResults ? <Skeleton className="h-48 w-full" /> : filteredResults.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Beaker /></EmptyMedia>
                      <EmptyTitle>No QC runs</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left">Analyte</th>
                            <th className="px-4 py-3 text-left">Level</th>
                            <th className="px-4 py-3 text-right">Mean</th>
                            <th className="px-4 py-3 text-right">SD</th>
                            <th className="px-4 py-3 text-right">Value</th>
                            <th className="px-4 py-3 text-right">Z</th>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Operator</th>
                            <th className="px-4 py-3 text-left">Westgard</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredResults.map((r) => {
                            const z = (r.measuredValue - r.targetMean) / r.targetSd;
                            return (
                              <tr key={r._id} className={cn("hover:bg-muted/30", !r.accepted && "bg-red-50/50 dark:bg-red-950/10")}>
                                <td className="px-4 py-2.5 font-medium">{r.analyte}</td>
                                <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{r.controlLevel}</Badge></td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{r.targetMean.toFixed(3)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">±{r.targetSd.toFixed(3)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.measuredValue.toFixed(3)}</td>
                                <td className={cn("px-4 py-2.5 text-right tabular-nums text-xs font-mono", Math.abs(z) > 3 ? "text-red-600" : Math.abs(z) > 2 ? "text-amber-600" : "text-green-600")}>{z.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{new Date(r.runDate).toLocaleDateString()}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">{r.operatorName ?? "—"}</td>
                                <td className="px-4 py-2.5"><WestgardBadge violations={r.westgardViolations} accepted={r.accepted} /></td>
                                <td className="px-4 py-2.5">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={async () => { await deleteQc({ qcResultId: r._id }); toast.success("Deleted"); }}>
                                    <Trash2 size={13} />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Violations Log ── */}
              <TabsContent value="violations" className="mt-4">
                {!qcResults ? <Skeleton className="h-48 w-full" /> : (() => {
                  const withViolations = filteredResults.filter((r) => (r.westgardViolations?.length ?? 0) > 0);
                  if (withViolations.length === 0) return (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><CheckCircle2 /></EmptyMedia>
                        <EmptyTitle>No violations detected</EmptyTitle>
                        <EmptyDescription>All QC runs are within Westgard rule limits</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  );
                  return (
                    <div className="space-y-3">
                      {withViolations.sort((a, b) => b.runDate.localeCompare(a.runDate)).map((r) => (
                        <Card key={r._id} className={cn("border-l-4", r.accepted ? "border-l-amber-400" : "border-l-red-500")}>
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <p className="font-medium text-sm">{r.analyte} — {r.controlLevel}</p>
                                <p className="text-xs text-muted-foreground">{new Date(r.runDate).toLocaleDateString()} {r.operatorName ? `· ${r.operatorName}` : ""}</p>
                                <p className="text-xs mt-1">Value: <span className="font-mono font-semibold">{r.measuredValue.toFixed(3)}</span> (Mean: {r.targetMean.toFixed(3)} ± {r.targetSd.toFixed(3)} SD)</p>
                              </div>
                              <div className="space-y-1">
                                {r.westgardViolations?.map((v, i) => {
                                  const isReject = v.includes("reject");
                                  return (
                                    <div key={i} className={cn("text-xs px-3 py-1 rounded-full flex items-center gap-1.5", isReject ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                                      <ShieldAlert size={11} />{v}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Add QC Result Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record QC Result</DialogTitle>
          </DialogHeader>
          {effectiveInstrumentId && labId && (
            <AddQcForm
              instrumentId={effectiveInstrumentId}
              laboratoryId={labId}
              analytes={analytes ?? []}
              onClose={() => setShowAddForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageGuard>
  );
}
