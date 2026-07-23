import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ClipboardCheck, CheckCircle2, XCircle, ChevronRight, FlaskConical, Eye, AlertTriangle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

type ReviewDialog = {
  sampleId: Id<"samples">;
  limsNumber: string;
  sampleName: string;
};

function TechnicalReviewInner() {
  const { labId } = useActiveLab();
  const samples = useQuery(
    api.samples.listSamples,
    labId ? { laboratoryId: labId, status: "pending_review" } : "skip"
  );
  const technicalReviewSample = useMutation(api.samples.technicalReviewSample);
  const [dialog, setDialog] = useState<ReviewDialog | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openDialog = (s: ReviewDialog, approve: boolean) => {
    setDialog(s);
    setApproved(approve);
    setComments("");
    setSignature("");
  };

  const handleSubmit = async () => {
    if (!dialog || approved === null) return;
    if (!signature.trim()) {
      toast.error("Please type your name as an electronic signature");
      return;
    }
    setIsSubmitting(true);
    try {
      await technicalReviewSample({
        sampleId: dialog.sampleId,
        approved,
        comments: comments || undefined,
        reviewerSignature: signature,
      });
      toast.success(approved ? "Sample technically approved — moved to QA queue" : "Sample returned for correction");
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Technical Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review submitted test results and approve or return for correction
          </p>
        </div>
        {samples && samples.length > 0 && (
          <Badge variant="secondary" className="text-sm font-semibold mt-1">
            {samples.length} pending
          </Badge>
        )}
      </div>

      {samples === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : samples.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
            <EmptyTitle>No results pending review</EmptyTitle>
            <EmptyDescription>Submitted test results will appear here for technical review</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {samples.map((s) => (
            <SampleReviewCard
              key={s._id}
              sampleId={s._id}
              limsNumber={s.limsNumber}
              sampleName={s.sampleName}
              customerName={s.customerName}
              priority={s.priority}
              status={s.status}
              expanded={expandedId === s._id}
              onToggle={() => setExpandedId(expandedId === s._id ? null : s._id)}
              onApprove={() => openDialog({ sampleId: s._id, limsNumber: s.limsNumber, sampleName: s.sampleName }, true)}
              onReturn={() => openDialog({ sampleId: s._id, limsNumber: s.limsNumber, sampleName: s.sampleName }, false)}
            />
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", approved ? "text-green-600 dark:text-green-400" : "text-destructive")}>
              {approved ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {approved ? "Approve Results" : "Return for Correction"}
            </DialogTitle>
            {dialog && (
              <DialogDescription>
                {dialog.limsNumber} — {dialog.sampleName}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Review Comments {!approved && <span className="text-destructive">*</span>}</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={approved ? "Optional comments for the record…" : "Describe what needs to be corrected…"}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Electronic Signature <span className="text-destructive">*</span></Label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type your full name to sign"
              />
              <p className="text-xs text-muted-foreground">
                By typing your name you confirm this action was performed by you at {new Date().toLocaleTimeString()}.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !signature.trim() || (!approved && !comments.trim())}
              className={approved ? "" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
            >
              {isSubmitting ? "Submitting…" : approved ? "Confirm Approval" : "Return Sample"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sample Review Card ───────────────────────────────────────────────────────

type CardProps = {
  sampleId: Id<"samples">;
  limsNumber: string;
  sampleName: string;
  customerName: string;
  priority: string;
  status: string;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReturn: () => void;
};

function SampleReviewCard({
  sampleId, limsNumber, sampleName, customerName, priority, status,
  expanded, onToggle, onApprove, onReturn,
}: CardProps) {
  const sampleData = useQuery(api.samples.getSample, { id: sampleId });
  const tests = sampleData?.enrichedTests ?? [];
  const hasOos = tests.some((t) => t.passFailStatus === "fail" || t.status === "oos");
  const submittedTests = tests.filter((t) => t.status === "submitted");

  return (
    <Card className={cn(hasOos && "border-orange-300 dark:border-orange-700")}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground shrink-0">
              <ChevronRight size={16} className={cn("transition-transform", expanded && "rotate-90")} />
            </button>
            <Link to={`/samples/${sampleId}`} className="font-mono text-sm font-bold text-primary hover:underline shrink-0">
              {limsNumber}
            </Link>
            <span className="text-sm text-muted-foreground truncate">{sampleName}</span>
            <StatusBadge status={priority} />
            {hasOos && (
              <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                <AlertTriangle size={12} /> OOS
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{customerName}</span>
            <StatusBadge status={status} />
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" asChild>
              <Link to={`/samples/${sampleId}`}><Eye size={12} /> Detail</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive" onClick={onReturn}>
              <XCircle size={12} /> Return
            </Button>
            <Button size="sm" className="h-7 px-2 gap-1 text-xs" onClick={onApprove}>
              <CheckCircle2 size={12} /> Approve
            </Button>
          </div>
        </div>
        <p className="ml-7 text-xs text-muted-foreground">
          {submittedTests.length} submitted test{submittedTests.length !== 1 ? "s" : ""} awaiting review
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          {sampleData === undefined ? (
            <div className="px-4 py-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="border-t border-border divide-y divide-border">
              {tests.map((t) => {
                const isOos = t.passFailStatus === "fail" || t.status === "oos";
                return (
                  <div key={t._id} className={cn("flex items-center gap-3 px-5 py-2.5 text-sm", isOos && "bg-red-50 dark:bg-red-950/20")}>
                    <FlaskConical size={13} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{t.testName}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{t.testCode}</span>
                    </div>
                    {/* Spec range */}
                    {(t.lowerLimit != null || t.upperLimit != null) && (
                      <span className="text-xs text-muted-foreground">
                        Spec: {t.lowerLimit != null && t.upperLimit != null
                          ? `${t.lowerLimit}–${t.upperLimit}`
                          : t.upperLimit != null ? `≤${t.upperLimit}` : `≥${t.lowerLimit}`}
                        {t.unit ? ` ${t.unit}` : ""}
                      </span>
                    )}
                    {/* Result */}
                    <span className={cn("font-semibold font-mono", isOos ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                      {t.result ?? "—"}{t.unit ? ` ${t.unit}` : ""}
                    </span>
                    {t.passFailStatus && (
                      <span className={cn("text-xs font-bold uppercase px-1.5 py-0.5 rounded",
                        t.passFailStatus === "pass" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      )}>
                        {t.passFailStatus}
                      </span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                );
              })}
              {tests.length === 0 && (
                <p className="px-5 py-3 text-sm text-muted-foreground">No tests found.</p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function TechnicalReviewPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager", "supervisor"]}>
      <TechnicalReviewInner />
    </PageGuard>
  );
}