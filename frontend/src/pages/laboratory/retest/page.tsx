import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import {
  RotateCcw, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, FileText, Info, Play,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow, format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.js";

const REASON_CODES = [
  { value: "oos",              label: "Out of Specification (OOS)" },
  { value: "oot",              label: "Out of Trend (OOT)" },
  { value: "analyst_error",   label: "Analyst Error" },
  { value: "instrument_fault", label: "Instrument Fault" },
  { value: "sample_issue",    label: "Sample Integrity Issue" },
  { value: "customer_request", label: "Customer Request" },
  { value: "other",           label: "Other" },
];

const STATUS_STYLES: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  pending_approval: { label: "Pending Approval", class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <Clock size={11} /> },
  approved:         { label: "Approved",         class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",     icon: <CheckCircle2 size={11} /> },
  rejected:         { label: "Rejected",         class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         icon: <XCircle size={11} /> },
  in_progress:      { label: "In Progress",      class: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: <Play size={11} /> },
  completed:        { label: "Completed",        class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 size={11} /> },
};

type RetestRequest = {
  _id: Id<"retestRequests">;
  sampleTestId: Id<"sampleTests">;
  sampleId: Id<"samples">;
  reason: string; reasonDetail?: string;
  rootCause?: string; conclusion?: string;
  status: string; originalResult?: string; retestResult?: string;
  requestedAt: string; notes?: string;
  requesterName?: string; approverName?: string;
  limsNumber?: string; sampleName?: string; testName?: string;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, class: "bg-gray-100 text-gray-600", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", s.class)}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Retest Detail / Approval ─────────────────────────────────────────────────

function RetestDetail({ req, onClose }: { req: RetestRequest; onClose: () => void }) {
  const approve = useMutation(api.calculations.approveRetestRequest);
  const update = useMutation(api.calculations.updateRetestRequest);

  const [rootCause, setRootCause] = useState(req.rootCause ?? "");
  const [retestResult, setRetestResult] = useState(req.retestResult ?? "");
  const [conclusion, setConclusion] = useState(req.conclusion ?? "");
  const [notes, setNotes] = useState(req.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleApprove(approve_: boolean) {
    setApproving(true);
    try {
      await approve({ id: req._id, approve: approve_, notes });
      toast.success(approve_ ? "Retest approved" : "Retest rejected");
      onClose();
    } catch { toast.error("Failed to update"); }
    finally { setApproving(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await update({ id: req._id, rootCause: rootCause || undefined, retestResult: retestResult || undefined, conclusion: conclusion || undefined, notes: notes || undefined });
      toast.success("Saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await update({ id: req._id, status: "completed", retestResult: retestResult || undefined, rootCause: rootCause || undefined, conclusion: conclusion || undefined });
      toast.success("Retest marked as completed");
      onClose();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  }

  const reasonLabel = REASON_CODES.find((r) => r.value === req.reason)?.label ?? req.reason;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><ChevronRight size={14} className="rotate-180 mr-1" />Back</Button>
        <h2 className="text-lg font-bold">Retest Request</h2>
        <StatusBadge status={req.status} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: "Sample", value: req.limsNumber ?? "—" },
          { label: "Test", value: req.testName ?? "—" },
          { label: "Requested By", value: req.requesterName ?? "—" },
          { label: "Requested", value: req.requestedAt ? formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true }) : "—" },
        ].map((f) => (
          <div key={f.label} className="border rounded-lg p-2.5">
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="font-medium truncate">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Reason */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{reasonLabel}</p>
              {req.reasonDetail && <p className="text-sm text-muted-foreground mt-0.5">{req.reasonDetail}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result comparison */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Original Result</p>
            <p className="text-xl font-bold font-mono">{req.originalResult ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Retest Result</p>
            <Input
              value={retestResult}
              onChange={(e) => setRetestResult(e.target.value)}
              placeholder="Enter retest result"
              className="font-mono text-sm"
              disabled={req.status === "completed"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Root cause & conclusion */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Root Cause Analysis</Label>
          <Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} placeholder="Describe the identified root cause…" disabled={req.status === "completed"} />
        </div>
        <div className="space-y-1.5">
          <Label>Conclusion / Corrective Action</Label>
          <Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={2} placeholder="e.g. Confirmed OOS — initiate CAPA; OR Result confirmed — original outlier discarded" disabled={req.status === "completed"} />
        </div>
        <div className="space-y-1.5">
          <Label>Internal Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={req.status === "completed"} />
        </div>
      </div>

      {/* Actions */}
      {req.status !== "completed" && req.status !== "rejected" && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {req.status === "pending_approval" && (
            <>
              <Button onClick={() => handleApprove(true)} disabled={approving} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 size={14} className="mr-1.5" />Approve Retest
              </Button>
              <Button variant="ghost" onClick={() => handleApprove(false)} disabled={approving} className="text-destructive hover:text-destructive">
                <XCircle size={14} className="mr-1.5" />Reject
              </Button>
            </>
          )}
          {req.status === "approved" || req.status === "in_progress" ? (
            <>
              <Button variant="ghost" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : null}Save Progress
              </Button>
              <Button onClick={handleComplete} disabled={saving || !retestResult}>
                <CheckCircle2 size={14} className="mr-1.5" />Mark Complete
              </Button>
            </>
          ) : null}
        </div>
      )}
      {req.status === "completed" && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 border-t pt-3">
          <CheckCircle2 size={15} />
          <p className="text-sm font-medium">Retest completed{req.approverName ? ` · Approved by ${req.approverName}` : ""}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RetestPage() {
  const retests = useQuery(api.calculations.listRetestRequests, {}) as RetestRequest[] | undefined;
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<RetestRequest | null>(null);

  if (selected) {
    return <RetestDetail req={selected} onClose={() => setSelected(null)} />;
  }

  const filtered = (retests ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter);

  const stats = {
    total: retests?.length ?? 0,
    pending: retests?.filter((r) => r.status === "pending_approval").length ?? 0,
    inProgress: retests?.filter((r) => r.status === "in_progress" || r.status === "approved").length ?? 0,
    completed: retests?.filter((r) => r.status === "completed").length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <RotateCcw size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Retest & Repeat Workflow</h1>
          <p className="text-sm text-muted-foreground">Manage OOS / OOT retests · Root cause · Approval workflow</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: stats.total,      color: "text-primary" },
          { label: "Pending Approval", value: stats.pending,  color: "text-yellow-600 dark:text-yellow-400" },
          { label: "In Progress",    value: stats.inProgress, color: "text-blue-600 dark:text-blue-400" },
          { label: "Completed",      value: stats.completed,  color: "text-green-600 dark:text-green-400" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-3xl font-bold mt-1", s.color)}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["all", "pending_approval", "approved", "in_progress", "completed", "rejected"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "ghost"} size="sm"
            onClick={() => setStatusFilter(s)} className="cursor-pointer capitalize">
            {s === "all" ? "All" : STATUS_STYLES[s]?.label ?? s}
          </Button>
        ))}
      </div>

      {/* Table */}
      {!retests ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <RotateCcw size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No retest requests</p>
          <p className="text-xs text-muted-foreground mt-1">Requests are created from the sample worksheet when a result needs retesting</p>
        </CardContent></Card>
      ) : (
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 font-semibold">Sample</th>
                <th className="text-left px-3 py-2.5 font-semibold">Test</th>
                <th className="text-left px-3 py-2.5 font-semibold">Reason</th>
                <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Requested</th>
                <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const reasonLabel = REASON_CODES.find((rc) => rc.value === r.reason)?.label ?? r.reason;
                return (
                  <tr key={r._id} className={cn("border-b last:border-0 hover:bg-muted/10 cursor-pointer", i % 2 !== 0 && "bg-muted/5")} onClick={() => setSelected(r)}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.limsNumber ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">{r.sampleName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.testName ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs">{reasonLabel}</span>
                      {r.originalResult && <span className="text-xs text-muted-foreground ml-1">(was: {r.originalResult})</span>}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                      {r.requestedAt ? formatDistanceToNow(new Date(r.requestedAt), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
