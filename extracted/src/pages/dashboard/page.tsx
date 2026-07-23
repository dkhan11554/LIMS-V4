import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  FlaskConical, ClipboardCheck, Clock, AlertTriangle,
  CheckCircle2, TestTube, Users, TrendingUp, FileBarChart2,
  ArrowRight, Timer,
} from "lucide-react";
import { motion } from "motion/react";

// ── Colour palette for charts ──────────────────────────────────────────────
const CHART_PRIMARY = "oklch(0.45 0.14 220)";
const CHART_TEAL    = "oklch(0.52 0.13 180)";
const CHART_AMBER   = "oklch(0.65 0.16 75)";
const CHART_RED     = "oklch(0.55 0.20 25)";
const CHART_GREEN   = "oklch(0.55 0.18 145)";
const CHART_PURPLE  = "oklch(0.55 0.16 285)";

const STATUS_COLOURS: Record<string, string> = {
  registered:      CHART_TEAL,
  received:        CHART_PRIMARY,
  accepted:        CHART_PRIMARY,
  assigned:        CHART_PURPLE,
  testing:         CHART_PURPLE,
  pending_review:  CHART_AMBER,
  pending_qa:      CHART_AMBER,
  approved:        CHART_GREEN,
  coa_generated:   CHART_GREEN,
  delivered:       CHART_GREEN,
  rejected:        CHART_RED,
  oos_investigation: CHART_RED,
};

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon, accent, href, isLoading,
}: {
  title: string;
  value: string | number | undefined;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  href?: string;
  isLoading: boolean;
}) {
  const inner = (
    <Card className={`relative overflow-hidden transition-all ${href ? "hover:shadow-md cursor-pointer" : ""}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            {isLoading ? (
              <Skeleton className="h-9 w-20 mt-1.5" />
            ) : (
              <p className="text-3xl font-bold mt-1 tabular-nums">{value ?? 0}</p>
            )}
            {sub && !isLoading && (
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${accent}`}>{icon}</div>
        </div>
      </CardContent>
      {/* accent stripe */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accent.replace("bg-", "bg-").replace("/20", "")}`} />
    </Card>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

// ── Section wrapper with fade-in ──────────────────────────────────────────
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ── Custom tooltip for area chart ─────────────────────────────────────────
function VolumeTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-primary">{payload[0].value} sample{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { labId } = useActiveLab();
  const stats = useQuery(api.samples.getDashboardStats, labId ? { laboratoryId: labId } : "skip");
  const isLoading = stats === undefined;

  // Build pie data from status counts
  const pieData = stats
    ? Object.entries(stats.statusCounts)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({
          name: name.replace(/_/g, " "),
          value,
          fill: STATUS_COLOURS[name] ?? CHART_TEAL,
        }))
    : [];

  // Priority bar data
  const priorityData = stats
    ? [
        { name: "Routine", count: stats.byPriority.routine, fill: CHART_PRIMARY },
        { name: "Urgent",  count: stats.byPriority.urgent,  fill: CHART_AMBER },
        { name: "STAT",    count: stats.byPriority.stat,    fill: CHART_RED },
      ]
    : [];

  // Volume chart: last 14 days (trim to keep chart readable)
  const volumeData = stats?.volumeByDay.slice(-14).map((d) => ({
    date: d.date.slice(5), // MM-DD
    count: d.count,
  })) ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <Section>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Laboratory overview and key metrics</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/reports" className="gap-1.5">
                <FileBarChart2 size={14} /> Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/samples/register" className="gap-1.5">
                <FlaskConical size={14} /> Register Sample
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* KPI Cards */}
      <Section delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard
            title="Total Samples"
            value={stats?.total}
            icon={<FlaskConical size={18} className="text-blue-600 dark:text-blue-400" />}
            accent="bg-blue-50 dark:bg-blue-900/20"
            isLoading={isLoading}
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress}
            icon={<TestTube size={18} className="text-purple-600 dark:text-purple-400" />}
            accent="bg-purple-50 dark:bg-purple-900/20"
            href="/laboratory/work-assignment"
            isLoading={isLoading}
          />
          <StatCard
            title="Pending Review"
            value={stats?.pendingReview}
            icon={<ClipboardCheck size={18} className="text-amber-600 dark:text-amber-400" />}
            accent="bg-amber-50 dark:bg-amber-900/20"
            href="/quality/technical-review"
            isLoading={isLoading}
          />
          <StatCard
            title="Completed"
            value={stats?.completed}
            icon={<CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />}
            accent="bg-green-50 dark:bg-green-900/20"
            isLoading={isLoading}
          />
          <StatCard
            title="Overdue"
            value={stats?.overdue}
            icon={<AlertTriangle size={18} className="text-red-600 dark:text-red-400" />}
            accent="bg-red-50 dark:bg-red-900/20"
            isLoading={isLoading}
          />
          <StatCard
            title="Avg TAT"
            value={isLoading ? undefined : `${stats?.avgTatDays ?? 0}d`}
            sub="days to complete"
            icon={<Timer size={18} className="text-teal-600 dark:text-teal-400" />}
            accent="bg-teal-50 dark:bg-teal-900/20"
            isLoading={isLoading}
          />
        </div>
      </Section>

      {/* Charts row */}
      <Section delay={0.1}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Volume over time */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" /> Sample Volume (last 14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <AreaChart data={volumeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_PRIMARY} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip content={<VolumeTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={CHART_PRIMARY}
                      strokeWidth={2}
                      fill="url(#volGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users size={15} className="text-primary" /> Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : pieData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={62}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: unknown, n: unknown) => [v as number, n as string]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1">
                    {pieData.slice(0, 5).map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
                        <span className="flex-1 capitalize truncate text-muted-foreground">{d.name}</span>
                        <span className="font-semibold tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Priority chart + recent activity */}
      <Section delay={0.15}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Priority bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock size={15} className="text-primary" /> Priority Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-36 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={144}>
                  <BarChart data={priorityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {priorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent activity feed */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FlaskConical size={15} className="text-primary" /> Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                  <Link to="/samples">All Samples <ArrowRight size={12} /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !stats?.recentSamples?.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No samples yet.{" "}
                  <Link to="/samples/register" className="text-primary hover:underline">Register one</Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.recentSamples.map((s) => (
                    <Link
                      key={s._id}
                      to={`/samples/${s._id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FlaskConical size={13} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-mono font-semibold text-primary shrink-0">{s.limsNumber}</span>
                          <span className="text-xs text-muted-foreground truncate">{s.sampleName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.customerName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={s.priority} />
                        <StatusBadge status={s.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Quick actions */}
      <Section delay={0.2}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { label: "Register Sample",    href: "/samples/register",              icon: <FlaskConical size={15} /> },
              { label: "Work Assignment",    href: "/laboratory/work-assignment",     icon: <ClipboardCheck size={15} /> },
              { label: "My Tests",           href: "/laboratory/my-tests",            icon: <TestTube size={15} /> },
              { label: "Technical Review",   href: "/quality/technical-review",       icon: <ClipboardCheck size={15} /> },
              { label: "QA Approval",        href: "/quality/qa-approval",            icon: <CheckCircle2 size={15} /> },
              { label: "Reports",            href: "/reports",                         icon: <FileBarChart2 size={15} /> },
            ].map((a) => (
              <Button key={a.href} variant="secondary" className="h-auto py-3 flex-col gap-1.5 text-xs" asChild>
                <Link to={a.href}>
                  {a.icon}
                  {a.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
