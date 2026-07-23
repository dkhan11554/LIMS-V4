/**
 * Certificate of Analysis — M36 Enhanced
 * Version control · Watermarks · AI summary · Email tracking · Reissue
 */
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useParams, Link } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Download, ArrowLeft, CheckCircle2, AlertTriangle, FileText,
  Building2, User, Calendar, Hash, FlaskConical, Printer,
  History, Mail, Sparkles, RotateCcw, XCircle, ShieldCheck, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { generateCoaPdf, type CoaData } from "@/lib/generate-coa.ts";
import { format, formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoaRecord = {
  _id: Id<"coaRecords">;
  version: number;
  status: string;
  watermark?: string;
  issuedAt?: string;
  issuerName?: string;
  emailedTo?: string;
  emailedAt?: string;
  aiSummary?: string;
  reissueReason?: string;
  notes?: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
}

function InfoRow({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function SigBox({ role, name, date }: { role: string; name?: string; date?: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-3 space-y-2">
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{role}</p>
      <div className="border-b border-border pb-1 min-h-[28px]">
        {name
          ? <p className="text-sm font-semibold" style={{ fontFamily: "cursive" }}>{name}</p>
          : <p className="text-sm text-muted-foreground italic">Pending</p>}
      </div>
      <p className="text-xs text-muted-foreground">{date ? fmt(date) : "—"}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  issued:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  reissued:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const WM_STYLES: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-500 border-gray-300",
  REISSUED:  "bg-amber-100 text-amber-700 border-amber-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

// ─── Version History Panel ────────────────────────────────────────────────────

function VersionHistory({ records }: { records: CoaRecord[] }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">No versions yet.</p>;
  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r._id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">v{r.version}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_STYLES[r.status])}>
              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
            </span>
            {r.watermark && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded border font-bold", WM_STYLES[r.watermark] ?? "")}>
                {r.watermark}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <p>{r.issuerName ?? "—"}</p>
            <p>{r.issuedAt ? formatDistanceToNow(new Date(r.issuedAt), { addSuffix: true }) : "Draft"}</p>
            {r.emailedTo && <p className="text-green-600 dark:text-green-400">Emailed: {r.emailedTo}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Email Dialog ─────────────────────────────────────────────────────────────

function EmailDialog({ coaRecordId, defaultEmail, onClose }: {
  coaRecordId: Id<"coaRecords">;
  defaultEmail?: string;
  onClose: () => void;
}) {
  const recordEmail = useMutation(api.coa.recordEmailSent);
  const [to, setTo] = useState(defaultEmail ?? "");
  const [saving, setSaving] = useState(false);

  async function handle() {
    if (!to) return;
    setSaving(true);
    try {
      await recordEmail({ id: coaRecordId, emailedTo: to });
      toast.success("Email delivery recorded. Send the downloaded PDF to the customer.");
      onClose();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Email Delivery</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Enter the email address you are sending this COA to. This records delivery in the audit trail.
          </p>
          <div className="space-y-1.5">
            <Label>Recipient Email</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handle} disabled={saving || !to}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : <Mail size={14} className="mr-1.5" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel Dialog ────────────────────────────────────────────────────────────

function CancelDialog({ coaRecordId, onClose }: { coaRecordId: Id<"coaRecords">; onClose: () => void }) {
  const cancel = useMutation(api.coa.cancelCoa);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handle() {
    setSaving(true);
    try {
      await cancel({ id: coaRecordId, reason: reason || undefined });
      toast.success("COA cancelled");
      onClose();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cancel COA</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">This will mark the COA as CANCELLED and add a watermark to all future downloads.</p>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sample retest required" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Back</Button>
          <Button onClick={handle} disabled={saving} className="bg-destructive hover:bg-destructive/90">
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : <XCircle size={14} className="mr-1.5" />}
            Cancel COA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoaPage() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const sampleData = useQuery(api.samples.getSample, sampleId ? { id: sampleId as Id<"samples"> } : "skip");
  const labData = useQuery(api.organization.listLaboratories, {});
  const coaRecords = useQuery(api.coa.listCoaRecords, sampleId ? { sampleId: sampleId as Id<"samples"> } : "skip") as CoaRecord[] | undefined;
  const latestCoa = coaRecords?.[0] ?? null;

  const issueCoa = useMutation(api.coa.issueCoa);
  const saveAiSummary = useMutation(api.coa.saveAiSummary);
  const generateAiSummary = useAction(api.coa.generateAiSummary);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | undefined>(latestCoa?.aiSummary);
  const [showHistory, setShowHistory] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [watermark, setWatermark] = useState<"" | "DRAFT" | "REISSUED">(
    latestCoa?.watermark === "REISSUED" ? "REISSUED" : ""
  );
  const [reissueReason, setReissueReason] = useState("");

  const sample = sampleData ?? null;
  const lab = labData?.[0];
  const canGenerateCoa = sample?.status === "approved" || sample?.status === "coa_generated";

  // Sync AI summary from latest record when it loads
  const effectiveSummary = aiSummary ?? latestCoa?.aiSummary;

  const handleGenerateAi = async () => {
    if (!sample || !latestCoa) return;
    setIsGeneratingAi(true);
    try {
      const { summary } = await generateAiSummary({
        coaRecordId: latestCoa._id,
        sampleName: sample.sampleName,
        batchNumber: sample.batchNumber,
        customerName: sample.customer?.name ?? "Unknown",
        tests: sample.enrichedTests.map((t) => ({
          testName: t.testName,
          result: t.result ?? "Pending",
          unit: t.unit,
          lowerLimit: t.lowerLimit,
          upperLimit: t.upperLimit,
          passFailStatus: t.passFailStatus,
        })),
      });
      setAiSummary(summary);
      // Persist to record
      if (latestCoa) {
        await saveAiSummary({ id: latestCoa._id, aiSummary: summary });
      }
      toast.success("AI summary generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate AI summary");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadCoa = async (isDraft = false) => {
    if (!sample) return;
    setIsGenerating(true);
    try {
      const reviewerIds = new Set(sample.enrichedTests.map((t) => t.reviewedBy).filter(Boolean));
      const qaIds = new Set(sample.enrichedTests.map((t) => t.qaApprovedBy).filter(Boolean));

      // Issue / version the COA record first
      let recordId = latestCoa?._id;
      const shouldIssueNew = !latestCoa || latestCoa.status === "cancelled" || (!isDraft && latestCoa.status === "issued");
      if (shouldIssueNew || isDraft) {
        const newId = await issueCoa({
          sampleId: sample._id,
          laboratoryId: sample.laboratoryId,
          limsNumber: sample.limsNumber,
          watermark: isDraft ? "DRAFT" : (watermark || undefined) as "REISSUED" | undefined,
          aiSummary: effectiveSummary,
          notes: reissueReason || undefined,
          isDraft,
        });
        recordId = newId;
      }

      const version = (latestCoa?.version ?? 0) + (shouldIssueNew ? 1 : 0);

      const coaData: CoaData = {
        labName: lab?.name ?? "Laboratory",
        labAddress: lab?.address,
        accreditationNumber: lab?.accreditationNumber,
        limsNumber: sample.limsNumber,
        sampleName: sample.sampleName,
        sampleType: sample.sampleType,
        product: sample.product,
        batchNumber: sample.batchNumber,
        lotNumber: sample.lotNumber,
        customerSampleNumber: sample.customerSampleNumber,
        customerName: sample.customer?.name ?? "Unknown",
        customerCode: sample.customer?.customerCode,
        projectName: sample.project?.name,
        collectionDate: sample.collectionDate,
        receivedDate: sample.receivedDate,
        reportDate: new Date().toISOString(),
        requestedCompletionDate: sample.requestedCompletionDate,
        analystName: sample.enrichedTests[0]?.assignedUserName,
        reviewerName: reviewerIds.size > 0 ? Array.from(reviewerIds).join(", ") : undefined,
        qaApproverName: qaIds.size > 0 ? Array.from(qaIds).join(", ") : undefined,
        qaApprovedAt: sample.enrichedTests.find((t) => t.qaApprovedAt)?.qaApprovedAt,
        tests: sample.enrichedTests.map((t) => ({
          testCode: t.testCode,
          testName: t.testName,
          result: t.result ?? "Pending",
          unit: t.unit,
          lowerLimit: t.lowerLimit,
          upperLimit: t.upperLimit,
          passFailStatus: t.passFailStatus,
        })),
        coaUrl: window.location.href,
        version: shouldIssueNew ? version : latestCoa?.version,
        watermark: isDraft ? "DRAFT" : (watermark || undefined) as "REISSUED" | undefined,
        aiSummary: effectiveSummary,
        reissueReason: reissueReason || undefined,
      };

      await generateCoaPdf(coaData);
      toast.success(isDraft ? "Draft COA downloaded" : "COA downloaded successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate COA");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!sampleId) return null;
  if (sampleData === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!sample) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Sample not found.</p>
        <Button asChild variant="ghost" className="mt-4"><Link to="/samples">Back to Samples</Link></Button>
      </div>
    );
  }

  const allPass = sample.enrichedTests.every((t) => t.passFailStatus !== "fail");
  const failCount = sample.enrichedTests.filter((t) => t.passFailStatus === "fail").length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/quality/qa-approval"><ArrowLeft size={16} /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Certificate of Analysis</h1>
            <p className="text-sm text-muted-foreground">{sample.limsNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={sample.status} />
          {latestCoa && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", STATUS_STYLES[latestCoa.status] ?? "")}>
              v{latestCoa.version} · {latestCoa.status.charAt(0).toUpperCase() + latestCoa.status.slice(1)}
            </span>
          )}
          <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5" onClick={() => setShowHistory(true)}>
            <History size={14} />Version History
          </Button>
        </div>
      </div>

      {/* Status notice */}
      {!canGenerateCoa && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="shrink-0" />
          COA can only be generated after QA approval. Current status:{" "}
          <span className="font-semibold">{sample.status.replace(/_/g, " ")}</span>
        </div>
      )}

      {/* Overall result banner */}
      {canGenerateCoa && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium",
          allPass
            ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700 text-green-800 dark:text-green-300"
            : "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-700 text-red-800 dark:text-red-300"
        )}>
          {allPass
            ? <><CheckCircle2 size={16} className="shrink-0" />All test results PASS specification — sample compliant.</>
            : <><AlertTriangle size={16} className="shrink-0" />{failCount} test result{failCount !== 1 ? "s" : ""} FAIL specification — sample non-compliant.</>}
        </div>
      )}

      {/* COA Options Panel */}
      {canGenerateCoa && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">COA Options</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Watermark */}
              <div className="space-y-1.5">
                <Label className="text-xs">Watermark</Label>
                <Select value={watermark || "none"} onValueChange={(v) => setWatermark(v === "none" ? "" : v as "DRAFT" | "REISSUED")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (clean official COA)</SelectItem>
                    <SelectItem value="REISSUED">REISSUED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reissue reason */}
              {watermark === "REISSUED" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Reissue Reason</Label>
                  <Input value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} placeholder="e.g. Corrected analyst name" />
                </div>
              )}
            </div>

            {/* AI Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs flex items-center gap-1.5"><Sparkles size={12} className="text-sky-500" />AI Interpretation Summary</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 cursor-pointer text-sky-600 dark:text-sky-400"
                  onClick={handleGenerateAi}
                  disabled={isGeneratingAi || !latestCoa}
                >
                  {isGeneratingAi ? <Spinner className="w-3 h-3" /> : <Sparkles size={11} />}
                  {isGeneratingAi ? "Generating…" : latestCoa ? "Generate AI Summary" : "Issue COA first"}
                </Button>
              </div>
              {effectiveSummary ? (
                <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-sm italic text-foreground/80 leading-relaxed">
                  {effectiveSummary}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No AI summary yet. Click "Generate AI Summary" to add one to the PDF.</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                className="gap-1.5 cursor-pointer"
                onClick={() => handleDownloadCoa(true)}
                disabled={isGenerating}
              >
                <Eye size={14} />Download Draft
              </Button>
              <Button
                onClick={() => handleDownloadCoa(false)}
                disabled={isGenerating}
                className="gap-1.5 cursor-pointer"
              >
                {isGenerating ? <Spinner className="w-4 h-4" /> : <Download size={14} />}
                {isGenerating ? "Generating PDF…" : latestCoa?.status === "issued" ? "Reissue COA" : "Issue & Download COA"}
              </Button>
              {latestCoa && latestCoa.status === "issued" && (
                <>
                  <Button
                    variant="ghost"
                    className="gap-1.5 cursor-pointer"
                    onClick={() => setShowEmail(true)}
                  >
                    <Mail size={14} />Record Email Delivery
                  </Button>
                  <Button
                    variant="ghost"
                    className="gap-1.5 cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setShowCancel(true)}
                  >
                    <XCircle size={14} />Cancel COA
                  </Button>
                </>
              )}
              <Button variant="ghost" className="gap-1.5 cursor-pointer ml-auto" onClick={() => window.print()}>
                <Printer size={14} />Print
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── COA Preview Card ── */}
      <Card className="overflow-hidden">
        {/* Lab header band */}
        <div className="px-6 py-4" style={{ background: "oklch(0.18 0.04 230)" }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{lab?.name ?? "Laboratory"}</h2>
              {lab?.address && <p className="text-xs mt-0.5" style={{ color: "#a5d4df" }}>{lab.address}</p>}
              {lab?.accreditationNumber && (
                <p className="text-xs mt-0.5" style={{ color: "#a5d4df" }}>Accreditation: {lab.accreditationNumber}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a5d4df" }}>Certificate of Analysis</p>
              <p className="text-xl font-mono font-bold text-white mt-1">{sample.limsNumber}</p>
              {latestCoa && (
                <p className="text-xs mt-0.5 font-bold" style={{ color: "#a5d4df" }}>
                  {latestCoa.watermark && (
                    <span className={cn("mr-2 px-1.5 py-0.5 rounded text-[10px]",
                      latestCoa.watermark === "DRAFT" ? "bg-gray-400 text-white" :
                      latestCoa.watermark === "CANCELLED" ? "bg-red-500 text-white" : "bg-amber-400 text-white"
                    )}>{latestCoa.watermark}</span>
                  )}
                  v{latestCoa.version}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: "#a5d4df" }}>
                {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="pt-5 space-y-5">
          {/* AI Summary */}
          {effectiveSummary && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-3">
              <p className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1.5">
                <Sparkles size={11} />AI Interpretation Summary
              </p>
              <p className="text-sm italic text-foreground/80 leading-relaxed">{effectiveSummary}</p>
            </div>
          )}

          {/* Sample + Customer Info */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FlaskConical size={12} /> Sample Information
              </h3>
              <InfoRow label="Sample Name" value={sample.sampleName} />
              <InfoRow label="Sample Type" value={sample.sampleType} />
              <InfoRow label="Product" value={sample.product} />
              <InfoRow label="Batch No." value={sample.batchNumber} />
              <InfoRow label="Lot No." value={sample.lotNumber} />
              <InfoRow label="Customer Ref." value={sample.customerSampleNumber} />
              <InfoRow label="Priority" value={<StatusBadge status={sample.priority} />} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 size={12} /> Customer & Dates
              </h3>
              <InfoRow label="Customer" value={sample.customer?.name} />
              <InfoRow label="Project" value={sample.project?.name} />
              <InfoRow label="Collection Date" value={fmt(sample.collectionDate)} />
              <InfoRow label="Received Date" value={fmt(sample.receivedDate)} />
              <InfoRow label="Completion Due" value={fmt(sample.requestedCompletionDate)} />
              <InfoRow label="Report Date" value={fmt(new Date().toISOString())} />
            </div>
          </div>

          <Separator />

          {/* Results Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Hash size={12} /> Test Results
            </h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "oklch(0.18 0.04 230)" }}>
                    {["Code", "Parameter", "Result", "Unit", "Specification", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sample.enrichedTests.map((t, i) => {
                    const isOos = t.passFailStatus === "fail";
                    const spec =
                      t.lowerLimit != null && t.upperLimit != null ? `${t.lowerLimit} – ${t.upperLimit}`
                      : t.upperLimit != null ? `≤ ${t.upperLimit}`
                      : t.lowerLimit != null ? `≥ ${t.lowerLimit}`
                      : "—";
                    return (
                      <tr key={t._id} className={cn(i % 2 === 0 ? "bg-background" : "bg-muted/30", isOos && "bg-red-50 dark:bg-red-950/10")}>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-muted-foreground">{t.testCode}</td>
                        <td className="px-3 py-2.5 font-medium">{t.testName}</td>
                        <td className={cn("px-3 py-2.5 font-mono font-semibold",
                          isOos ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
                        )}>{t.result ?? "Pending"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{t.unit ?? "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{spec}</td>
                        <td className="px-3 py-2.5">
                          {t.passFailStatus ? (
                            <Badge className={cn("text-xs",
                              t.passFailStatus === "pass"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200"
                            )} variant="outline">
                              {t.passFailStatus.toUpperCase()}
                            </Badge>
                          ) : (
                            <StatusBadge status={t.status} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sample.enrichedTests.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">No test results available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Authorisation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <User size={12} /> Authorisation
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <SigBox role="Analysed by" name={sample.enrichedTests[0]?.assignedUserName} date={sample.enrichedTests[0]?.completedAt} />
              <SigBox role="Technically Reviewed" name={sample.enrichedTests.find((t) => t.reviewedAt) ? "Reviewer" : undefined} date={sample.enrichedTests.find((t) => t.reviewedAt)?.reviewedAt} />
              <SigBox role="QA Approved" name={sample.enrichedTests.find((t) => t.qaApprovedAt) ? "QA Officer" : undefined} date={sample.enrichedTests.find((t) => t.qaApprovedAt)?.qaApprovedAt} />
            </div>
          </div>

          {/* Email delivery record */}
          {latestCoa?.emailedTo && (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
              <Mail size={12} />
              <span>COA emailed to <strong>{latestCoa.emailedTo}</strong> {latestCoa.emailedAt ? formatDistanceToNow(new Date(latestCoa.emailedAt), { addSuffix: true }) : ""}</span>
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2.5 leading-relaxed">
            This Certificate of Analysis relates only to the sample as received. Results are based on the test methods stated and apply solely
            to the sample tested. This document may not be reproduced except in full without written approval of the issuing laboratory.
          </div>
        </CardContent>
      </Card>

      {/* Bottom action bar */}
      {canGenerateCoa && (
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => window.print()} className="gap-2 cursor-pointer">
            <Printer size={15} />Print
          </Button>
          <Button onClick={() => handleDownloadCoa(false)} disabled={isGenerating} className="gap-2 cursor-pointer">
            <Download size={15} />
            {isGenerating ? "Generating PDF…" : "Download COA PDF"}
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {showHistory && (
        <Dialog open onOpenChange={() => setShowHistory(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><History size={16} />COA Version History</DialogTitle></DialogHeader>
            <VersionHistory records={coaRecords ?? []} />
          </DialogContent>
        </Dialog>
      )}
      {showEmail && latestCoa && (
        <EmailDialog
          coaRecordId={latestCoa._id}
          defaultEmail={sample.customer?.email}
          onClose={() => setShowEmail(false)}
        />
      )}
      {showCancel && latestCoa && (
        <CancelDialog coaRecordId={latestCoa._id} onClose={() => setShowCancel(false)} />
      )}
    </div>
  );
}
