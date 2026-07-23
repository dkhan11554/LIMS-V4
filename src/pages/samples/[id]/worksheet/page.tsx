import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  ArrowLeft, FlaskConical, CheckCircle, XCircle,
  AlertTriangle, Clock, ChevronRight, Send, Play,
  RotateCcw, ShieldAlert, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = "numeric" | "text" | "pass_fail" | "pos_neg" | "selection" | undefined;

type RetestRequest = {
  _id: Id<"retestRequests">;
  status: string;
  reason: string;
  reasonDetail?: string;
  originalResult?: string;
  retestResult?: string;
  rootCause?: string;
  conclusion?: string;
  requestedAt: string;
  requesterName?: string;
  approverName?: string;
};

type SampleTest = {
  _id: string;
  testId: Id<"tests">;
  status: string;
  testName: string;
  testCode: string;
  unit?: string;
  resultType?: ResultType;
  lowerLimit?: number;
  upperLimit?: number;
  result?: string;
  passFailStatus?: string;
  comments?: string;
  assignedTo?: string;
  assignedUserName?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_CODES = [
  { value: "oos",              label: "Out of Specification (OOS)" },
  { value: "oot",              label: "Out of Trend (OOT)" },
  { value: "analyst_error",   label: "Analyst Error" },
  { value: "instrument_fault", label: "Instrument Fault" },
  { value: "sample_issue",    label: "Sample Integrity Issue" },
  { value: "customer_request", label: "Customer Request" },
  { value: "other",           label: "Other" },
];

const RETEST_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "Pending Approval", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved:         { label: "Approved",         cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  rejected:         { label: "Rejected",         cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  in_progress:      { label: "In Progress",      cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  completed:        { label: "Completed",        cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPassFail(value: string, lower?: number, upper?: number): "pass" | "fail" | null {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (lower != null && num < lower) return "fail";
  if (upper != null && num > upper) return "fail";
  return "pass";
}

function SpecDisplay({ lower, upper, unit }: { lower?: number; upper?: number; unit?: string }) {
  if (lower == null && upper == null) return <span className="text-muted-foreground">—</span>;
  const u = unit ? ` ${unit}` : "";
  if (lower != null && upper != null) return <span className="font-mono text-xs">{lower} – {upper}{u}</span>;
  if (lower != null) return <span className="font-mono text-xs">≥ {lower}{u}</span>;
  return <span className="font-mono text-xs">≤ {upper}{u}</span>;
}

// ─── Retest Status Panel ──────────────────────────────────────────────────────

function RetestPanel({ retest, unit }: { retest: RetestRequest; unit?: string }) {
  const s = RETEST_STATUS_STYLES[retest.status] ?? { label: retest.status, cls: "bg-muted text-foreground" };
  const reasonLabel = REASON_CODES.find((r) => r.value === retest.reason)?.label ?? retest.reason;
  const hasComparison = retest.originalResult && retest.retestResult;

  return (
    <div className="mt-2 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <RotateCcw size={13} className="text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Retest Requested</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", s.cls)}>{s.label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(retest.requestedAt), { addSuffix: true })}
          {retest.requesterName && ` · ${retest.requesterName}`}
        </span>
      </div>

      <p className="text-xs text-muted-foreground"><span className="font-medium">Reason:</span> {reasonLabel}
        {retest.reasonDetail && <> — {retest.reasonDetail}</>}
      </p>

      {/* Result comparison */}
      {(retest.originalResult || retest.retestResult) && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Original:</span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400">{retest.originalResult ?? "—"} {unit}</span>
          </div>
          {retest.retestResult && <>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Retest:</span>
              <span className="font-mono font-bold text-green-600 dark:text-green-400">{retest.retestResult} {unit}</span>
            </div>
          </>}
        </div>
      )}

      {retest.rootCause && (
        <p className="text-xs text-muted-foreground"><span className="font-medium">Root cause:</span> {retest.rootCause}</p>
      )}
      {retest.conclusion && (
        <p className="text-xs text-muted-foreground"><span className="font-medium">Conclusion:</span> {retest.conclusion}</p>
      )}

      {retest.approverName && (
        <p className="text-[11px] text-muted-foreground">Reviewed by: {retest.approverName}</p>
      )}
    </div>
  );
}

// ─── Request Retest Dialog ────────────────────────────────────────────────────

function RequestRetestDialog({
  st,
  sampleId,
  onClose,
}: {
  st: SampleTest;
  sampleId: Id<"samples">;
  onClose: () => void;
}) {
  const createRetest = useMutation(api.calculations.createRetestRequest);
  const [reason, setReason] = useState(
    st.passFailStatus === "fail" ? "oos" : "other"
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await createRetest({
        sampleTestId: st._id as Id<"sampleTests">,
        sampleId,
        reason,
        reasonDetail: reasonDetail || undefined,
        originalResult: st.result,
      });
      toast.success("Retest request submitted for supervisor approval");
      onClose();
    } catch {
      toast.error("Failed to submit retest request");
    } finally {
      setSaving(false);
    }
  }

  const reasonLabel = REASON_CODES.find((r) => r.value === reason)?.label ?? reason;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-500" />
            Request Retest
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Test info */}
          <div className="border rounded-lg p-3 bg-muted/30 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Test</span>
              <span className="font-medium">{st.testName}</span>
            </div>
            {st.result && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Result</span>
                <span className={cn("font-mono font-bold",
                  st.passFailStatus === "fail" ? "text-red-600 dark:text-red-400" : ""
                )}>
                  {st.result} {st.unit ?? ""}
                  {st.passFailStatus === "fail" && <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded">OOS</span>}
                </span>
              </div>
            )}
            {(st.lowerLimit !== undefined || st.upperLimit !== undefined) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spec Limits</span>
                <span className="font-mono text-xs"><SpecDisplay lower={st.lowerLimit} upper={st.upperLimit} unit={st.unit} /></span>
              </div>
            )}
          </div>

          {/* Reason code */}
          <div className="space-y-1.5">
            <Label>Reason for Retest *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detail */}
          <div className="space-y-1.5">
            <Label>Additional Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="Describe the issue in more detail, e.g. instrument error code, analyst observation…"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
            />
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
            <ShieldAlert size={13} className="text-blue-500 mt-0.5 shrink-0" />
            <p>This request will be sent to a supervisor for approval before retesting begins. Track it in <strong>Laboratory → Retest &amp; Repeat</strong>.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !reason}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : <RotateCcw size={14} className="mr-1.5" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Row ─────────────────────────────────────────────────────────────────

function TestRow({
  st,
  sampleId,
  onStarted,
}: {
  st: SampleTest;
  sampleId: Id<"samples">;
  onStarted: () => void;
}) {
  const enterResult = useMutation(api.samples.enterResult);
  const startTest = useMutation(api.samples.startTest);
  const submitForReview = useMutation(api.samples.submitForReview);

  // Fetch any existing retest requests for this sampleTest
  const retestRequests = useQuery(
    api.calculations.listRetestRequests,
    { sampleId },
  ) as RetestRequest[] | undefined;

  // Filter to this specific test
  const activeRetest = retestRequests?.filter(
    (r) => (r as unknown as { sampleTestId: string }).sampleTestId === st._id
  ).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];

  const [value, setValue] = useState(st.result ?? "");
  const [comments, setComments] = useState(st.comments ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(!st.result);
  const [showRetestDialog, setShowRetestDialog] = useState(false);
  const [showRetestHistory, setShowRetestHistory] = useState(false);

  const isLocked = ["submitted", "technically_approved", "qa_approved"].includes(st.status);
  const canEnter = ["assigned", "in_progress"].includes(st.status);
  const canSubmit = st.status === "result_entered" || (st.status === "in_progress" && !!value);

  const livePassFail = st.resultType === "numeric" && value
    ? getPassFail(value, st.lowerLimit, st.upperLimit)
    : null;

  const isOos = st.status === "oos" || st.passFailStatus === "fail";
  const savedPassFail = st.passFailStatus;

  // Whether a retest can be requested (result entered + no pending retest)
  const canRequestRetest =
    !!st.result &&
    st.status !== "not_assigned" &&
    !["submitted", "technically_approved", "qa_approved"].includes(st.status) &&
    (!activeRetest || activeRetest.status === "rejected" || activeRetest.status === "completed");

  const hasActiveRetest = activeRetest && !["rejected", "completed"].includes(activeRetest.status);

  const handleStart = async () => {
    try {
      await startTest({ sampleTestId: st._id as Id<"sampleTests"> });
      onStarted();
    } catch { toast.error("Failed to start test"); }
  };

  const handleSave = async () => {
    if (!value) return toast.error("Enter a result value first");
    setSaving(true);
    try {
      await enterResult({
        sampleTestId: st._id as Id<"sampleTests">,
        result: value,
        comments: comments || undefined,
      });
      toast.success("Result saved");
      setExpanded(false);
    } catch { toast.error("Failed to save result"); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitForReview({ sampleTestId: st._id as Id<"sampleTests"> });
      toast.success("Submitted for review");
    } catch { toast.error("Failed to submit"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-all",
      isOos ? "border-red-300 dark:border-red-700" : "border-border",
      hasActiveRetest && "border-amber-300 dark:border-amber-700",
    )}>
      {/* Row header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors",
          isOos && "bg-red-50 dark:bg-red-950/20",
          hasActiveRetest && "bg-amber-50/60 dark:bg-amber-950/20",
        )}
        onClick={() => !isLocked && setExpanded(!expanded)}
      >
        <button className="text-muted-foreground shrink-0">
          <ChevronRight size={15} className={cn("transition-transform", expanded && "rotate-90")} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{st.testName}</span>
            <span className="text-xs text-muted-foreground font-mono">{st.testCode}</span>
            {st.assignedUserName && (
              <span className="text-xs text-muted-foreground">· {st.assignedUserName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>Spec: <SpecDisplay lower={st.lowerLimit} upper={st.upperLimit} unit={st.unit} /></span>
          </div>
        </div>

        {/* Result summary */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Retest indicator */}
          {activeRetest && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowRetestHistory(!showRetestHistory); }}
              className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer",
                RETEST_STATUS_STYLES[activeRetest.status]?.cls ?? "bg-muted text-foreground"
              )}
            >
              <RotateCcw size={9} />
              {RETEST_STATUS_STYLES[activeRetest.status]?.label ?? activeRetest.status}
            </button>
          )}

          {st.result && (
            <span className={cn("font-mono text-sm font-semibold",
              savedPassFail === "pass" ? "text-green-600 dark:text-green-400" :
              savedPassFail === "fail" ? "text-red-600 dark:text-red-400" : ""
            )}>
              {st.result}{st.unit ? ` ${st.unit}` : ""}
            </span>
          )}
          {savedPassFail && (
            savedPassFail === "pass"
              ? <CheckCircle size={16} className="text-green-500" />
              : <XCircle size={16} className="text-red-500" />
          )}
          {isOos && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs">OOS</Badge>}
          <StatusBadge status={st.status} />
        </div>
      </div>

      {/* Active retest panel (shown inline when toggled) */}
      {showRetestHistory && activeRetest && (
        <div className="px-4 pb-3">
          <RetestPanel retest={activeRetest} unit={st.unit} />
        </div>
      )}

      {/* Expanded entry form */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/10 space-y-3">
          {st.status === "not_assigned" ? (
            <p className="text-xs text-muted-foreground italic">This test has not been assigned yet.</p>
          ) : isLocked ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-20 shrink-0">Result</span>
                <span className={cn("font-mono font-semibold",
                  savedPassFail === "pass" ? "text-green-600 dark:text-green-400" :
                  savedPassFail === "fail" ? "text-red-600 dark:text-red-400" : ""
                )}>
                  {st.result}{st.unit ? ` ${st.unit}` : "—"}
                </span>
              </div>
              {st.comments && (
                <div className="flex items-start gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">Comments</span>
                  <span className="text-muted-foreground">{st.comments}</span>
                </div>
              )}
              {/* Retest panel in locked state */}
              {activeRetest && <RetestPanel retest={activeRetest} unit={st.unit} />}
            </div>
          ) : (
            <>
              {st.status === "assigned" && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs gap-1 cursor-pointer" onClick={handleStart}>
                    <Play size={11} /> Start Test
                  </Button>
                  <span className="text-xs text-muted-foreground">Mark as in-progress before entering results</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Result {st.unit ? `(${st.unit})` : ""}
                    {st.resultType === "numeric" && (st.lowerLimit != null || st.upperLimit != null) && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        Spec: <SpecDisplay lower={st.lowerLimit} upper={st.upperLimit} unit={st.unit} />
                      </span>
                    )}
                  </Label>
                  {st.resultType === "pass_fail" ? (
                    <div className="flex gap-2">
                      {["pass", "fail"].map((v) => (
                        <button key={v} type="button" onClick={() => setValue(v)}
                          className={cn("flex-1 py-1.5 rounded-md text-xs font-semibold capitalize border-2 transition-all cursor-pointer",
                            value === v
                              ? v === "pass" ? "bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-300"
                                : "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-500 dark:text-red-300"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          )}
                        >{v}</button>
                      ))}
                    </div>
                  ) : st.resultType === "pos_neg" ? (
                    <div className="flex gap-2">
                      {["positive", "negative"].map((v) => (
                        <button key={v} type="button" onClick={() => setValue(v)}
                          className={cn("flex-1 py-1.5 rounded-md text-xs font-semibold capitalize border-2 transition-all cursor-pointer",
                            value === v
                              ? v === "negative" ? "bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30"
                                : "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30"
                              : "border-border text-muted-foreground"
                          )}
                        >{v}</button>
                      ))}
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        type={st.resultType === "numeric" ? "number" : "text"}
                        step="any"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={st.resultType === "numeric" ? "0.00" : "Enter result..."}
                        className={cn("pr-8",
                          livePassFail === "pass" ? "border-green-400 focus:border-green-500" :
                          livePassFail === "fail" ? "border-red-400 focus:border-red-500" : ""
                        )}
                        disabled={!canEnter}
                      />
                      {livePassFail && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          {livePassFail === "pass"
                            ? <CheckCircle size={15} className="text-green-500" />
                            : <XCircle size={15} className="text-red-500" />}
                        </div>
                      )}
                    </div>
                  )}
                  {livePassFail === "fail" && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle size={11} /> Result is out of specification (OOS)
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Analyst Comments</Label>
                  <Input
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Optional notes..."
                    disabled={!canEnter}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button size="sm" className="h-7 text-xs cursor-pointer" onClick={handleSave} disabled={saving || !value || !canEnter}>
                  {saving ? "Saving..." : "Save Result"}
                </Button>
                {(st.status === "result_entered" || st.status === "oos") && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs gap-1 cursor-pointer" onClick={handleSubmit} disabled={submitting}>
                    <Send size={11} /> Submit for Review
                  </Button>
                )}
                {/* Request Retest button */}
                {canRequestRetest && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-7 text-xs gap-1 cursor-pointer ml-auto",
                      isOos ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" :
                      "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    )}
                    onClick={() => setShowRetestDialog(true)}
                  >
                    <RotateCcw size={11} />
                    {isOos ? "Request Retest (OOS)" : "Request Retest"}
                  </Button>
                )}
              </div>

              {/* Show retest panel below action buttons if active */}
              {activeRetest && <RetestPanel retest={activeRetest} unit={st.unit} />}
            </>
          )}
        </div>
      )}

      {showRetestDialog && (
        <RequestRetestDialog
          st={st}
          sampleId={sampleId}
          onClose={() => setShowRetestDialog(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorksheetPage() {
  const { id } = useParams<{ id: string }>();
  const sampleId = id as Id<"samples">;
  const sample = useQuery(api.samples.getSample, { id: sampleId });
  const [tick, setTick] = useState(0);

  if (sample === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (!sample) return <div className="p-4 text-muted-foreground">Sample not found.</div>;

  const allTests = sample.enrichedTests ?? [];
  const entered = allTests.filter((t) => !["not_assigned", "assigned"].includes(t.status)).length;
  const hasOos = allTests.some((t) => t.status === "oos" || t.passFailStatus === "fail");
  const allSubmitted =
    allTests.length > 0 &&
    allTests.every((t) => ["submitted", "technically_approved", "qa_approved", "oos"].includes(t.status));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/samples/${sampleId}`}>
            <ArrowLeft size={16} /> Sample
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-primary" />
            <h1 className="text-xl font-bold font-mono">{sample.limsNumber}</h1>
            <StatusBadge status={sample.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {sample.sampleName} · {sample.customer?.name}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Test Progress</span>
            <span className="text-muted-foreground">{entered} / {allTests.length} results entered</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", hasOos ? "bg-red-500" : "bg-primary")}
              style={{ width: allTests.length > 0 ? `${(entered / allTests.length) * 100}%` : "0%" }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {sample.requestedCompletionDate
                ? `Due ${format(new Date(sample.requestedCompletionDate), "PP")}`
                : "No deadline set"}
            </span>
            {hasOos && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle size={11} /> OOS detected — retest or investigation required
              </span>
            )}
            {allSubmitted && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle size={11} /> All tests submitted for review
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sample summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: "Batch",    value: sample.batchNumber ?? "—" },
          { label: "Product",  value: sample.product ?? "—" },
          { label: "Priority", value: sample.priority.toUpperCase() },
          { label: "Storage",  value: sample.storageCondition ?? "—" },
        ].map((r) => (
          <div key={r.label} className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">{r.label}</p>
            <p className="font-medium truncate">{r.value}</p>
          </div>
        ))}
      </div>

      {/* Test rows */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tests ({allTests.length})
        </h2>
        {allTests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No tests assigned to this sample yet.
          </p>
        ) : (
          allTests.map((st) => (
            <TestRow
              key={st._id}
              st={st}
              sampleId={sampleId}
              onStarted={() => setTick((t) => t + 1)}
            />
          ))
        )}
      </div>
    </div>
  );
}
