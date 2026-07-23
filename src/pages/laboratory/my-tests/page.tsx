import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { TestTube, FlaskConical, Send, ExternalLink, Sparkles, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion, AnimatePresence } from "motion/react";

const PRIORITY_COLORS: Record<string, string> = {
  routine: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  stat: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

type AnomalyResult = {
  isAnomalous: boolean;
  oosFlag: boolean;
  confidenceScore: number;
  explanation: string;
  recommendation: string;
  severity: "none" | "low" | "medium" | "high";
};

export default function MyTestsPage() {
  const { labId } = useActiveLab();
  const myTests = useQuery(
    api.samples.getMyAssignedTests,
    labId ? { laboratoryId: labId } : "skip"
  );

  const enterResult = useMutation(api.samples.enterResult);
  const submitForReview = useMutation(api.samples.submitForReview);
  const detectAnomaly = useAction(api.ai.detectResultAnomaly);

  const [activeTest, setActiveTest] = useState<{
    id: Id<"sampleTests">;
    name: string;
    unit?: string;
    testCode: string;
    lowerLimit?: number;
    upperLimit?: number;
  } | null>(null);
  const [result, setResult] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Anomaly detection state
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
  const [anomalyChecked, setAnomalyChecked] = useState(false);

  // Group by sample
  const bySample = myTests?.reduce<Record<string, typeof myTests>>((acc, t) => {
    const key = t.sampleId as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {}) ?? {};

  const handleCheckAnomaly = async () => {
    if (!activeTest || !result.trim()) return;
    setAnomalyLoading(true);
    setAnomalyResult(null);
    try {
      const res = await detectAnomaly({
        testName: activeTest.name,
        testCode: activeTest.testCode,
        resultValue: result,
        unit: activeTest.unit,
        lowerLimit: activeTest.lowerLimit,
        upperLimit: activeTest.upperLimit,
      });
      setAnomalyResult(res);
      setAnomalyChecked(true);
    } catch {
      toast.error("AI anomaly detection unavailable. You can still submit the result.");
    } finally {
      setAnomalyLoading(false);
    }
  };

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTest || !result) return;
    setIsSubmitting(true);
    try {
      await enterResult({ sampleTestId: activeTest.id, result, comments: comments || undefined });
      toast.success("Result saved");
      setActiveTest(null);
      setResult("");
      setComments("");
      setAnomalyResult(null);
      setAnomalyChecked(false);
    } catch { toast.error("Failed to save result"); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmitForReview = async (stId: string) => {
    try {
      await submitForReview({ sampleTestId: stId as Id<"sampleTests"> });
      toast.success("Submitted for technical review");
    } catch { toast.error("Failed to submit"); }
  };

  if (myTests === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  const sampleKeys = Object.keys(bySample);

  const anomalySeverityMeta = {
    none:   { icon: <CheckCircle2 size={14} />, color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" },
    low:    { icon: <Info size={14} />,          color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" },
    medium: { icon: <AlertTriangle size={14} />, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" },
    high:   { icon: <AlertTriangle size={14} />, color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Tests</h1>
        <p className="text-sm text-muted-foreground">
          {myTests.length} test{myTests.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {sampleKeys.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><TestTube /></EmptyMedia>
            <EmptyTitle>No tests assigned to you</EmptyTitle>
            <EmptyDescription>Ask your supervisor to assign tests from the Work Assignment screen.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {sampleKeys.map((sampleId) => {
            const tests = bySample[sampleId];
            const first = tests[0];
            return (
              <Card key={sampleId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link to={`/samples/${sampleId}`} className="font-mono text-sm font-bold text-primary hover:underline shrink-0">
                        {first.sampleLimsNumber}
                      </Link>
                      <span className="text-sm text-muted-foreground truncate">{first.sampleName}</span>
                      <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded shrink-0", PRIORITY_COLORS[first.samplePriority] ?? "bg-muted")}>
                        {first.samplePriority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{first.customerName}</span>
                      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" asChild>
                        <Link to={`/samples/${sampleId}/worksheet`}>
                          <ExternalLink size={11} /> Worksheet
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border border-t border-border">
                    {tests.map((st) => (
                      <div key={st._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FlaskConical size={14} className="text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{st.testName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {st.testCode}
                              {(st.lowerLimit != null || st.upperLimit != null) && (
                                <span className="ml-2">
                                  {st.lowerLimit ?? "—"} – {st.upperLimit ?? "—"}{st.unit ? ` ${st.unit}` : ""}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={st.status} />
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" className="h-7 px-2 text-xs"
                            onClick={() => {
                              setActiveTest({
                                id: st._id as Id<"sampleTests">,
                                name: st.testName,
                                unit: st.unit,
                                testCode: st.testCode,
                                lowerLimit: st.lowerLimit ?? undefined,
                                upperLimit: st.upperLimit ?? undefined,
                              });
                              setResult("");
                              setComments("");
                              setAnomalyResult(null);
                              setAnomalyChecked(false);
                            }}>
                            Enter Result
                          </Button>
                          {st.status === "result_entered" && (
                            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1"
                              onClick={() => handleSubmitForReview(st._id)}>
                              <Send size={10} /> Submit
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!activeTest} onOpenChange={() => { setActiveTest(null); setAnomalyResult(null); setAnomalyChecked(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enter Result — {activeTest?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitResult} className="space-y-4">
            <div className="space-y-1">
              <Label>Result {activeTest?.unit ? `(${activeTest.unit})` : ""} *</Label>
              <div className="flex gap-2">
                <Input
                  value={result}
                  onChange={(e) => { setResult(e.target.value); setAnomalyResult(null); setAnomalyChecked(false); }}
                  placeholder="Enter result value..."
                  autoFocus
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 gap-1"
                  disabled={!result.trim() || anomalyLoading}
                  onClick={handleCheckAnomaly}
                >
                  {anomalyLoading ? <Spinner /> : <Sparkles size={13} />}
                  AI Check
                </Button>
              </div>
              {activeTest && (activeTest.lowerLimit != null || activeTest.upperLimit != null) && (
                <p className="text-xs text-muted-foreground">
                  Limits: {activeTest.lowerLimit ?? "—"} – {activeTest.upperLimit ?? "—"}{activeTest.unit ? ` ${activeTest.unit}` : ""}
                </p>
              )}
            </div>

            {/* Anomaly detection result */}
            <AnimatePresence>
              {anomalyChecked && anomalyResult && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn("rounded-xl border p-3 space-y-2", anomalySeverityMeta[anomalyResult.severity].bg)}
                >
                  <div className="flex items-center gap-2">
                    <span className={anomalySeverityMeta[anomalyResult.severity].color}>
                      {anomalySeverityMeta[anomalyResult.severity].icon}
                    </span>
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <Sparkles size={11} className="text-primary" />
                      AI Analysis
                      {anomalyResult.oosFlag && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold">OOS</span>
                      )}
                      {anomalyResult.isAnomalous && !anomalyResult.oosFlag && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-yellow-500 text-white text-xs font-bold">ANOMALY</span>
                      )}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{anomalyResult.confidenceScore}% confidence</span>
                  </div>
                  <p className="text-xs text-foreground/80">{anomalyResult.explanation}</p>
                  {(anomalyResult.isAnomalous || anomalyResult.oosFlag) && (
                    <p className="text-xs font-medium">{anomalyResult.recommendation}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <Label>Analyst Comments</Label>
              <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setActiveTest(null); setAnomalyResult(null); setAnomalyChecked(false); }}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !result}>Save Result</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
