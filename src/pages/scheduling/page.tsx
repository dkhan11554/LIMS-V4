/**
 * Scheduling & Capacity Planning page.
 *
 * Three tabs:
 *  1. Calendar  — weekly/monthly grid; sample deadlines, calibrations, maintenance
 *  2. Workload  — per-analyst bar chart + capacity cards + drag-to-reassign board
 *  3. Capacity  — week-at-a-glance heatmap; overload alerts
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { cn } from "@/lib/utils.ts";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Users, AlertTriangle,
  FlaskConical, Gauge, Wrench, BarChart3, Calendar, Target,
  ArrowRight, CheckCircle2, Clock, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  format, addDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday, parseISO, isBefore,
} from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarView = "week" | "month";
type PageTab = "calendar" | "workload" | "capacity";

type CalEvent = {
  id: string;
  type: "sample_deadline" | "calibration" | "maintenance";
  date: string;
  title: string;
  subtitle: string;
  status: string;
  priority: string;
  refId: string;
  href: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  sample_deadline: {
    bg:   "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-800 dark:text-blue-300",
    dot:  "bg-blue-500",
  },
  calibration: {
    bg:   "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-800 dark:text-purple-300",
    dot:  "bg-purple-500",
  },
  maintenance: {
    bg:   "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-800 dark:text-orange-300",
    dot:  "bg-orange-500",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  stat:    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  urgent:  "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  routine: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

const CAPACITY_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

function capacityColor(pct: number): string {
  if (pct < 40) return CAPACITY_COLORS[0];
  if (pct < 60) return CAPACITY_COLORS[1];
  if (pct < 80) return CAPACITY_COLORS[2];
  if (pct < 100) return CAPACITY_COLORS[3];
  return CAPACITY_COLORS[4];
}

// ─── SortableTestCard (drag-to-reassign) ──────────────────────────────────────

type PendingTest = {
  _id: string;
  sampleLimsNumber: string;
  testName: string;
  sampleDeadline?: string;
  samplePriority: string;
  status: string;
};

function SortableTestCard({ test }: { test: PendingTest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: test._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing text-xs select-none hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-semibold text-primary">{test.sampleLimsNumber}</span>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", PRIORITY_STYLES[test.samplePriority] ?? PRIORITY_STYLES.routine)}>
          {test.samplePriority.toUpperCase()}
        </span>
      </div>
      <p className="text-muted-foreground truncate">{test.testName}</p>
      {test.sampleDeadline && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Due {format(parseISO(test.sampleDeadline), "MMM d")}
        </p>
      )}
    </div>
  );
}

// ─── CalendarCell ─────────────────────────────────────────────────────────────

function CalendarCell({
  date, events, isCurrentMonth = true,
}: {
  date: Date;
  events: CalEvent[];
  isCurrentMonth?: boolean;
}) {
  const todayClass = isToday(date) ? "bg-primary text-white" : "";
  const MAX_VISIBLE = 3;
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <div className={cn(
      "min-h-[90px] p-1.5 border-b border-r border-border",
      !isCurrentMonth && "opacity-40 bg-muted/20",
    )}>
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
        todayClass,
      )}>
        {format(date, "d")}
      </div>
      <div className="space-y-0.5">
        {visible.map((ev) => {
          const s = EVENT_TYPE_STYLES[ev.type] ?? EVENT_TYPE_STYLES.sample_deadline;
          return (
            <div
              key={ev.id}
              className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate leading-tight", s.bg, s.text)}
              title={`${ev.title}: ${ev.subtitle}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
              <span className="truncate font-medium">{ev.title}</span>
            </div>
          );
        })}
        {overflow > 0 && (
          <p className="text-[10px] text-muted-foreground pl-1">+{overflow} more</p>
        )}
      </div>
    </div>
  );
}

// ─── WeekRow ──────────────────────────────────────────────────────────────────

function WeekRow({ week, eventsByDate }: { week: Date[]; eventsByDate: Map<string, CalEvent[]> }) {
  return (
    <div className="grid grid-cols-7">
      {week.map((day) => (
        <CalendarCell
          key={day.toISOString()}
          date={day}
          events={eventsByDate.get(format(day, "yyyy-MM-dd")) ?? []}
        />
      ))}
    </div>
  );
}

// ─── CalendarTab ──────────────────────────────────────────────────────────────

function CalendarTab({ labId }: { labId: string }) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(new Date());

  const windowStart = view === "week"
    ? format(startOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : format(startOfMonth(anchor), "yyyy-MM-dd");
  const windowEnd = view === "week"
    ? format(endOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : format(endOfMonth(anchor), "yyyy-MM-dd");

  const events = useQuery(api.scheduling.getCalendarEvents, {
    laboratoryId: labId as Id<"laboratories">,
    fromDate: windowStart,
    toDate: windowEnd,
  });

  // Map date → events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events ?? []) {
      const existing = map.get(ev.date) ?? [];
      map.set(ev.date, [...existing, ev]);
    }
    return map;
  }, [events]);

  // Build calendar grid
  const days = view === "week"
    ? eachDayOfInterval({
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end:   endOfWeek(anchor, { weekStartsOn: 1 }),
      })
    : eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });

  // Pad to full weeks for month view
  const gridStart = startOfWeek(days[0], { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(days[days.length - 1], { weekStartsOn: 1 });
  const gridDays  = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Chunk into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7));
  }

  function prev() {
    setAnchor((a) => view === "week" ? subWeeks(a, 1) : subMonths(a, 1));
  }
  function next() {
    setAnchor((a) => view === "week" ? addWeeks(a, 1) : addMonths(a, 1));
  }

  // Legend summary
  const sampleCount = (events ?? []).filter((e) => e.type === "sample_deadline").length;
  const calCount    = (events ?? []).filter((e) => e.type === "calibration").length;
  const maintCount  = (events ?? []).filter((e) => e.type === "maintenance").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={prev}>
            <ChevronLeft size={15} />
          </Button>
          <span className="font-semibold text-sm min-w-[160px] text-center">
            {view === "week"
              ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`
              : format(anchor, "MMMM yyyy")}
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={next}>
            <ChevronRight size={15} />
          </Button>
        </div>
        <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <div className="ml-auto flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
          {(["week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize",
                view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: "sample_deadline", label: "Sample Deadlines", count: sampleCount, dot: "bg-blue-500" },
          { type: "calibration",     label: "Calibrations",     count: calCount,    dot: "bg-purple-500" },
          { type: "maintenance",     label: "Maintenance",      count: maintCount,  dot: "bg-orange-500" },
        ].map((l) => (
          <div key={l.type} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("w-2 h-2 rounded-full", l.dot)} />
            <span>{l.label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{l.count}</Badge>
          </div>
        ))}
      </div>

      {/* Grid */}
      {events === undefined ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card className="border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-muted/40 border-b">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <WeekRow
              key={wi}
              week={week}
              eventsByDate={eventsByDate}
            />
          ))}
        </Card>
      )}

      {/* Overdue sample deadlines banner */}
      {events && (() => {
        const today = format(new Date(), "yyyy-MM-dd");
        const overdue = events.filter(
          (e) => e.type === "sample_deadline" && e.date < today && e.status !== "coa_generated"
        );
        if (overdue.length === 0) return null;
        return (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="font-semibold">{overdue.length} overdue sample deadline{overdue.length > 1 ? "s" : ""}</span>
            <span className="text-red-500/80">— these samples have passed their requested completion date.</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── WorkloadTab ──────────────────────────────────────────────────────────────

function WorkloadTab({ labId }: { labId: string }) {
  const users = useQuery(api.users.listUsers, {});
  const reassign = useMutation(api.scheduling.reassignTest);

  const fromDate = format(new Date(), "yyyy-MM-dd");
  const toDate   = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const workload = useQuery(api.scheduling.getAnalystWorkload, {
    laboratoryId: labId as Id<"laboratories">,
    fromDate,
    toDate,
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Map analystId → analyst name/index for drop zones
  const analystOptions = workload ?? [];

  // Find dragged test across all analysts
  const activeTest = useMemo(() => {
    if (!activeId || !workload) return null;
    for (const a of workload) {
      const t = a.pendingTests.find((t) => t._id === activeId);
      if (t) return t;
    }
    return null;
  }, [activeId, workload]);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // over.id is either a test _id (same analyst) or an analyst zone id `zone-${analystId}`
    const overId = String(over.id);
    if (!overId.startsWith("zone-")) return;

    const newAnalystId = overId.replace("zone-", "");
    try {
      await reassign({
        sampleTestId: String(active.id) as Id<"sampleTests">,
        newAnalystId: newAnalystId as Id<"users">,
      });
      toast.success("Test reassigned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign test");
    }
  }

  if (workload === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  const chartData = workload.map((a) => ({
    name: (a.analystName ?? "").split(" ")[0],
    pending:   a.pendingCount,
    completed: a.completedCount,
    capacity:  a.dailyCapacity * 5,
  }));

  return (
    <div className="space-y-6">
      {/* Chart overview */}
      <Card className="border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            <span className="font-semibold text-sm">Analyst Load Overview</span>
            <span className="text-xs text-muted-foreground ml-2">Pending vs. completed tests (next 30 days)</span>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No analysts with assigned tests.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: unknown, n: unknown) => [
                    typeof v === "number" ? v : String(v),
                    n === "pending" ? "Pending" : n === "completed" ? "Completed" : "Weekly Capacity",
                  ]}
                />
                <Bar dataKey="pending"   name="pending"   radius={[4,4,0,0]} fill="hsl(220 60% 45%)" />
                <Bar dataKey="completed" name="completed" radius={[4,4,0,0]} fill="hsl(142 60% 42%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Drag-to-reassign board */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Drag to Reassign Tests</span>
          <span className="text-xs text-muted-foreground">Drag a test card to a different analyst column to reassign it.</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
            {workload.map((analyst) => (
              <AnalystDropZone
                key={analyst.analystId}
                analyst={analyst}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTest && (
              <div className="bg-card border-2 border-primary rounded-lg px-3 py-2 text-xs shadow-xl w-52">
                <p className="font-semibold text-primary">{activeTest.sampleLimsNumber}</p>
                <p className="text-muted-foreground">{activeTest.testName}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ─── AnalystDropZone ──────────────────────────────────────────────────────────

type AnalystWorkload = {
  analystId: string;
  analystName: string;
  role: string;
  pendingCount: number;
  completedCount: number;
  isOverloaded: boolean;
  utilizationPct: number;
  dailyCapacity: number;
  pendingTests: PendingTest[];
};

function AnalystDropZone({ analyst, activeId }: { analyst: AnalystWorkload; activeId: string | null }) {
  const { setNodeRef, isOver } = useSortable({
    id: `zone-${analyst.analystId}`,
  });

  const barColor = capacityColor(analyst.utilizationPct);

  return (
    <SortableContext
      id={`zone-${analyst.analystId}`}
      items={analyst.pendingTests.map((t) => t._id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-xl border bg-card transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5",
          analyst.isOverloaded && "border-red-300 dark:border-red-800",
        )}
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {analyst.analystName?.[0] ?? "?"}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{analyst.analystName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{analyst.role.replace("_"," ")}</p>
              </div>
            </div>
            {analyst.isOverloaded && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} /> Overloaded
              </span>
            )}
          </div>

          {/* Utilization bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${analyst.utilizationPct}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: barColor }}>
              {analyst.utilizationPct}%
            </span>
          </div>

          <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span><span className="font-semibold text-foreground">{analyst.pendingCount}</span> pending</span>
            <span><span className="font-semibold text-green-600 dark:text-green-400">{analyst.completedCount}</span> done</span>
          </div>
        </div>

        {/* Test cards */}
        <div className="px-2 pb-2 space-y-1 min-h-[60px]">
          {analyst.pendingTests.length === 0 ? (
            <div className={cn(
              "rounded-lg border-2 border-dashed border-border flex items-center justify-center h-12 text-[10px] text-muted-foreground transition-colors",
              isOver && "border-primary/50 bg-primary/5",
            )}>
              Drop tests here
            </div>
          ) : (
            analyst.pendingTests.map((t) => (
              <SortableTestCard key={t._id} test={t} />
            ))
          )}
        </div>
      </div>
    </SortableContext>
  );
}

// ─── CapacityTab ──────────────────────────────────────────────────────────────

function CapacityTab({ labId }: { labId: string }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekDays  = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 4) }); // Mon-Fri

  const fromDate = format(weekStart, "yyyy-MM-dd");
  const toDate   = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const workload = useQuery(api.scheduling.getAnalystWorkload, {
    laboratoryId: labId as Id<"laboratories">,
    fromDate,
    toDate,
  });

  if (workload === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  const overloaded = workload.filter((a) => a.isOverloaded);
  const totalPending = workload.reduce((s, a) => s + a.pendingCount, 0);
  const totalCapacity = workload.reduce((s, a) => s + a.dailyCapacity * 5, 0);
  const overallPct = totalCapacity > 0 ? Math.round((totalPending / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Week nav */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft size={15} />
        </Button>
        <span className="font-semibold text-sm min-w-[220px] text-center">
          Week of {format(weekStart, "MMM d, yyyy")}
        </span>
        <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight size={15} />
        </Button>
        <Button size="sm" variant="secondary" className="cursor-pointer ml-2" onClick={() => setWeekOffset(0)}>
          This Week
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Lab Utilization",
            value: `${overallPct}%`,
            icon: <Target size={15} className="text-primary" />,
            color: overallPct > 90 ? "text-red-600" : overallPct > 70 ? "text-yellow-600" : "text-green-600",
          },
          {
            label: "Total Pending Tests",
            value: totalPending,
            icon: <FlaskConical size={15} className="text-teal-500" />,
            color: "",
          },
          {
            label: "Overloaded Analysts",
            value: overloaded.length,
            icon: <AlertTriangle size={15} className="text-red-500" />,
            color: overloaded.length > 0 ? "text-red-600" : "text-green-600",
          },
          {
            label: "Analysts Active",
            value: workload.filter((a) => a.pendingCount > 0).length,
            icon: <Users size={15} className="text-blue-500" />,
            color: "",
          },
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

      {/* Overload alerts */}
      {overloaded.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/10 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
            <AlertTriangle size={15} />
            {overloaded.length} analyst{overloaded.length > 1 ? "s are" : " is"} over capacity
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {overloaded.map((a) => (
              <span key={a.analystId} className="text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded font-medium">
                {a.analystName} ({a.pendingCount} tests)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap: analysts × days */}
      <Card className="border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-primary" />
            <span className="font-semibold text-sm">Weekly Workload Heatmap</span>
            <span className="text-xs text-muted-foreground ml-1">Estimated daily load per analyst</span>
          </div>
        </CardHeader>
        <CardContent>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No analyst data for this week.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground pr-4 pb-2 whitespace-nowrap">Analyst</th>
                    {weekDays.map((d) => (
                      <th key={d.toISOString()} className={cn(
                        "text-center text-xs font-medium text-muted-foreground pb-2 px-2 whitespace-nowrap",
                        isToday(d) && "text-primary",
                      )}>
                        {format(d, "EEE d")}
                      </th>
                    ))}
                    <th className="text-right text-xs font-medium text-muted-foreground pb-2 pl-4 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((analyst) => {
                    // Distribute pending tests evenly across days for a heatmap estimate
                    const dailyLoad = analyst.pendingCount > 0
                      ? Math.ceil(analyst.pendingCount / 5)
                      : 0;
                    return (
                      <tr key={analyst.analystId} className="border-t border-border">
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {analyst.analystName?.[0] ?? "?"}
                            </div>
                            <span className="font-medium text-xs">{analyst.analystName}</span>
                          </div>
                        </td>
                        {weekDays.map((d) => {
                          const dateKey = format(d, "yyyy-MM-dd");
                          // Use actual byDate count if available, else spread evenly
                          const count = analyst.byDate[dateKey] ?? dailyLoad;
                          const pct = Math.min(100, Math.round((count / analyst.dailyCapacity) * 100));
                          const color = capacityColor(pct);
                          return (
                            <td key={d.toISOString()} className="px-2 py-2.5 text-center">
                              <div
                                className="mx-auto w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white transition-all"
                                style={{ backgroundColor: count === 0 ? "hsl(var(--muted))" : color }}
                                title={`${count} tests — ${pct}% capacity`}
                              >
                                <span style={{ color: count === 0 ? "hsl(var(--muted-foreground))" : "white" }}>
                                  {count}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="pl-4 py-2.5 text-right">
                          <span className={cn(
                            "text-sm font-bold",
                            analyst.isOverloaded ? "text-red-600 dark:text-red-400" : "text-foreground",
                          )}>
                            {analyst.pendingCount}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">/ {analyst.dailyCapacity * 5}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Color legend */}
              <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                <span>Capacity:</span>
                {["< 40%", "40–60%", "60–80%", "80–100%", "100%+"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: CAPACITY_COLORS[i] }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SchedulingInner() {
  const { labId } = useActiveLab();
  const [tab, setTab] = useState<PageTab>("calendar");

  const tabs: { id: PageTab; label: string; icon: React.ReactNode }[] = [
    { id: "calendar", label: "Calendar",        icon: <CalendarDays size={14} /> },
    { id: "workload", label: "Workload",         icon: <Users size={14} /> },
    { id: "capacity", label: "Capacity Planner", icon: <BarChart3 size={14} /> },
  ];

  if (!labId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Skeleton className="h-8 w-64" />
        <p className="text-sm text-muted-foreground">Loading laboratory…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Scheduling & Capacity</h1>
          <p className="text-sm text-muted-foreground">
            Sample deadlines · Instrument calendar · Analyst workload
          </p>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "calendar" && <CalendarTab labId={labId} />}
          {tab === "workload" && <WorkloadTab labId={labId} />}
          {tab === "capacity" && <CapacityTab labId={labId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SchedulingPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Please sign in to view scheduling.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <SchedulingInner />
      </Authenticated>
    </>
  );
}
