import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot, Send, Sparkles, Brain, TrendingUp, AlertTriangle,
  CheckCircle2, Info, Clock, Zap, RefreshCw, ChevronDown,
  ChevronUp, FlaskConical, Wrench, Package, DollarSign,
  Target, Activity, MessageSquare, Lightbulb, BarChart2,
  Users, ShieldAlert, Star, AlertOctagon
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightCategory = "tat" | "workload" | "quality" | "instrument" | "inventory" | "billing";
type InsightSeverity = "info" | "warning" | "critical";

type Insight = {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  detail: string;
  recommendation: string;
};

type InsightsPayload = {
  insights: Insight[];
  summary: string;
};

type TatRisk = {
  limsNumber: string;
  sampleName: string;
  reason: string;
  estimatedDaysRemaining: number;
  riskLevel: "high" | "medium" | "low";
};

type TatPayload = {
  atRisk: TatRisk[];
  onTrack: number;
  avgRemainingDays: number;
  tatHealthScore: number;
};

type OosRiskItem = {
  category: string;
  testName: string;
  riskLevel: "high" | "medium" | "low";
  confidenceScore: number;
  trendReason: string;
  recommendation: string;
};

type OosRiskPayload = {
  riskItems: OosRiskItem[];
  overallRiskScore: number;
  summary: string;
};

type ProductivityPayload = {
  topPerformer: { name: string; reason: string };
  bottleneck: { name: string; reason: string; recommendation: string };
  teamInsights: string[];
  workloadBalance: "balanced" | "imbalanced" | "critical";
  confidenceScore: number;
  summary: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<InsightCategory, { icon: React.ReactNode; label: string; color: string }> = {
  tat:        { icon: <Clock size={14} />,      label: "TAT",        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  workload:   { icon: <Activity size={14} />,   label: "Workload",   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  quality:    { icon: <Target size={14} />,     label: "Quality",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  instrument: { icon: <Wrench size={14} />,     label: "Instrument", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  inventory:  { icon: <Package size={14} />,    label: "Inventory",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  billing:    { icon: <DollarSign size={14} />, label: "Billing",    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

const SEVERITY_META: Record<InsightSeverity, { icon: React.ReactNode; border: string; bg: string }> = {
  critical: { icon: <AlertTriangle size={15} className="text-red-500" />,    border: "border-l-red-500",    bg: "bg-red-50 dark:bg-red-950/20" },
  warning:  { icon: <AlertTriangle size={15} className="text-yellow-500" />, border: "border-l-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/20" },
  info:     { icon: <Info size={15} className="text-blue-500" />,            border: "border-l-blue-400",   bg: "bg-blue-50/50 dark:bg-blue-950/10" },
};

const SUGGESTED_QUESTIONS = [
  "Which samples are at risk of missing their TAT target?",
  "What are the top quality issues this month?",
  "Which instruments are due for calibration?",
  "Summarise the current workload and backlog.",
  "What inventory items are running critically low?",
  "Which customers have outstanding invoices?",
  "Show me OOS trends over the last 30 days.",
  "What CAPA items are overdue?",
];

// ─── Build lab snapshot for AI context ───────────────────────────────────────

function buildLabContext(data: {
  stats: Record<string, unknown> | null | undefined;
  samples: unknown[] | undefined;
  instruments: unknown[] | undefined;
  inventory: unknown[] | undefined;
  quality: Record<string, unknown> | null | undefined;
  billing: Record<string, unknown> | null | undefined;
}): string {
  return JSON.stringify({
    currentDate: new Date().toISOString(),
    dashboardStats: data.stats ?? {},
    activeSamples: (data.samples ?? []).slice(0, 30),
    instruments: (data.instruments ?? []).slice(0, 20),
    inventoryAlerts: data.inventory ?? [],
    qualitySummary: data.quality ?? {},
    billingSummary: data.billing ?? {},
  }, null, 2);
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_META[insight.severity];
  const cat = CATEGORY_META[insight.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={cn(
        "rounded-xl border-l-4 border border-border p-4 cursor-pointer transition-all",
        sev.border, sev.bg,
        expanded ? "shadow-sm" : "hover:shadow-sm"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{sev.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cat.color)}>
              {cat.icon}{cat.label}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{insight.severity}</span>
          </div>
          <p className="text-sm font-semibold">{insight.title}</p>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-sm text-muted-foreground mt-2">{insight.detail}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-background/70 p-2.5 border">
                  <Lightbulb size={13} className="text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/80">{insight.recommendation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
    </motion.div>
  );
}

// ─── TAT Risk badge ───────────────────────────────────────────────────────────

function TatRiskRow({ risk, index }: { risk: TatRisk; index: number }) {
  const colors = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 py-2.5 border-b last:border-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{risk.sampleName}</p>
        <p className="text-xs text-muted-foreground">{risk.limsNumber} · {risk.reason}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors[risk.riskLevel])}>
          {risk.riskLevel.toUpperCase()}
        </span>
        <p className="text-xs text-muted-foreground mt-0.5">{risk.estimatedDaysRemaining}d left</p>
      </div>
    </motion.div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className={cn(
        "w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5",
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-teal-400 to-blue-500 text-white"
      )}>
        {isUser ? "U" : <Bot size={14} />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted text-foreground rounded-tl-sm"
      )}>
        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        <p className={cn("text-xs mt-1 opacity-60", isUser ? "text-right" : "text-left")}>
          {formatDistanceToNow(msg.ts, { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main inner component ─────────────────────────────────────────────────────

function AiCopilotInner() {
  const { labId } = useActiveLab();

  // Data queries
  const stats     = useQuery(api.samples.getDashboardStats, labId ? { laboratoryId: labId as never } : "skip");
  const samples   = useQuery(api.samples.listSamples,       labId ? { laboratoryId: labId as never } : "skip");
  const instrData = useQuery(api.instruments.getCalibrationsDue, labId ? { laboratoryId: labId as never } : "skip");
  const invAlerts = useQuery(api.inventory.getInventoryAlerts, labId ? { laboratoryId: labId as never } : "skip");
  const qualSumm  = useQuery(api.quality.getQualitySummary,   labId ? { laboratoryId: labId as never } : "skip");
  const billSumm  = useQuery(api.billing.getBillingSummary,   labId ? { laboratoryId: labId as never } : "skip");

  // For analyst productivity tab — use analytics query
  const analyticsDateRange = { fromDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0], toDate: new Date().toISOString().split("T")[0] };
  const analyticsData = useQuery(api.analytics.getAnalytics, labId ? { laboratoryId: labId as never, ...analyticsDateRange } : "skip");

  // Actions
  const copilotAction  = useAction(api.ai.copilotQuery);
  const insightsAction = useAction(api.ai.generateInsights);
  const tatAction      = useAction(api.ai.predictTat);
  const oosRiskAction  = useAction(api.ai.predictOosRisk);
  const productivityAction = useAction(api.ai.analyseAnalystProductivity);

  // State
  const [activeTab, setActiveTab] = useState<"chat" | "insights" | "tat" | "oosrisk" | "productivity">("chat");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm your NextGen AI-LIMS Copilot. I have access to your live lab data — ask me anything about samples, TAT, quality, instruments, inventory, or billing.",
      ts: Date.now(),
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  const [tatData, setTatData] = useState<TatPayload | null>(null);
  const [tatLoading, setTatLoading] = useState(false);
  const [tatLoaded, setTatLoaded] = useState(false);

  const [oosRisk, setOosRisk] = useState<OosRiskPayload | null>(null);
  const [oosRiskLoading, setOosRiskLoading] = useState(false);
  const [oosRiskLoaded, setOosRiskLoaded] = useState(false);

  const [productivity, setProductivity] = useState<ProductivityPayload | null>(null);
  const [productivityLoading, setProductivityLoading] = useState(false);
  const [productivityLoaded, setProductivityLoaded] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dataReady = stats !== undefined && samples !== undefined;

  function getLabContext() {
    const invFlat = invAlerts
      ? [...((invAlerts as {lowStock?: unknown[]}).lowStock ?? []),
         ...((invAlerts as {expiringSoon?: unknown[]}).expiringSoon ?? []),
         ...((invAlerts as {expired?: unknown[]}).expired ?? [])]
      : [];
    return buildLabContext({
      stats:       stats as Record<string, unknown> | null | undefined,
      samples:     samples as unknown[],
      instruments: instrData as unknown[],
      inventory:   invFlat,
      quality:     qualSumm as Record<string, unknown> | null | undefined,
      billing:     billSumm as Record<string, unknown> | null | undefined,
    });
  }

  async function sendMessage(text?: string) {
    const question = (text ?? chatInput).trim();
    if (!question || chatLoading) return;
    setChatInput("");

    const userMsg: ChatMessage = { role: "user", content: question, ts: Date.now() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setChatLoading(true);

    try {
      const historyForApi = updatedHistory.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const { answer } = await copilotAction({
        question,
        labContextJson: getLabContext(),
        historyJson: JSON.stringify(historyForApi),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: answer, ts: Date.now() }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get response.";
      const friendly = msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : msg;
      toast.error(friendly);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const result = await insightsAction({ labContextJson: getLabContext() });
      setInsights(result as InsightsPayload);
      setInsightsLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate insights.";
      const friendly = msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : msg;
      toast.error(friendly);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function loadTat() {
    setTatLoading(true);
    try {
      const activeSamples = (samples ?? [])
        .filter((s) => !["approved", "coa_generated", "delivered", "cancelled", "rejected"].includes((s as {status: string}).status))
        .slice(0, 40)
        .map((s) => {
          const sample = s as {limsNumber?: string; sampleName?: string; priority?: string; status?: string; _creationTime?: number; sampleTests?: unknown[]};
          return {
            limsNumber: sample.limsNumber,
            sampleName: sample.sampleName,
            priority: sample.priority,
            status: sample.status,
            ageInDays: Math.floor((Date.now() - (sample._creationTime ?? Date.now())) / 86400000),
            testCount: Array.isArray(sample.sampleTests) ? sample.sampleTests.length : 0,
          };
        });

      const { predictions } = await tatAction({
        samplesJson: JSON.stringify(activeSamples),
        historicalJson: JSON.stringify({ avgTatDays: (stats as {avgTatDays?: number} | undefined)?.avgTatDays ?? 3, targetTatDays: 5 }),
      });

      const parsed = JSON.parse(predictions) as TatPayload;
      setTatData(parsed);
      setTatLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to predict TAT.";
      const friendly = msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : msg;
      toast.error(friendly);
    } finally {
      setTatLoading(false);
    }
  }

  async function loadOosRisk() {
    setOosRiskLoading(true);
    try {
      const qualityContext = JSON.stringify({
        currentDate: new Date().toISOString(),
        qualitySummary: qualSumm ?? {},
        oosHistory: (qualSumm as { oosHistory?: unknown } | undefined)?.oosHistory ?? [],
        activeSampleCount: (samples ?? []).length,
      });
      const result = await oosRiskAction({ labContextJson: qualityContext });
      setOosRisk(result as OosRiskPayload);
      setOosRiskLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to predict OOS risk.";
      toast.error(msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : msg);
    } finally { setOosRiskLoading(false); }
  }

  async function loadProductivity() {
    setProductivityLoading(true);
    try {
      const analystData = analyticsData?.analystPerformance ?? [];
      const labCtx = JSON.stringify({
        currentDate: new Date().toISOString(),
        dashboardStats: stats ?? {},
        totalSamples: (analyticsData?.totalSamples ?? 0),
        totalTests: (analyticsData?.totalTests ?? 0),
        oosRate: (analyticsData?.oosRate ?? 0),
      });
      const result = await productivityAction({
        analystDataJson: JSON.stringify(analystData),
        labContextJson: labCtx,
      });
      setProductivity(result as ProductivityPayload);
      setProductivityLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyse productivity.";
      toast.error(msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : msg);
    } finally { setProductivityLoading(false); }
  }

  const tabs: { id: "chat" | "insights" | "tat" | "oosrisk" | "productivity"; label: string; icon: React.ReactNode }[] = [
    { id: "chat",         label: "AI Copilot",          icon: <MessageSquare size={14} /> },
    { id: "insights",     label: "Smart Insights",      icon: <Sparkles size={14} /> },
    { id: "tat",          label: "TAT Prediction",      icon: <TrendingUp size={14} /> },
    { id: "oosrisk",      label: "OOS Risk",            icon: <ShieldAlert size={14} /> },
    { id: "productivity", label: "Analyst Productivity",icon: <Users size={14} /> },
  ];

  const tatScore = tatData?.tatHealthScore ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-400/20 flex items-center justify-center shrink-0">
          <Brain size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Copilot</h1>
          <p className="text-sm text-muted-foreground">Powered by AI · Live lab data · Predictive analytics</p>
        </div>
        {!dataReady && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />Loading lab data…
          </div>
        )}
        {dataReady && (
          <div className="ml-auto flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} />Live data connected
          </div>
        )}
      </div>

      {/* Live metric strip */}
      {dataReady && (() => {
        const s = stats as {statusCounts?: Record<string, number>; avgTatDays?: number} | undefined;
        const counts = s?.statusCounts ?? {};
        const active = Object.entries(counts).filter(([k]) => !["approved","coa_generated","delivered","cancelled","rejected"].includes(k)).reduce((a,b) => a + b[1], 0);
        const pending = (counts["pending_review"] ?? 0) + (counts["oos_investigation"] ?? 0);
        const avgTat = s?.avgTatDays;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Active Samples", value: active, icon: <FlaskConical size={14} />, color: "text-blue-500" },
              { label: "Pending Review", value: pending, icon: <Clock size={14} />, color: "text-orange-500" },
              { label: "Avg TAT (days)", value: avgTat != null ? avgTat.toFixed(1) : "—", icon: <TrendingUp size={14} />, color: "text-teal-500" },
              { label: "Insights Ready", value: insightsLoaded ? (insights?.insights.length ?? 0) : "—", icon: <Sparkles size={14} />, color: "text-purple-500" },
            ].map((m) => (
              <Card key={m.label} className="border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("shrink-0", m.color)}>{m.icon}</div>
                  <div>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-bold leading-tight">{m.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* Tab bar */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Chat tab ── */}
      {activeTab === "chat" && (
        <div className="flex flex-col gap-4">
          {/* Suggested questions */}
          {messages.length <= 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Zap size={12} />Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="rounded-2xl border bg-background/50 p-4 space-y-4 min-h-[360px] max-h-[480px] overflow-y-auto">
            {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-4">
                    {[0,1,2].map((i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything about your lab data… (Enter to send)"
              rows={2}
              className="resize-none"
              disabled={chatLoading || !dataReady}
            />
            <Button onClick={() => sendMessage()} disabled={!chatInput.trim() || chatLoading || !dataReady} className="self-end">
              {chatLoading ? <Spinner /> : <Send size={15} />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Smart Insights tab ── */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">AI analyses your live lab data to surface actionable insights.</p>
            <Button onClick={loadInsights} disabled={insightsLoading || !dataReady} size="sm">
              {insightsLoading ? <><Spinner />Analysing…</> : <><RefreshCw size={13} className="mr-1" />{insightsLoaded ? "Refresh" : "Generate Insights"}</>}
            </Button>
          </div>

          {!insightsLoaded && !insightsLoading && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ready to analyse</p>
              <p className="text-sm mt-1">Click "Generate Insights" to get AI-powered findings from your lab data.</p>
            </div>
          )}

          {insightsLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}

          {insightsLoaded && insights && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-xl bg-gradient-to-r from-primary/8 to-teal-500/8 border p-4">
                <div className="flex items-start gap-2">
                  <Brain size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Executive Summary</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{insights.summary}</p>
                  </div>
                </div>
              </div>

              {/* Severity counts */}
              <div className="grid grid-cols-3 gap-3">
                {(["critical", "warning", "info"] as InsightSeverity[]).map((sev) => {
                  const count = insights.insights.filter((i) => i.severity === sev).length;
                  const colors = {
                    critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
                    warning:  "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
                    info:     "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/10 dark:text-blue-400 dark:border-blue-800",
                  };
                  return (
                    <div key={sev} className={cn("rounded-xl border p-3 text-center", colors[sev])}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs capitalize mt-0.5">{sev}</p>
                    </div>
                  );
                })}
              </div>

              {/* Insight cards */}
              <div className="space-y-3">
                {insights.insights
                  .sort((a, b) => { const o = { critical: 0, warning: 1, info: 2 }; return o[a.severity] - o[b.severity]; })
                  .map((ins, i) => <InsightCard key={i} insight={ins} index={i} />)
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAT Prediction tab ── */}
      {activeTab === "tat" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">AI predicts TAT risk for all active samples based on workload and history.</p>
            <Button onClick={loadTat} disabled={tatLoading || !dataReady} size="sm">
              {tatLoading ? <><Spinner />Predicting…</> : <><TrendingUp size={13} className="mr-1" />{tatLoaded ? "Refresh" : "Run TAT Prediction"}</>}
            </Button>
          </div>

          {!tatLoaded && !tatLoading && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ready to predict</p>
              <p className="text-sm mt-1">Click "Run TAT Prediction" to identify at-risk samples.</p>
            </div>
          )}

          {tatLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}

          {tatLoaded && tatData && (
            <div className="space-y-4">
              {/* Health score */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "TAT Health Score", value: `${tatScore}/100`, color: tatScore >= 75 ? "text-green-600" : tatScore >= 50 ? "text-yellow-600" : "text-red-600" },
                  { label: "At Risk", value: tatData.atRisk?.length ?? 0, color: "text-red-600" },
                  { label: "On Track", value: tatData.onTrack ?? 0, color: "text-green-600" },
                  { label: "Avg Days Left", value: (tatData.avgRemainingDays ?? 0).toFixed(1), color: "text-blue-600" },
                ].map((m) => (
                  <Card key={m.label} className="border">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className={cn("text-xl font-bold mt-0.5", m.color)}>{m.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Health bar */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">TAT Health Score</span>
                  <span className={cn("text-sm font-bold",
                    tatScore >= 75 ? "text-green-600" : tatScore >= 50 ? "text-yellow-600" : "text-red-600"
                  )}>{tatScore}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", tatScore >= 75 ? "bg-green-500" : tatScore >= 50 ? "bg-yellow-500" : "bg-red-500")}
                    initial={{ width: 0 }}
                    animate={{ width: `${tatScore}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* At-risk list */}
              {tatData.atRisk?.length > 0 ? (
                <Card className="border">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-500" />
                      At-Risk Samples ({tatData.atRisk.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y px-4 pb-4 pt-0">
                    {tatData.atRisk.map((r, i) => <TatRiskRow key={i} risk={r} index={i} />)}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl border p-6 text-center text-green-600">
                  <CheckCircle2 size={28} className="mx-auto mb-2" />
                  <p className="font-semibold">All samples on track!</p>
                  <p className="text-sm text-muted-foreground mt-1">No samples are currently at risk of missing their TAT target.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OOS Risk Prediction tab ── */}
      {activeTab === "oosrisk" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">AI detects which test categories are trending towards OOS based on historical data.</p>
            <Button onClick={loadOosRisk} disabled={oosRiskLoading || !dataReady} size="sm">
              {oosRiskLoading ? <><Spinner />Analysing…</> : <><ShieldAlert size={13} className="mr-1" />{oosRiskLoaded ? "Refresh" : "Predict OOS Risk"}</>}
            </Button>
          </div>

          {!oosRiskLoaded && !oosRiskLoading && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              <ShieldAlert size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ready to predict</p>
              <p className="text-sm mt-1">Click "Predict OOS Risk" to identify test categories trending towards out-of-specification results.</p>
            </div>
          )}

          {oosRiskLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          )}

          {oosRiskLoaded && oosRisk && (
            <div className="space-y-4">
              {/* Summary + risk score */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 rounded-xl bg-gradient-to-r from-orange-500/8 to-red-500/8 border p-4 flex items-start gap-3">
                  <AlertOctagon size={16} className="text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">OOS Risk Summary</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{oosRisk.summary}</p>
                  </div>
                </div>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Overall Risk Score</p>
                    <p className={cn("text-4xl font-bold",
                      oosRisk.overallRiskScore >= 70 ? "text-red-600" :
                      oosRisk.overallRiskScore >= 40 ? "text-yellow-600" : "text-green-600"
                    )}>{oosRisk.overallRiskScore}</p>
                    <p className="text-xs text-muted-foreground">/100</p>
                    <div className="mt-2 w-full h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full",
                          oosRisk.overallRiskScore >= 70 ? "bg-red-500" :
                          oosRisk.overallRiskScore >= 40 ? "bg-yellow-500" : "bg-green-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${oosRisk.overallRiskScore}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk items */}
              <div className="space-y-3">
                {oosRisk.riskItems.map((item, i) => {
                  const colors = {
                    high:   { border: "border-l-red-500",    bg: "bg-red-50 dark:bg-red-950/20",       badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                    medium: { border: "border-l-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950/20", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
                    low:    { border: "border-l-green-500",  bg: "bg-green-50/50 dark:bg-green-950/10",badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
                  };
                  const c = colors[item.riskLevel];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn("rounded-xl border-l-4 border p-4", c.border, c.bg)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", c.badge)}>
                              {item.riskLevel.toUpperCase()} RISK
                            </span>
                            <span className="text-xs font-semibold">{item.category}</span>
                            <span className="text-xs text-muted-foreground">· {item.testName}</span>
                          </div>
                          <p className="text-sm text-foreground/80">{item.trendReason}</p>
                          <div className="mt-2 flex items-start gap-2 rounded-lg bg-background/70 p-2 border">
                            <Lightbulb size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                            <p className="text-xs">{item.recommendation}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="text-sm font-bold">{item.confidenceScore}%</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Analyst Productivity tab ── */}
      {activeTab === "productivity" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">AI analyses analyst performance over the last 30 days to surface productivity insights.</p>
            <Button onClick={loadProductivity} disabled={productivityLoading || !dataReady} size="sm">
              {productivityLoading ? <><Spinner />Analysing…</> : <><Users size={13} className="mr-1" />{productivityLoaded ? "Refresh" : "Analyse Productivity"}</>}
            </Button>
          </div>

          {!productivityLoaded && !productivityLoading && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ready to analyse</p>
              <p className="text-sm mt-1">Click "Analyse Productivity" for AI-driven analyst performance insights.</p>
            </div>
          )}

          {productivityLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}

          {productivityLoaded && productivity && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-xl bg-gradient-to-r from-primary/8 to-teal-500/8 border p-4 flex items-start gap-3">
                <Brain size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Executive Summary</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{productivity.summary}</p>
                </div>
              </div>

              {/* Top performer + bottleneck */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={14} className="text-green-600" />
                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">Top Performer</span>
                    </div>
                    <p className="font-semibold text-sm">{productivity.topPerformer.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{productivity.topPerformer.reason}</p>
                  </CardContent>
                </Card>

                {productivity.bottleneck.name !== "N/A" && (
                  <Card className="border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-orange-600" />
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">Needs Attention</span>
                      </div>
                      <p className="font-semibold text-sm">{productivity.bottleneck.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{productivity.bottleneck.reason}</p>
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-background/70 p-2 border">
                        <Lightbulb size={11} className="text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-xs">{productivity.bottleneck.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Workload balance */}
              <div className={cn("rounded-xl border p-4 flex items-center gap-3",
                productivity.workloadBalance === "balanced"  ? "border-green-200 bg-green-50/50 dark:bg-green-950/10" :
                productivity.workloadBalance === "imbalanced" ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10" :
                "border-red-200 bg-red-50 dark:bg-red-950/20"
              )}>
                <Activity size={16} className={
                  productivity.workloadBalance === "balanced" ? "text-green-600" :
                  productivity.workloadBalance === "imbalanced" ? "text-yellow-600" : "text-red-600"
                } />
                <div>
                  <p className="text-xs font-semibold capitalize">{productivity.workloadBalance} workload</p>
                  <p className="text-xs text-muted-foreground">Confidence: {productivity.confidenceScore}%</p>
                </div>
              </div>

              {/* Team insights */}
              <Card className="border">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb size={14} className="text-yellow-500" />
                    Team Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-2">
                  {productivity.teamInsights.map((insight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2.5 py-1.5 border-b last:border-0"
                    >
                      <CheckCircle2 size={13} className="text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground/80">{insight}</p>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AiCopilotPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-64"><Skeleton className="h-8 w-40" /></div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Please sign in to access AI Copilot.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <PageGuard allowed={["system_admin", "lab_manager", "supervisor"]}>
          <AiCopilotInner />
        </PageGuard>
      </Authenticated>
    </>
  );
}
