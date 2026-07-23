import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ClipboardList, Search, Users, FlaskConical, ChevronRight } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

const PRIORITY_COLORS: Record<string, string> = {
  routine: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  stat: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function WorkAssignmentPage() {
  const { labId } = useActiveLab();
  const users = useQuery(api.users.listUsers, {});
  const analysts = users?.filter((u) => ["analyst", "supervisor", "lab_manager"].includes(u.role ?? "")) ?? [];

  const samples = useQuery(
    api.samples.listSamples,
    labId ? { laboratoryId: labId } : "skip"
  );
  const batchAssignTests = useMutation(api.samples.batchAssignTests);

  const [search, setSearch] = useState("");
  const [defaultAnalyst, setDefaultAnalyst] = useState("");
  // per-test analyst overrides: sampleTestId → analystId
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only samples that are accepted / assigned and still need work
  const activeSamples = samples?.filter((s) =>
    ["accepted", "assigned", "testing", "preparation"].includes(s.status)
  ).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.limsNumber.toLowerCase().includes(q) || s.sampleName.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q);
  });

  const handleBatchAssign = async () => {
    if (!defaultAnalyst && Object.keys(overrides).length === 0) {
      return toast.error("Select a default analyst or set individual assignments");
    }
    toast.info("Use the per-test dropdown or set a default analyst then click a sample row");
  };

  if (samples === undefined) {
    return (
      <div className="max-w-6xl mx-auto space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const unassignedCount = activeSamples?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Work Assignment</h1>
          <p className="text-sm text-muted-foreground">
            {activeSamples?.length ?? 0} active sample{activeSamples?.length !== 1 ? "s" : ""} · {unassignedCount} unassigned test{unassignedCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Default analyst:</span>
            <select
              value={defaultAnalyst}
              onChange={(e) => setDefaultAnalyst(e.target.value)}
              className="bg-transparent text-xs border-none outline-none text-foreground"
            >
              <option value="">Select...</option>
              {analysts.map((a) => <option key={a._id} value={a._id}>{a.name ?? a._id}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={handleBatchAssign} disabled={isSubmitting || unassignedCount === 0}>
            Assign All Unassigned ({unassignedCount})
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8 h-8 text-sm" placeholder="Search samples..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {activeSamples?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>No samples pending assignment</EmptyTitle>
            <EmptyDescription>Accept received samples to start assigning tests</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" asChild><Link to="/samples">View Samples</Link></Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {activeSamples?.map((sample) => (
            <SampleCard
              key={sample._id}
              sample={sample}
              analysts={analysts}
              overrides={overrides}
              onOverride={(stId, analystId) => setOverrides((o) => ({ ...o, [stId]: analystId }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Analyst = { _id: Id<"users">; name?: string };
type Sample = {
  _id: Id<"samples">;
  limsNumber: string;
  sampleName: string;
  priority: string;
  status: string;
  customerName: string;
  requestedCompletionDate?: string;
};

function SampleCard({ sample, analysts, overrides, onOverride }: {
  sample: Sample;
  analysts: Analyst[];
  overrides: Record<string, string>;
  onOverride: (stId: string, analystId: string) => void;
}) {
  const assignTest = useMutation(api.samples.assignTest);
  const sampleData = useQuery(api.samples.getSample, { id: sample._id });
  const [expanded, setExpanded] = useState(true);

  const enrichedTests = sampleData?.enrichedTests ?? [];
  const unassigned = enrichedTests.filter((st) => st.status === "not_assigned");
  const assigned = enrichedTests.filter((st) => st.status !== "not_assigned");

  const isOverdue = sample.requestedCompletionDate
    ? new Date(sample.requestedCompletionDate) < new Date()
    : false;

  const handleAssign = async (sampleTestId: string, analystId: string) => {
    try {
      await assignTest({ sampleTestId: sampleTestId as Id<"sampleTests">, analystId: analystId as Id<"users"> });
      toast.success("Assigned");
    } catch { toast.error("Failed"); }
  };

  return (
    <Card className={cn(isOverdue && "border-orange-300 dark:border-orange-700")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              <ChevronRight size={16} className={cn("transition-transform", expanded && "rotate-90")} />
            </button>
            <Link to={`/samples/${sample._id}`} className="font-mono text-sm font-bold text-primary hover:underline shrink-0">
              {sample.limsNumber}
            </Link>
            <span className="text-sm text-muted-foreground truncate">{sample.sampleName}</span>
            <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded shrink-0", PRIORITY_COLORS[sample.priority] ?? "bg-muted")}>
              {sample.priority}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOverdue && <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Overdue</span>}
            <span className="text-xs text-muted-foreground">{sample.customerName}</span>
            <StatusBadge status={sample.status} />
            <Link to={`/samples/${sample._id}/worksheet`}>
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs gap-1">
                <FlaskConical size={12} /> Worksheet
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-7 text-xs text-muted-foreground">
          <span>{unassigned.length} unassigned</span>
          <span>·</span>
          <span>{assigned.length} assigned/in progress</span>
          {sample.requestedCompletionDate && (
            <>
              <span>·</span>
              <span className={isOverdue ? "text-orange-600 dark:text-orange-400" : ""}>
                Due {new Date(sample.requestedCompletionDate).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </CardHeader>

      {expanded && enrichedTests.length > 0 && (
        <CardContent className="p-0">
          <div className="divide-y divide-border border-t border-border">
            {enrichedTests.map((st) => (
              <div key={st._id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: st.status === "not_assigned" ? "oklch(0.55 0.12 220)" : "oklch(0.55 0.18 140)" }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{st.testName}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{st.testCode}</span>
                  {st.unit && <span className="ml-1 text-xs text-muted-foreground">({st.unit})</span>}
                </div>
                <StatusBadge status={st.status} />
                {st.status === "not_assigned" ? (
                  <Select
                    value={overrides[st._id] ?? ""}
                    onValueChange={(val) => {
                      onOverride(st._id, val);
                      handleAssign(st._id, val);
                    }}
                  >
                    <SelectTrigger className="w-44 h-7 text-xs">
                      <SelectValue placeholder="Assign analyst..." />
                    </SelectTrigger>
                    <SelectContent>
                      {analysts.map((a) => (
                        <SelectItem key={a._id} value={a._id}>{a.name ?? "Unknown"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground w-44 text-right">{st.assignedUserName ?? "—"}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
