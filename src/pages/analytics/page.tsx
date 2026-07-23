import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { cn } from "@/lib/utils.ts";
import { motion } from "motion/react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import {
  BarChart2, TrendingUp, Target, FlaskConical, CheckCircle2,
  AlertTriangle, Clock, Users, DollarSign, Download, Filter,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ShieldCheck,
  Activity, Microscope
} from "lucide-react";
import { format, subDays, subMonths, startOfDay, endOfDay, parseISO } from "date-fns";
import Papa from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = "7d" | "30d" | "90d" | "6m" | "12m";

const DATE_RANGE_OPTS: { id: DateRange; label: string }[] = [
  { id: "7d",  label: "7 days"   },
  { id: "30d", label: "30 days"  },
  { id: "90d", label: "90 days"  },
  { id: "6m",  label: "6 months" },
  { id: "12m", label: "12 months"},
];

function getDateRange(range: DateRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const to = format(endOfDay(now), "yyyy-MM-dd");
  const from = {
    "7d":  format(subDays(now, 7),   "yyyy-MM-dd"),
    "30d": format(subDays(now, 30),  "yyyy-MM-dd"),
    "90d": format(subDays(now, 90),  "yyyy-MM-dd"),
    "6m":  format(subMonths(now, 6), "yyyy-MM-dd"),
    "12m": format(subMonths(now, 12),"yyyy-MM-dd"),
  }[range];
  return { fromDate: from, toDate: to };
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  primary:  "hsl(220 60% 45%)",
  teal:     "hsl(178 60% 38%)",
  green:    "hsl(142 60% 42%)",
  amber:    "hsl(38 90% 50%)",
  red:      "hsl(0 72% 51%)",
  purple:   "hsl(270 60% 50%)",
  gray:     "hsl(220 10% 60%)",
};

const PIE_COLORS = [
  CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.green,
  CHART_COLORS.amber,   CHART_COLORS.purple, CHART_COLORS.red,
  CHART_COLORS.gray,    "#f59e0b",
];

const STATUS_COLORS: Record<string, string> = {
  registered:       CHART_COLORS.gray,
  accepted:         CHART_COLORS.teal,
  testing:          CHART_COLORS.primary,
  pending_review:   CHART_COLORS.amber,
  pending_qa:       CHART_COLORS.amber,
  approved:         CHART_COLORS.green,
  coa_generated:    CHART_COLORS.green,
  delivered:        CHART_COLORS.green,
  rejected:         CHART_COLORS.red,
  oos_investigation:CHART_COLORS.red,
  cancelled:        CHART_COLORS.gray,
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

type KpiTrend = "up" | "down" | "flat";
function KpiCard({
  label, value, sub, trend, trendGood, color, icon
}: {
  label: string; value: string | number; sub?: string;
  trend?: KpiTrend; trendGood?: "up" | "down";
  color?: string; icon: React.ReactNode;
}) {
  const trendColor =
    trend === "flat" ? "text-muted-foreground" :
    (trend === "up") === (trendGood === "up") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color ? "bg-primary/10" : "bg-muted")}>
              {icon}
            </div>
          </div>
          {trend && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trendColor)}>
              <TrendIcon size={13} /><span>{trend === "flat" ? "No change" : trend === "up" ? "Trending up" : "Trending down"}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Tooltip formatter ────────────────────────────────────────────────────────

function ttFmt(v: unknown): string {
  return typeof v === "number" ? String(Math.round(v * 10) / 10) : String(v);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(data: object[], filename: string) {
  const csv = Papa.unparse(data);
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── SLA gauge ────────────────────────────────────────────────────────────────

function SlaGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? CHART_COLORS.green : rate >= 70 ? CHART_COLORS.amber : CHART_COLORS.red;
  const data = [{ value: rate, fill: color }, { value: 100 - rate, fill: "transparent" }];
  return (
    <div className="relative flex flex-col items-center">
      <RadialBarChart
        width={160} height={90}
        cx={80} cy={80}
        innerRadius={55} outerRadius={75}
        startAngle={180} endAngle={0}
        data={[{ value: rate, fill: color }]}
        barSize={16}
      >
        <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }} />
      </RadialBarChart>
      <div className="absolute bottom-0 text-center">
        <p className="text-2xl font-bold" style={{ color }}>{rate}%</p>
        <p className="text-xs text-muted-foreground -mt-0.5">SLA Compliance</p>
      </div>
    </div>
  );
}

// ─── Main inner component ─────────────────────────────────────────────────────

function AnalyticsInner() {
  const { labId } = useActiveLab();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedTab, setSelectedTab] = useState<"overview" | "quality" | "analysts" | "revenue">("overview");

  const { fromDate, toDate } = getDateRange(dateRange);

  const customers = useQuery(api.customers.listCustomers, labId ? { laboratoryId: labId as never } : "skip");
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>(undefined);

  const analyticsArgs = labId
    ? { laboratoryId: labId as never, fromDate, toDate, customerId: selectedCustomer as never }
    : "skip";
  const data = useQuery(api.analytics.getAnalytics, analyticsArgs);

  const loading = data === undefined;

  // Truncate day labels for chart
  const volumeData = useMemo(() => {
    if (!data) return [];
    const src = dateRange === "7d" || dateRange === "30d"
      ? data.sampleVolumeByDay
      : data.sampleVolumeByWeek.map((w) => ({ date: w.week, count: w.count, completed: w.completed }));
    return src.map((d) => ({
      ...d,
      label: dateRange === "12m" || dateRange === "6m"
        ? `W ${d.date.slice(5)}`
        : d.date.slice(5), // MM-DD
    }));
  }, [data, dateRange]);

  const tabs = [
    { id: "overview" as const,  label: "Overview",      icon: <BarChart2 size={13} /> },
    { id: "quality"  as const,  label: "Quality",       icon: <ShieldCheck size={13} /> },
    { id: "analysts" as const,  label: "Analysts",      icon: <Users size={13} /> },
    { id: "revenue"  as const,  label: "Revenue",       icon: <DollarSign size={13} /> },
  ];

  const fmtCcy = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  function handleExport() {
    if (!data) return;
    exportCsv(data.sampleVolumeByDay, `sample-volume-${fromDate}-${toDate}.csv`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">KPI dashboards · SLA compliance · Trends</p>
          </div>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          {/* Date range picker */}
          <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
            {DATE_RANGE_OPTS.map((opt) => (
              <button key={opt.id} onClick={() => setDateRange(opt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  dateRange === opt.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                {opt.label}
              </button>
            ))}
          </div>
          {/* Customer filter */}
          <select
            value={selectedCustomer ?? ""}
            onChange={(e) => setSelectedCustomer(e.target.value || undefined)}
            className="h-9 rounded-xl border bg-background text-sm px-3 text-foreground"
          >
            <option value="">All customers</option>
            {(customers ?? []).map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <Button size="sm" variant="secondary" onClick={handleExport} disabled={loading}>
            <Download size={13} className="mr-1" />Export CSV
          </Button>
        </div>
      </div>

      {/* Top KPI strip */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Samples"    value={data.totalSamples}    icon={<FlaskConical size={16} className="text-primary" />} />
          <KpiCard label="Completed"        value={data.totalCompleted}  icon={<CheckCircle2 size={16} className="text-green-500" />} color="text-green-600 dark:text-green-400" />
          <KpiCard label="SLA Compliance"   value={`${data.slaComplianceRate}%`} icon={<Target size={16} className="text-teal-500" />}
            color={data.slaComplianceRate >= 90 ? "text-green-600 dark:text-green-400" : data.slaComplianceRate >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}
            sub={`${data.slaCompliant} compliant · ${data.slaBreach} breached`}
          />
          <KpiCard label="Total Tests"      value={data.totalTests}      icon={<Microscope size={16} className="text-purple-500" />} />
          <KpiCard label="OOS Rate"         value={`${data.oosRate}%`}   icon={<AlertTriangle size={16} className="text-red-500" />}
            color={data.oosRate === 0 ? "text-green-600 dark:text-green-400" : data.oosRate > 5 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}
            sub={`${data.oosCount} OOS tests`}
          />
          <KpiCard label="Revenue"          value={fmtCcy(data.totalRevenue)} icon={<DollarSign size={16} className="text-yellow-500" />} />
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setSelectedTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              selectedTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── OVERVIEW ── */}
          {selectedTab === "overview" && (
            <div className="space-y-6">
              {/* Sample volume over time */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <SectionHeader title="Sample Volume Over Time" subtitle="Registered vs. completed samples" icon={<TrendingUp size={15} />} />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={volumeData}>
                      <defs>
                        <linearGradient id="gradReg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradComp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.teal}    stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_COLORS.teal}    stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(v: unknown, n: unknown) => [ttFmt(v), n === "count" ? "Registered" : "Completed"]} />
                      <Legend formatter={(v: unknown) => v === "count" ? "Registered" : "Completed"} />
                      <Area type="monotone" dataKey="count"     stroke={CHART_COLORS.primary} fill="url(#gradReg)"  strokeWidth={2} />
                      <Area type="monotone" dataKey="completed" stroke={CHART_COLORS.teal}    fill="url(#gradComp)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SLA compliance gauge + TAT trend */}
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="SLA & TAT Trend" subtitle="Weekly SLA compliance rate and average TAT" icon={<Target size={15} />} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-center">
                      <SlaGauge rate={data.slaComplianceRate} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-2">
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">{data.slaCompliant}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Compliant</p>
                      </div>
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-2">
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">{data.slaBreach}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Breached</p>
                      </div>
                      <div className="rounded-xl bg-muted p-2">
                        <p className="text-xl font-bold">{data.slaMissing}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">No deadline</p>
                      </div>
                    </div>
                    {data.tatTrendByWeek.length > 0 && (
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={data.tatTrendByWeek}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickFormatter={(v: string) => v.slice(5)} />
                          <YAxis yAxisId="tat" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="sla" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <Tooltip formatter={(v: unknown, n: unknown) => [ttFmt(v), n === "avgTat" ? "Avg TAT (days)" : "SLA %"]} />
                          <Line yAxisId="tat" type="monotone" dataKey="avgTat"         stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} name="avgTat" />
                          <Line yAxisId="sla" type="monotone" dataKey="slaCompliance"  stroke={CHART_COLORS.green}   strokeWidth={2} dot={false} strokeDasharray="4 2" name="slaCompliance" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Status breakdown + priority */}
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="Sample Status Breakdown" subtitle="Current distribution across all statuses" icon={<Activity size={15} />} />
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.statusBreakdown.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} width={120}
                          tickFormatter={(v: string) => v.replace(/_/g, " ")} />
                        <Tooltip formatter={(v: unknown) => [ttFmt(v), "Samples"]} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {data.statusBreakdown.slice(0, 8).map((entry, i) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS.gray} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {data.priorityBreakdown.map((p) => {
                        const colors = { routine: "bg-gray-100 text-gray-600", urgent: "bg-orange-100 text-orange-700", stat: "bg-red-100 text-red-700" };
                        const c = colors[p.priority as keyof typeof colors] ?? "bg-muted text-foreground";
                        return (
                          <span key={p.priority} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", c)}>
                            {p.priority.toUpperCase()} <span className="font-bold">{p.count}</span>
                          </span>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* TAT distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="TAT Distribution" subtitle="Histogram of turnaround times (completed samples)" icon={<Clock size={15} />} />
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.tatDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip formatter={(v: unknown) => [ttFmt(v), "Samples"]} />
                        <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top customers */}
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="Top Customers" subtitle="By sample volume in selected period" icon={<Users size={15} />} />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      {data.topCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No data in this period.</p>
                      ) : (
                        data.topCustomers.slice(0, 6).map((c, i) => {
                          const pct = data.totalSamples > 0 ? (c.sampleCount / data.totalSamples) * 100 : 0;
                          return (
                            <div key={c.customerId}>
                              <div className="flex items-center justify-between text-sm mb-0.5">
                                <span className="font-medium truncate max-w-[60%]">{c.customerName}</span>
                                <span className="text-muted-foreground text-xs">{c.sampleCount} samples</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── QUALITY ── */}
          {selectedTab === "quality" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "OOS Rate",            value: `${data.oosRate}%`,   color: data.oosRate > 5 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", icon: <AlertTriangle size={15} className="text-red-500" /> },
                  { label: "OOS Events",           value: data.oosCount,        color: "", icon: <AlertTriangle size={15} /> },
                  { label: "Open CAPAs",           value: data.capasByStatus.find((c) => c.status === "open")?.count ?? 0, color: "", icon: <Target size={15} /> },
                  { label: "Critical Deviations",  value: data.deviationsBySeverity.find((d) => d.severity === "critical")?.count ?? 0, color: "text-red-600 dark:text-red-400", icon: <AlertTriangle size={15} className="text-red-500" /> },
                ].map((m) => (
                  <Card key={m.label} className="border">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="shrink-0">{m.icon}</div>
                      <div>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className={cn("text-xl font-bold", m.color)}>{m.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* OOS rate trend */}
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="OOS Rate by Month" subtitle="Monthly OOS rate trend" icon={<TrendingUp size={15} />} />
                  </CardHeader>
                  <CardContent>
                    {data.oosByMonth.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">No OOS data in this period.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.oosByMonth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="count" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: unknown, n: unknown) => [ttFmt(v), n === "count" ? "OOS Count" : "OOS Rate %"]} />
                          <Bar yAxisId="count" dataKey="count" fill={CHART_COLORS.red}    radius={[4,4,0,0]} name="count" />
                          <Line yAxisId="rate" type="monotone" dataKey="rate" stroke={CHART_COLORS.amber} strokeWidth={2} name="rate" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* CAPA status pie + deviations severity */}
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="CAPA Status & Deviations" subtitle="CAPA pipeline and deviation severity breakdown" icon={<ShieldCheck size={15} />} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">CAPA by Status</p>
                        {data.capasByStatus.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No CAPAs.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {data.capasByStatus.map((c, i) => (
                              <div key={c.status} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                  <span className="capitalize text-xs">{c.status.replace(/_/g," ")}</span>
                                </div>
                                <span className="font-bold text-xs">{c.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Deviations by Severity</p>
                        {data.deviationsBySeverity.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No deviations.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {data.deviationsBySeverity.map((d) => {
                              const colors: Record<string, string> = { critical: "bg-red-500", major: "bg-orange-400", minor: "bg-yellow-400" };
                              return (
                                <div key={d.severity} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn("w-2 h-2 rounded-full", colors[d.severity] ?? "bg-gray-400")} />
                                    <span className="capitalize text-xs">{d.severity}</span>
                                  </div>
                                  <span className="font-bold text-xs">{d.count}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {data.oosRootCauses.length > 0 && (
                      <>
                        <div className="border-t pt-3">
                          <p className="text-xs text-muted-foreground mb-2 font-medium">OOS Root Cause Categories</p>
                          <div className="space-y-1.5">
                            {data.oosRootCauses.slice(0, 6).map((rc, i) => (
                              <div key={rc.category} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                                <span className="text-xs flex-1 truncate">{rc.category}</span>
                                <span className="text-xs font-bold">{rc.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Export quality data */}
              <div className="flex justify-end">
                <Button size="sm" variant="secondary"
                  onClick={() => exportCsv(data.oosByMonth, `oos-trend-${fromDate}-${toDate}.csv`)}>
                  <Download size={13} className="mr-1" />Export OOS Trend CSV
                </Button>
              </div>
            </div>
          )}

          {/* ── ANALYSTS ── */}
          {selectedTab === "analysts" && (
            <div className="space-y-6">
              <Card className="border">
                <CardHeader className="pb-2">
                  <SectionHeader title="Analyst Performance" subtitle="Tests completed, OOS events, and average turnaround per analyst" icon={<Users size={15} />} />
                </CardHeader>
                <CardContent>
                  {data.analystPerformance.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Users size={36} className="mx-auto mb-3 opacity-30" />
                      <p>No analyst data in this period. Results with assigned analysts will appear here.</p>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.analystPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="analystName" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip formatter={(v: unknown, n: unknown) => [ttFmt(v), n === "testsCompleted" ? "Tests Completed" : n === "testsOos" ? "OOS Events" : "Avg Hrs"]} />
                          <Legend formatter={(v: unknown) => v === "testsCompleted" ? "Completed" : v === "testsOos" ? "OOS" : "Avg Hours"} />
                          <Bar dataKey="testsCompleted" fill={CHART_COLORS.teal}    radius={[4,4,0,0]} name="testsCompleted" />
                          <Bar dataKey="testsOos"       fill={CHART_COLORS.red}     radius={[4,4,0,0]} name="testsOos" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Analyst</th>
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground text-right">Tests Completed</th>
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground text-right">OOS Events</th>
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground text-right">OOS Rate</th>
                              <th className="py-2 text-xs font-semibold text-muted-foreground text-right">Avg Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.analystPerformance.map((a) => {
                              const oosR = a.testsCompleted + a.testsOos > 0
                                ? ((a.testsOos / (a.testsCompleted + a.testsOos)) * 100).toFixed(1)
                                : "0.0";
                              return (
                                <tr key={a.analystId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                  <td className="py-2.5 pr-4 font-medium">{a.analystName}</td>
                                  <td className="py-2.5 pr-4 text-right text-green-600 dark:text-green-400 font-bold">{a.testsCompleted}</td>
                                  <td className="py-2.5 pr-4 text-right text-red-600 dark:text-red-400 font-bold">{a.testsOos}</td>
                                  <td className="py-2.5 pr-4 text-right">
                                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
                                      parseFloat(oosR) === 0 ? "bg-green-100 text-green-700" :
                                      parseFloat(oosR) > 10 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                    )}>{oosR}%</span>
                                  </td>
                                  <td className="py-2.5 text-right text-muted-foreground">{a.avgTurnaroundHours > 0 ? `${a.avgTurnaroundHours}h` : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button size="sm" variant="secondary"
                          onClick={() => exportCsv(data.analystPerformance, `analyst-performance-${fromDate}-${toDate}.csv`)}>
                          <Download size={13} className="mr-1" />Export CSV
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* TAT by category */}
              {data.avgTatByCategory.length > 0 && (
                <Card className="border">
                  <CardHeader className="pb-2">
                    <SectionHeader title="Avg TAT by Test Category" subtitle="Average turnaround days per test category" icon={<Clock size={15} />} />
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.avgTatByCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip formatter={(v: unknown) => [`${ttFmt(v)} days`, "Avg TAT"]} />
                        <Bar dataKey="avgTat" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]}>
                          {data.avgTatByCategory.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── REVENUE ── */}
          {selectedTab === "revenue" && (
            <div className="space-y-6">
              <Card className="border">
                <CardHeader className="pb-2">
                  <SectionHeader title="Revenue by Month" subtitle="Invoiced vs. collected payments" icon={<DollarSign size={15} />} />
                </CardHeader>
                <CardContent>
                  {data.revenueByMonth.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <DollarSign size={36} className="mx-auto mb-3 opacity-30" />
                      <p>No invoices in this period. Create invoices in the Billing section.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.revenueByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: unknown) => `$${(Number(v)/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: unknown, n: unknown) => [fmtCcy(Number(v)), n === "invoiced" ? "Invoiced" : "Collected"]} />
                        <Legend formatter={(v: unknown) => v === "invoiced" ? "Invoiced" : "Collected"} />
                        <Bar dataKey="invoiced" fill={CHART_COLORS.primary} radius={[4,4,0,0]} name="invoiced" />
                        <Bar dataKey="paid"     fill={CHART_COLORS.green}   radius={[4,4,0,0]} name="paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Customer revenue table */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <SectionHeader title="Top Customers by Sample Volume" subtitle="Completed vs. total samples per customer" icon={<Users size={15} />} />
                </CardHeader>
                <CardContent>
                  {data.topCustomers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No samples in this period.</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Customer</th>
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground text-right">Total Samples</th>
                              <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground text-right">Completed</th>
                              <th className="py-2 text-xs font-semibold text-muted-foreground text-right">Completion Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.topCustomers.map((c) => {
                              const rate = c.sampleCount > 0
                                ? Math.round((c.completedCount / c.sampleCount) * 100)
                                : 0;
                              return (
                                <tr key={c.customerId} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2.5 pr-4 font-medium">{c.customerName}</td>
                                  <td className="py-2.5 pr-4 text-right">{c.sampleCount}</td>
                                  <td className="py-2.5 pr-4 text-right text-green-600 dark:text-green-400">{c.completedCount}</td>
                                  <td className="py-2.5 text-right">
                                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
                                      rate >= 90 ? "bg-green-100 text-green-700" :
                                      rate >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                    )}>{rate}%</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button size="sm" variant="secondary"
                          onClick={() => exportCsv(data.topCustomers, `customer-volume-${fromDate}-${toDate}.csv`)}>
                          <Download size={13} className="mr-1" />Export CSV
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-64"><Skeleton className="h-8 w-40" /></div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Please sign in to view analytics.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <PageGuard allowed={["system_admin", "lab_manager", "supervisor"]}>
          <AnalyticsInner />
        </PageGuard>
      </Authenticated>
    </>
  );
}
