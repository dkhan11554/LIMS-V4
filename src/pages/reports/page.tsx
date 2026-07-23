import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, FileBarChart2, FlaskConical, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

// ── Colour palette ────────────────────────────────────────────────────────
const COLOURS = [
  "oklch(0.45 0.14 220)",
  "oklch(0.52 0.13 180)",
  "oklch(0.65 0.16 75)",
  "oklch(0.55 0.18 145)",
  "oklch(0.55 0.20 25)",
  "oklch(0.55 0.16 285)",
  "oklch(0.60 0.14 250)",
  "oklch(0.60 0.15 120)",
];

const REPORT_TYPES = [
  { value: "sample_summary",    label: "Sample Summary"          },
  { value: "status_breakdown",  label: "Status Breakdown"        },
  { value: "priority_report",   label: "Priority Report"         },
  { value: "tat_report",        label: "Turnaround Time Report"  },
  { value: "customer_activity", label: "Customer Activity"       },
] as const;

type ReportType = typeof REPORT_TYPES[number]["value"];

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(rows, { header: true });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("CSV downloaded");
}

export default function ReportsPage() {
  const { labId } = useActiveLab();
  const [reportType, setReportType] = useState<ReportType>("sample_summary");

  const stats = useQuery(api.samples.getDashboardStats, labId ? { laboratoryId: labId } : "skip");
  const allSamples = useQuery(api.samples.listSamples, labId ? { laboratoryId: labId } : "skip");
  const customers = useQuery(api.customers.listCustomers, labId ? { laboratoryId: labId } : "skip");

  const isLoading = stats === undefined || allSamples === undefined;

  // ── Status breakdown data ────────────────────────────────────────────────
  const statusData = stats
    ? Object.entries(stats.statusCounts)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({
          name: name.replace(/_/g, " "),
          rawName: name,
          value,
          fill: COLOURS[i % COLOURS.length],
        }))
    : [];

  // ── Priority data ────────────────────────────────────────────────────────
  const priorityData = stats
    ? [
        { name: "Routine", value: stats.byPriority.routine, fill: COLOURS[0] },
        { name: "Urgent",  value: stats.byPriority.urgent,  fill: COLOURS[2] },
        { name: "STAT",    value: stats.byPriority.stat,    fill: COLOURS[4] },
      ]
    : [];

  // ── Customer activity ────────────────────────────────────────────────────
  const customerActivity = (() => {
    if (!allSamples || !customers) return [];
    const map = new Map<string, { name: string; total: number; completed: number; pending: number }>();
    for (const s of allSamples) {
      const existing = map.get(s.customerId) ?? { name: s.customerName, total: 0, completed: 0, pending: 0 };
      existing.total += 1;
      if (["approved", "coa_generated", "delivered"].includes(s.status)) existing.completed += 1;
      else existing.pending += 1;
      map.set(s.customerId, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  })();

  // ── Volume by day ────────────────────────────────────────────────────────
  const volumeData = stats?.volumeByDay.slice(-30).filter((d) => d.count > 0) ?? [];

  // ── Export handlers ──────────────────────────────────────────────────────
  const handleExport = () => {
    if (!allSamples || !stats) return;
    const today = new Date().toISOString().split("T")[0];

    if (reportType === "sample_summary" || reportType === "status_breakdown" || reportType === "priority_report") {
      const rows = allSamples.map((s) => ({
        "LIMS Number": s.limsNumber,
        "Sample Name": s.sampleName,
        "Customer": s.customerName,
        "Status": s.status,
        "Priority": s.priority,
        "Received Date": s.receivedDate ?? "",
        "Requested Completion": s.requestedCompletionDate ?? "",
        "Batch Number": s.batchNumber ?? "",
        "Product": s.product ?? "",
      }));
      downloadCsv(rows, `sample-report-${today}.csv`);
    } else if (reportType === "customer_activity") {
      downloadCsv(customerActivity as unknown as Record<string, unknown>[], `customer-activity-${today}.csv`);
    } else if (reportType === "tat_report") {
      const rows = volumeData.map((d) => ({ Date: d.date, "Samples Registered": d.count }));
      downloadCsv(rows, `volume-report-${today}.csv`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart2 size={22} className="text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analytics, trend charts, and data exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={isLoading} className="gap-2">
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Samples", value: stats?.total, icon: <FlaskConical size={15} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Completed",     value: stats?.completed, icon: <CheckCircle2 size={15} />, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Overdue",       value: stats?.overdue, icon: <AlertTriangle size={15} />, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Avg TAT (days)", value: stats?.avgTatDays, icon: <Clock size={15} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  {isLoading
                    ? <Skeleton className="h-7 w-14 mt-1" />
                    : <p className="text-2xl font-bold mt-0.5">{k.value ?? 0}</p>
                  }
                </div>
                <div className={`p-2 rounded-lg ${k.bg} ${k.color}`}>{k.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Report-specific views ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          {(reportType === "sample_summary" || reportType === "status_breakdown") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status bar chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Samples by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={statusData} layout="vertical" margin={{ left: 60, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" width={70} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Status pie */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        innerRadius={44}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: unknown, n: unknown) => [v as number, n as string]} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Sample table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">All Samples</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <SampleTable samples={allSamples} />
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === "priority_report" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Samples by Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={priorityData} margin={{ top: 4, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {priorityData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Priority Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 pt-2">
                    {priorityData.map((p) => {
                      const pct = stats.total > 0 ? Math.round((p.value / stats.total) * 100) : 0;
                      return (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground">{p.value} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.fill }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Samples List (Priority View)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <SampleTable samples={allSamples} sortByPriority />
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === "tat_report" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Daily Sample Volume (Last 30 Days)</CardTitle>
                    <Badge variant="secondary">
                      Total: {volumeData.reduce((s, d) => s + d.count, 0)} samples
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={volumeData} margin={{ top: 4, right: 10, bottom: 20, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill={COLOURS[0]} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Turnaround Time Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                    {[
                      { label: "Average TAT", value: `${stats.avgTatDays}d` },
                      { label: "Completed", value: stats.completed },
                      { label: "In Progress", value: stats.inProgress },
                      { label: "Overdue", value: stats.overdue },
                    ].map((item) => (
                      <div key={item.label} className="text-center border border-border rounded-lg py-4">
                        <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === "customer_activity" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Customers by Sample Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {customerActivity.length === 0 ? (
                    <p className="text-center py-10 text-muted-foreground text-sm">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={customerActivity}
                        margin={{ top: 4, right: 10, bottom: 40, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9 }}
                          angle={-30}
                          textAnchor="end"
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="completed" stackId="a" fill={COLOURS[3]} radius={[0, 0, 0, 0]} name="Completed" />
                        <Bar dataKey="pending"   stackId="a" fill={COLOURS[0]} radius={[3, 3, 0, 0]} name="In Progress" />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Customer table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Customer Summary Table</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Customer</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Completed</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Pending</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Completion %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customerActivity.map((c, i) => {
                          const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
                          return (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium">{c.name}</td>
                              <td className="px-4 py-2.5 text-center tabular-nums">{c.total}</td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-green-600 dark:text-green-400 font-semibold">{c.completed}</td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{c.pending}</td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {customerActivity.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No data</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sample table sub-component ─────────────────────────────────────────────
type SampleRow = {
  _id: string;
  limsNumber: string;
  sampleName: string;
  customerName: string;
  status: string;
  priority: string;
  receivedDate?: string;
  requestedCompletionDate?: string;
};

function SampleTable({ samples, sortByPriority = false }: { samples: SampleRow[]; sortByPriority?: boolean }) {
  const PRIORITY_ORDER: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
  const rows = sortByPriority
    ? [...samples].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
    : samples;

  return (
    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">LIMS #</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Sample</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Customer</th>
            <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Priority</th>
            <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => {
            const isOverdue =
              s.requestedCompletionDate &&
              new Date(s.requestedCompletionDate) < new Date() &&
              !["approved", "coa_generated", "delivered", "cancelled"].includes(s.status);
            return (
              <tr key={s._id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{s.limsNumber}</td>
                <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{s.sampleName}</td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[140px] truncate">{s.customerName}</td>
                <td className="px-4 py-2.5 text-center"><StatusBadge status={s.priority} /></td>
                <td className="px-4 py-2.5 text-center"><StatusBadge status={s.status} /></td>
                <td className={`px-4 py-2.5 text-center text-xs ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                  {s.requestedCompletionDate
                    ? new Date(s.requestedCompletionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "—"}
                  {isOverdue && " ⚠"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No samples found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
