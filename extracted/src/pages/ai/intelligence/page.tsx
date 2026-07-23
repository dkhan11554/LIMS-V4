/**
 * AI Intelligence Layer — Milestone 37
 * 5 tabs:
 *  1. OOS Investigator — AI root cause analysis for OOS results
 *  2. Predictive Alerts — approaching-limit trend warnings
 *  3. Batch Release — AI-generated release recommendation
 *  4. Retest Justification — smart GMP-compliant retest rationale
 *  5. Anomaly Detection — cross-result pattern analysis
 */
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain, Search, TrendingUp, PackageCheck, RefreshCw, Activity,
  AlertTriangle, CheckCircle2, Info, ChevronRight, Lightbulb,
  ShieldCheck, FlaskConical, ClipboardList, Zap, Target, BarChart2,
  FileCheck, Microscope, BookOpen, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type RootCause = { cause: string; probability: "high" | "medium" | "low"; category: string; evidence: string };
type OosResult = {
  rootCauses: RootCause[];
  recommendedActions: string[];
  immediateActions: string[];
  investigationChecklist: string[];
  aiConclusion: string;
  confidenceScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
};

type TrendAlert = {
  testName: string; testCode: string;
  severity: "critical" | "warning" | "watch";
  message: string; trend: string; predictedOosIn: string;
  recommendation: string; currentValue: number; percentToLimit: number;
};
type TrendResult = { alerts: TrendAlert[]; overallHealthScore: number; summary: string };

type BatchResult = {
  recommendation: "RELEASE" | "REJECT" | "CONDITIONAL_RELEASE" | "ADDITIONAL_TESTING";
  confidence: number; rationale: string; keyFindings: string[];
  conditions: string[]; regulatoryConsiderations: string[];
  qcSummary: string; riskLevel: "low" | "medium" | "high" | "critical";
};

type RetestResult = {
  justificationText: string; regulatoryBasis: string;
  retestProtocol: string[]; acceptanceCriteria: string;
  documentationRequired: string[];
};

type Anomaly = {
  type: string; severity: "critical" | "warning" | "info";
  title: string; description: string; affectedTests: string[];
  recommendation: string; evidence: string;
};
type AnomalyResult = {
  anomalies: Anomaly[]; totalResultsAnalyzed: number;
  anomalyRate: number; labHealthIndex: number; executiveSummary: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROB_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  watch: "border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/10",
  info: "border-l-sky-400 bg-sky-50/60 dark:bg-sky-950/10",
};
const RISK_COLORS: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-500",
  low: "text-green-600 dark:text-green-400",
};
const REC_COLORS: Record<string, string> = {
  RELEASE: "bg-green-500",
  REJECT: "bg-red-500",
  CONDITIONAL_RELEASE: "bg-yellow-500",
  ADDITIONAL_TESTING: "bg-blue-500",
};

function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className={cn("h-2 w-full rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

function SectionToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold text-left cursor-pointer"
      >
        {title}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Tab 1: OOS Investigator ──────────────────────────────────────────────────

function OosInvestigatorTab({ labId }: { labId: string }) {
  const analyzeOos = useAction(api.ai.analyzeOosInvestigation);
  const validations = useQuery(api.validation.listValidations, {
    laboratoryId: labId as Id<"laboratories">,
    status: "flagged",
  });
  const allValidations = useQuery(api.validation.listValidations, {
    laboratoryId: labId as Id<"laboratories">,
  });

  const [selectedId, setSelectedId] = useState<string>("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OosResult | null>(null);

  const oosItems = validations ?? [];
  const allItems = allValidations ?? [];

  const handleAnalyze = async () => {
    const item = oosItems.find((v) => v._id === selectedId) ??
      allItems.find((v) => v._id === selectedId);
    if (!item) { toast.error("Select an OOS result first"); return; }

    // Get historical values for same test
    const histVals = allItems
      .filter((v) => v.testId === item.testId && v._id !== item._id && v.measuredValue !== undefined)
      .slice(0, 20)
      .reverse()
      .map((v) => v.measuredValue);

    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeOos({
        testName: item.testName ?? "Unknown",
        testCode: item.testCode ?? "",
        measuredValue: item.measuredValue,
        unit: item.unit,
        lowerLimit: item.lowerLimit,
        upperLimit: item.upperLimit,
        sampleName: item.sampleName ?? "Unknown",
        limsNumber: item.limsNumber ?? "",
        historicalValuesJson: JSON.stringify(histVals),
        westgardViolations: item.westgardViolations,
        additionalContext: context || undefined,
      });
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search size={16} className="text-primary" /> Select OOS Result to Investigate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>OOS / Flagged Result</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a flagged result..." />
                </SelectTrigger>
                <SelectContent>
                  {oosItems.length === 0 && (
                    <SelectItem value="none" disabled>No flagged results found</SelectItem>
                  )}
                  {oosItems.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.limsNumber} — {v.testCode} {v.testName} ({v.measuredValue} {v.unit ?? ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Context (optional)</Label>
              <Input
                placeholder="e.g. new reagent lot, analyst trainee, equipment maintenance..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={loading || !selectedId || selectedId === "none"} className="gap-2">
            {loading ? <Spinner /> : <Brain size={15} />}
            Analyze with AI
          </Button>
          {oosItems.length === 0 && (
            <p className="text-xs text-muted-foreground">No flagged results in this lab. Enter results and run validation to generate OOS flags.</p>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Header */}
            <Card className="border-l-4" style={{ borderLeftColor: result.riskLevel === "critical" ? "#ef4444" : result.riskLevel === "high" ? "#f97316" : result.riskLevel === "medium" ? "#eab308" : "#22c55e" }}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn("text-xl font-bold uppercase tracking-wide", RISK_COLORS[result.riskLevel])}>
                    {result.riskLevel} RISK
                  </span>
                  <Badge variant="outline" className="gap-1">
                    <Brain size={12} /> AI Confidence: {result.confidenceScore}%
                  </Badge>
                </div>
                <ConfidenceBar value={result.confidenceScore} />
                <p className="text-sm text-foreground/80 leading-relaxed">{result.aiConclusion}</p>
              </CardContent>
            </Card>

            {/* Root Causes */}
            <SectionToggle title={`Root Causes (${result.rootCauses.length})`}>
              <div className="space-y-3">
                {result.rootCauses.map((rc, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30 border">
                    <div className="shrink-0 text-muted-foreground font-bold text-sm mt-0.5">#{i + 1}</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{rc.cause}</span>
                        <Badge className={cn("text-xs", PROB_COLORS[rc.probability])}>{rc.probability}</Badge>
                        <Badge variant="outline" className="text-xs">{rc.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rc.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionToggle>

            {/* Immediate + Recommended Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionToggle title="Immediate Actions">
                <ul className="space-y-2">
                  {result.immediateActions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
              <SectionToggle title="Recommended Actions">
                <ul className="space-y-2">
                  {result.recommendedActions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <ChevronRight size={14} className="shrink-0 mt-0.5 text-primary" />
                      {a}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
            </div>

            {/* Investigation Checklist */}
            <SectionToggle title="Investigation Checklist">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.investigationChecklist.map((item, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-0.5 cursor-pointer" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </SectionToggle>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 2: Predictive Trend Alerts ──────────────────────────────────────────

function PredictiveTrendsTab({ labId, labName }: { labId: string; labName: string }) {
  const analyzeTrends = useAction(api.ai.analyzePredictiveTrends);
  const validations = useQuery(api.validation.listValidations, {
    laboratoryId: labId as Id<"laboratories">,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrendResult | null>(null);

  const handleAnalyze = async () => {
    if (!validations || validations.length === 0) {
      toast.error("No validation results found for trend analysis");
      return;
    }

    // Group by test, build trend data
    const byTest: Record<string, { testName: string; testCode: string; values: number[]; unit: string; lowerLimit?: number; upperLimit?: number; timestamps: string[] }> = {};
    for (const v of validations) {
      if (v.measuredValue === undefined) continue;
      const tid = v.testId as string;
      if (!byTest[tid]) {
        byTest[tid] = {
          testName: v.testName ?? "Unknown",
          testCode: v.testCode ?? "",
          values: [],
          unit: v.unit ?? "",
          lowerLimit: v.lowerLimit,
          upperLimit: v.upperLimit,
          timestamps: [],
        };
      }
      byTest[tid].values.push(v.measuredValue);
      byTest[tid].timestamps.push(v._creationTime ? new Date(v._creationTime).toISOString() : "");
    }

    // Only include tests with 3+ data points for meaningful trend
    const trendData = Object.values(byTest).filter((t) => t.values.length >= 3).slice(0, 20);

    if (trendData.length === 0) {
      toast.error("Need at least 3 results per test for trend analysis");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeTrends({
        trendDataJson: JSON.stringify(trendData),
        laboratoryName: labName,
      });
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message ?? "Trend analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const SEVERITY_ICON: Record<string, React.ReactNode> = {
    critical: <AlertTriangle size={16} className="text-red-500" />,
    warning: <AlertTriangle size={16} className="text-yellow-500" />,
    watch: <Activity size={16} className="text-blue-500" />,
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Scans all test result trends in this lab and flags tests approaching specification limits before they go OOS.
              Uses AI to detect drift, systematic shifts, and predictive risk — powered by GPT-5 mini.
            </p>
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="gap-2 shrink-0">
            {loading ? <Spinner /> : <TrendingUp size={15} />}
            Run Trend Analysis
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Health Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 text-center">
                  <div className={cn("text-4xl font-bold", result.overallHealthScore >= 70 ? "text-green-500" : result.overallHealthScore >= 40 ? "text-yellow-500" : "text-red-500")}>
                    {result.overallHealthScore}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Overall Health Score / 100</div>
                  <ConfidenceBar value={result.overallHealthScore} className="mt-2" />
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardContent className="pt-5">
                  <p className="text-sm leading-relaxed text-foreground/80">{result.summary}</p>
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {(["critical", "warning", "watch"] as const).map((s) => {
                      const count = result.alerts.filter((a) => a.severity === s).length;
                      return count > 0 ? (
                        <Badge key={s} className={cn("gap-1", s === "critical" ? "bg-red-500" : s === "warning" ? "bg-yellow-500" : "bg-blue-500")}>
                          {count} {s}
                        </Badge>
                      ) : null;
                    })}
                    {result.alerts.length === 0 && <Badge className="bg-green-500">All tests stable</Badge>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {result.alerts.length > 0 ? (
              <div className="space-y-3">
                {result.alerts.map((alert, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("border-l-4 rounded-lg p-4 space-y-2", SEVERITY_COLORS[alert.severity])}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {SEVERITY_ICON[alert.severity]}
                      <span className="font-semibold text-sm">{alert.testCode} — {alert.testName}</span>
                      <Badge variant="outline" className="text-xs">{alert.trend}</Badge>
                      <Badge variant="outline" className="text-xs">Predicted OOS: {alert.predictedOosIn}</Badge>
                      <Badge variant="outline" className="text-xs">{alert.percentToLimit.toFixed(0)}% to limit</Badge>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Lightbulb size={12} className="mt-0.5 shrink-0 text-yellow-500" />
                      {alert.recommendation}
                    </div>
                    {/* Mini progress bar to limit */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                      <div
                        className={cn("h-full rounded-full", alert.percentToLimit >= 80 ? "bg-red-500" : alert.percentToLimit >= 60 ? "bg-yellow-500" : "bg-blue-400")}
                        style={{ width: `${Math.min(alert.percentToLimit, 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-green-500" />
                  <p className="font-semibold">All trends healthy — no tests approaching OOS</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 3: Batch Release ─────────────────────────────────────────────────────

function BatchReleaseTab({ labId }: { labId: string }) {
  const generateRelease = useAction(api.ai.generateBatchReleaseRecommendation);
  const samples = useQuery(api.samples.listSamples, {
    laboratoryId: labId as Id<"laboratories">,
    status: "approved",
  });
  const validationStats = useQuery(api.validation.getValidationStats, {
    laboratoryId: labId as Id<"laboratories">,
  });

  const [selectedSample, setSelectedSample] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const handleGenerate = async () => {
    const sample = (samples ?? []).find((s) => s._id === selectedSample);
    if (!sample) { toast.error("Select an approved sample"); return; }

    const sampleData = {
      limsNumber: sample.limsNumber,
      sampleName: sample.sampleName,
      batchNo: sample.batchNumber,
      lotNo: sample.lotNumber,
      customer: sample.customerName ?? "Unknown",
      sampleType: sample.sampleType,
      status: sample.status,
    };

    const validSummary = validationStats ?? { total: 0, pending: 0, flagged: 0, accepted: 0, rejected: 0, oos: 0, westgardFails: 0 };

    setLoading(true);
    setResult(null);
    try {
      const res = await generateRelease({
        sampleDataJson: JSON.stringify(sampleData),
        validationSummaryJson: JSON.stringify(validSummary),
      });
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const REC_LABEL: Record<string, string> = {
    RELEASE: "RELEASE",
    REJECT: "REJECT",
    CONDITIONAL_RELEASE: "CONDITIONAL RELEASE",
    ADDITIONAL_TESTING: "ADDITIONAL TESTING REQUIRED",
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageCheck size={16} className="text-primary" /> Select Approved Sample for Batch Release Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={selectedSample} onValueChange={setSelectedSample}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select approved sample..." />
              </SelectTrigger>
              <SelectContent>
                {(samples ?? []).length === 0 && (
                  <SelectItem value="none" disabled>No approved samples</SelectItem>
                )}
                {(samples ?? []).map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.limsNumber} — {s.sampleName} ({s.sampleType ?? "unknown"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={loading || !selectedSample || selectedSample === "none"} className="gap-2 shrink-0">
              {loading ? <Spinner /> : <Brain size={15} />}
              Generate Recommendation
            </Button>
          </div>
          {(samples ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No approved samples. QA-approve a sample to enable batch release analysis.</p>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={cn("text-white text-base px-4 py-1.5", REC_COLORS[result.recommendation])}>
                    {REC_LABEL[result.recommendation]}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <span className="font-semibold text-sm">{result.confidence}%</span>
                  </div>
                  <Badge variant="outline" className={cn("font-semibold", RISK_COLORS[result.riskLevel])}>
                    {result.riskLevel.toUpperCase()} RISK
                  </Badge>
                </div>
                <ConfidenceBar value={result.confidence} />
                <p className="text-sm leading-relaxed text-foreground/80">{result.rationale}</p>
                <p className="text-xs text-muted-foreground italic">{result.qcSummary}</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionToggle title="Key Findings">
                <ul className="space-y-2">
                  {result.keyFindings.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <ChevronRight size={14} className="shrink-0 mt-0.5 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
              <SectionToggle title="Regulatory Considerations">
                <ul className="space-y-2">
                  {result.regulatoryConsiderations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <BookOpen size={13} className="shrink-0 mt-0.5 text-muted-foreground" /> {r}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
            </div>

            {result.conditions.length > 0 && (
              <SectionToggle title="Conditions for Release">
                <ul className="space-y-2">
                  {result.conditions.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {c}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 4: Retest Justification ──────────────────────────────────────────────

function RetestJustificationTab() {
  const suggest = useAction(api.ai.suggestRetestJustification);

  const [testName, setTestName] = useState("");
  const [testCode, setTestCode] = useState("");
  const [result_, setResult_] = useState("");
  const [unit, setUnit] = useState("");
  const [lowerLimit, setLowerLimit] = useState("");
  const [upperLimit, setUpperLimit] = useState("");
  const [reason, setReason] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [analystNote, setAnalystNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<RetestResult | null>(null);

  const REASON_CODES = [
    "Instrument malfunction suspected",
    "Sample preparation error",
    "Calculation error",
    "Transcription error",
    "Reagent/standard issue suspected",
    "Environmental condition outside limits",
    "Analyst unfamiliar with method",
    "Inconclusive result — further investigation required",
  ];

  const handleGenerate = async () => {
    if (!testName || !result_ || !reason) {
      toast.error("Fill in test name, result, and reason");
      return;
    }
    setLoading(true);
    setOutput(null);
    try {
      const res = await suggest({
        testName,
        testCode,
        originalResult: parseFloat(result_),
        unit: unit || undefined,
        lowerLimit: lowerLimit ? parseFloat(lowerLimit) : undefined,
        upperLimit: upperLimit ? parseFloat(upperLimit) : undefined,
        reason,
        sampleType: sampleType || undefined,
        analystNote: analystNote || undefined,
      });
      setOutput(res);
    } catch (e) {
      toast.error((e as Error).message ?? "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw size={16} className="text-primary" /> Generate GMP-Compliant Retest Justification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Test Name *</Label>
              <Input placeholder="e.g. Viscosity" value={testName} onChange={(e) => setTestName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Test Code</Label>
              <Input placeholder="e.g. VISC-01" value={testCode} onChange={(e) => setTestCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sample Type</Label>
              <Input placeholder="e.g. Finished Product" value={sampleType} onChange={(e) => setSampleType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Original Result *</Label>
              <Input placeholder="0.00" type="number" value={result_} onChange={(e) => setResult_(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input placeholder="e.g. mg/mL" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 col-span-1">
              <div className="space-y-1.5">
                <Label>Lower Limit</Label>
                <Input placeholder="min" type="number" value={lowerLimit} onChange={(e) => setLowerLimit(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Upper Limit</Label>
                <Input placeholder="max" type="number" value={upperLimit} onChange={(e) => setUpperLimit(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Retest Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason code..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Analyst Notes (optional)</Label>
            <Textarea
              placeholder="Any additional observations, e.g. 'noticed instrument pressure drop during run'..."
              value={analystNote}
              onChange={(e) => setAnalystNote(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading || !testName || !result_ || !reason} className="gap-2">
            {loading ? <Spinner /> : <Brain size={15} />}
            Generate Justification
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {output && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <SectionToggle title="Formal Justification Text">
              <div className="bg-muted/30 rounded-md p-4 text-sm leading-relaxed whitespace-pre-line border">
                {output.justificationText}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">Regulatory basis: {output.regulatoryBasis}</p>
            </SectionToggle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionToggle title="Retest Protocol">
                <ol className="space-y-2 list-decimal list-inside">
                  {output.retestProtocol.map((s, i) => (
                    <li key={i} className="text-sm">{s}</li>
                  ))}
                </ol>
              </SectionToggle>
              <SectionToggle title="Documentation Required">
                <ul className="space-y-2">
                  {output.documentationRequired.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <FileCheck size={13} className="shrink-0 mt-0.5 text-primary" /> {d}
                    </li>
                  ))}
                </ul>
              </SectionToggle>
            </div>

            <Card className="bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-1">Acceptance Criteria</p>
                <p className="text-sm text-sky-800 dark:text-sky-200">{output.acceptanceCriteria}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 5: Anomaly Detection ─────────────────────────────────────────────────

function AnomalyDetectionTab({ labId, labName }: { labId: string; labName: string }) {
  const detectAnomalies = useAction(api.ai.detectAnomalies);
  const validations = useQuery(api.validation.listValidations, {
    laboratoryId: labId as Id<"laboratories">,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);

  const handleDetect = async () => {
    if (!validations || validations.length < 5) {
      toast.error("Need at least 5 results for anomaly detection");
      return;
    }

    const dataset = validations.slice(0, 200).map((v) => ({
      testName: v.testName ?? "Unknown",
      testCode: v.testCode ?? "",
      result: v.measuredValue,
      unit: v.unit ?? "",
      date: v._creationTime ? new Date(v._creationTime).toISOString() : "",
      status: v.specStatus,
      westgard: v.westgardStatus,
    }));

    setLoading(true);
    setResult(null);
    try {
      const res = await detectAnomalies({
        resultsJson: JSON.stringify(dataset),
        laboratoryName: labName,
      });
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message ?? "Detection failed");
    } finally {
      setLoading(false);
    }
  };

  const ANOMALY_TYPE_ICON: Record<string, React.ReactNode> = {
    statistical: <BarChart2 size={14} />,
    pattern: <Activity size={14} />,
    systematic: <Target size={14} />,
    instrument: <Microscope size={14} />,
    analyst: <ClipboardList size={14} />,
    temporal: <Zap size={14} />,
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Scans up to 200 recent results across all tests for statistical outliers, systematic analyst biases,
              instrument drift, temporal clustering, and hidden patterns. Powered by GPT-5 mini.
            </p>
          </div>
          <Button onClick={handleDetect} disabled={loading} className="gap-2 shrink-0">
            {loading ? <Spinner /> : <Activity size={15} />}
            Detect Anomalies
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Results Analyzed", value: result.totalResultsAnalyzed, icon: <FlaskConical size={18} /> },
                { label: "Anomaly Rate", value: `${result.anomalyRate.toFixed(1)}%`, icon: <AlertTriangle size={18} /> },
                { label: "Lab Health Index", value: `${result.labHealthIndex}/100`, icon: <ShieldCheck size={18} /> },
                { label: "Anomalies Found", value: result.anomalies.length, icon: <Activity size={18} /> },
              ].map((kpi, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 text-center">
                    <div className="text-muted-foreground flex justify-center mb-1">{kpi.icon}</div>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                    <div className="text-xs text-muted-foreground">{kpi.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed text-foreground/80">{result.executiveSummary}</p>
                <ConfidenceBar value={result.labHealthIndex} className="mt-3" />
                <p className="text-xs text-muted-foreground mt-1">Lab Health Index</p>
              </CardContent>
            </Card>

            {result.anomalies.length > 0 ? (
              <div className="space-y-3">
                {result.anomalies.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn("border-l-4 rounded-lg p-4 space-y-2", SEVERITY_COLORS[a.severity])}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {a.severity === "critical" ? <AlertTriangle size={15} className="text-red-500" /> :
                       a.severity === "warning" ? <AlertTriangle size={15} className="text-yellow-500" /> :
                       <Info size={15} className="text-sky-500" />}
                      <span className="font-semibold text-sm">{a.title}</span>
                      <Badge variant="outline" className="text-xs gap-1">
                        {ANOMALY_TYPE_ICON[a.type]} {a.type}
                      </Badge>
                      {a.affectedTests.slice(0, 3).map((t, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-sm">{a.description}</p>
                    <div className="text-xs text-muted-foreground italic">{a.evidence}</div>
                    <div className="flex items-start gap-1.5 text-xs">
                      <Lightbulb size={12} className="shrink-0 mt-0.5 text-yellow-500" />
                      <span>{a.recommendation}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-green-500" />
                  <p className="font-semibold">No anomalies detected — lab quality looks healthy</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AiIntelligenceInner() {
  const { lab: activeLab } = useActiveLab();
  const labId = activeLab?._id as string | undefined;
  const labName = activeLab?.name ?? "Lab";

  if (!labId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p>No laboratory selected. Create or select a laboratory to use AI Intelligence.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Brain size={26} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Intelligence Layer</h1>
          <p className="text-sm text-muted-foreground">
            Advanced AI-powered analytics: OOS investigation, predictive alerts, batch release, retest assistance & anomaly detection
          </p>
        </div>
      </div>

      <Tabs defaultValue="oos">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="oos" className="gap-1.5">
            <Search size={14} /> OOS Investigator
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5">
            <TrendingUp size={14} /> Predictive Alerts
          </TabsTrigger>
          <TabsTrigger value="release" className="gap-1.5">
            <PackageCheck size={14} /> Batch Release
          </TabsTrigger>
          <TabsTrigger value="retest" className="gap-1.5">
            <RefreshCw size={14} /> Retest Justification
          </TabsTrigger>
          <TabsTrigger value="anomaly" className="gap-1.5">
            <Activity size={14} /> Anomaly Detection
          </TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="oos" className="mt-0">
            <OosInvestigatorTab labId={labId} />
          </TabsContent>
          <TabsContent value="trends" className="mt-0">
            <PredictiveTrendsTab labId={labId} labName={labName} />
          </TabsContent>
          <TabsContent value="release" className="mt-0">
            <BatchReleaseTab labId={labId} />
          </TabsContent>
          <TabsContent value="retest" className="mt-0">
            <RetestJustificationTab />
          </TabsContent>
          <TabsContent value="anomaly" className="mt-0">
            <AnomalyDetectionTab labId={labId} labName={labName} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function AiIntelligencePage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager", "supervisor", "qa_officer"]}>
      <Authenticated>
        <AiIntelligenceInner />
      </Authenticated>
      <Unauthenticated>
        <div className="flex-1 flex items-center justify-center">
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </AuthLoading>
    </PageGuard>
  );
}
