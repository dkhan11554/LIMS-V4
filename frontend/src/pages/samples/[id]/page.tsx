import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  ArrowLeft, Printer, CheckCircle, XCircle, ClipboardList,
  FlaskConical, ShieldCheck, GitBranch, Thermometer,
  Package, TestTube, AlertTriangle, Info, Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";

const CONDITION_OPTIONS = {
  package: ["intact", "damaged", "missing"],
  container: ["intact", "cracked", "leaked", "contaminated"],
  seal: ["intact", "broken", "absent"],
} as const;

type PackageCond = "intact" | "damaged" | "missing";
type ContainerCond = "intact" | "cracked" | "leaked" | "contaminated";
type SealCond = "intact" | "broken" | "absent";

const CONDITION_COLOR: Record<string, string> = {
  intact: "text-green-600 dark:text-green-400",
  damaged: "text-orange-600 dark:text-orange-400",
  missing: "text-red-600 dark:text-red-400",
  cracked: "text-orange-600 dark:text-orange-400",
  leaked: "text-red-600 dark:text-red-400",
  contaminated: "text-red-600 dark:text-red-400",
  broken: "text-orange-600 dark:text-orange-400",
  absent: "text-red-600 dark:text-red-400",
};

const REJECTION_REASONS = [
  "Insufficient sample volume",
  "Incorrect container type",
  "Compromised seal / sample integrity",
  "Improper temperature during transport",
  "Incorrect labelling",
  "Sample damaged",
  "Contamination suspected",
  "Documentation incomplete",
  "Sample expired",
  "Other (see notes)",
];

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sampleId = id as Id<"samples">;

  const sample = useQuery(api.samples.getSample, { id: sampleId });
  const chainOfCustody = useQuery(api.samples.getChainOfCustody, { sampleId });
  const auditTrail = useQuery(api.samples.getAuditTrail, { module: "samples", recordId: sampleId });

  const receiveSample = useMutation(api.samples.receiveSample);
  const acceptSample = useMutation(api.samples.acceptSample);
  const rejectSample = useMutation(api.samples.rejectSample);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [receiptForm, setReceiptForm] = useState({
    packageCondition: "intact" as PackageCond,
    containerCondition: "intact" as ContainerCond,
    sealCondition: "intact" as SealCond,
    temperature: "",
    temperatureAdequate: true,
    sampleConditionNotes: "",
    receivedDate: new Date().toISOString().split("T")[0],
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionOther, setRejectionOther] = useState("");

  const hasConcern =
    receiptForm.packageCondition !== "intact" ||
    receiptForm.containerCondition !== "intact" ||
    receiptForm.sealCondition !== "intact" ||
    !receiptForm.temperatureAdequate;

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await receiveSample({
        id: sampleId,
        packageCondition: receiptForm.packageCondition,
        containerCondition: receiptForm.containerCondition,
        sealCondition: receiptForm.sealCondition,
        temperature: receiptForm.temperature || undefined,
        temperatureAdequate: receiptForm.temperatureAdequate,
        sampleConditionNotes: receiptForm.sampleConditionNotes || undefined,
        receivedDate: receiptForm.receivedDate,
      });
      toast.success("Sample received and condition recorded");
      setReceiptOpen(false);
    } catch { toast.error("Failed to receive sample"); }
    finally { setIsSubmitting(false); }
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await acceptSample({ id: sampleId });
      toast.success("Sample accepted — ready for testing");
    } catch { toast.error("Failed to accept sample"); }
    finally { setIsSubmitting(false); }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = rejectionReason === "Other (see notes)" ? rejectionOther : rejectionReason;
    if (!reason) return toast.error("Provide a rejection reason");
    setIsSubmitting(true);
    try {
      await rejectSample({ id: sampleId, rejectionReason: reason });
      toast.success("Sample rejected and reason recorded");
      setRejectOpen(false);
    } catch { toast.error("Failed to reject sample"); }
    finally { setIsSubmitting(false); }
  };

  const handlePrintLabel = () => {
    if (!sample) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Sample Label</title>
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:16px;}
        .label{border:2px solid #000;padding:12px;width:280px;}
        .lims{font-size:22px;font-weight:bold;letter-spacing:1px;}
        .row{font-size:11px;margin:3px 0;}
        .priority{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;text-transform:uppercase;background:${sample.priority==="stat"?"#fee2e2":sample.priority==="urgent"?"#ffedd5":"#dbeafe"};}
        .barcode{font-family:'Libre Barcode 128',monospace;font-size:40px;margin:6px 0;letter-spacing:0;}
        @media print{@page{margin:0;}}
      </style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap"/>
      </head>
      <body onload="window.print()">
      <div class="label">
        <div class="lims">${sample.limsNumber}</div>
        <div class="barcode">${sample.limsNumber}</div>
        <div class="row"><b>Sample:</b> ${sample.sampleName}</div>
        <div class="row"><b>Customer:</b> ${sample.customer?.name ?? ""}</div>
        ${sample.batchNumber ? `<div class="row"><b>Batch:</b> ${sample.batchNumber}</div>` : ""}
        <div class="row"><b>Date:</b> ${new Date().toLocaleDateString()}</div>
        <div class="row"><span class="priority">${sample.priority}</span></div>
      </div>
      </body></html>
    `);
    w.document.close();
  };

  if (sample === undefined) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!sample) return <div className="p-4 text-muted-foreground">Sample not found.</div>;

  const canReceive = ["registered", "awaiting_receipt"].includes(sample.status);
  const canAcceptReject = sample.status === "received";

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/samples"><ArrowLeft size={16} /> Back</Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono">{sample.limsNumber}</h1>
              <StatusBadge status={sample.status} />
              <PriorityBadge priority={sample.priority} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{sample.sampleName}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handlePrintLabel}>
            <Printer size={14} className="mr-1" /> Print Label
          </Button>
          {canReceive && (
            <Button size="sm" onClick={() => setReceiptOpen(true)}>
              <ClipboardList size={14} className="mr-1" /> Record Receipt
            </Button>
          )}
          {canAcceptReject && (
            <>
              <Button size="sm" variant="secondary" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setRejectOpen(true)}>
                <XCircle size={14} className="mr-1" /> Reject
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAccept} disabled={isSubmitting}>
                <CheckCircle size={14} className="mr-1" /> Accept
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rejection banner */}
      {sample.status === "rejected" && sample.rejectionReason && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Sample Rejected</p>
            <p className="text-sm text-destructive/80">{sample.rejectionReason}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tests">Tests ({sample.enrichedTests.length})</TabsTrigger>
          <TabsTrigger value="condition">Condition & Receipt</TabsTrigger>
          <TabsTrigger value="custody">Chain of Custody</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* ─── Details ─────────────────────────────── */}
        <TabsContent value="details" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Sample Information</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="LIMS #" value={<span className="font-mono font-semibold">{sample.limsNumber}</span>} />
                <Row label="Customer Ref" value={sample.customerSampleNumber} />
                <Row label="Customer" value={sample.customer?.name} />
                <Row label="Project" value={sample.project?.name} />
                <Row label="Sample Name" value={sample.sampleName} />
                <Row label="Sample Type" value={sample.sampleType} />
                <Row label="Product" value={sample.product} />
                <Row label="Batch #" value={sample.batchNumber} />
                <Row label="Lot #" value={sample.lotNumber} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Dates & Logistics</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Mfg. Date" value={sample.manufacturingDate ? format(new Date(sample.manufacturingDate), "PP") : undefined} />
                <Row label="Expiry Date" value={sample.expiryDate ? format(new Date(sample.expiryDate), "PP") : undefined} />
                <Row label="Collection Date" value={sample.collectionDate ? format(new Date(sample.collectionDate), "PP") : undefined} />
                <Row label="Collection Location" value={sample.collectionLocation} />
                <Row label="Received Date" value={sample.receivedDate ? format(new Date(sample.receivedDate), "PP") : undefined} />
                <Row label="Received By" value={sample.receivedByUserName} />
                <Row label="Storage Condition" value={sample.storageCondition} />
                <Row label="Requested Completion" value={sample.requestedCompletionDate ? format(new Date(sample.requestedCompletionDate), "PP") : undefined} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Container Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Container Type" value={sample.containerType} />
                <Row label="Container Count" value={sample.containerCount?.toString()} />
                <Row label="Volume / Weight" value={sample.sampleVolume} />
              </CardContent>
            </Card>

            {sample.customerInstructions && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Info size={13} /> Customer Instructions</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{sample.customerInstructions}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Tests ───────────────────────────────── */}
        <TabsContent value="tests" className="mt-4">
          {sample.enrichedTests.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No tests assigned.</div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Test</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Assigned To</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Result</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sample.enrichedTests.map((st) => (
                    <tr key={st._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{st.testCode}</td>
                      <td className="px-4 py-3 font-medium">{st.testName}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {st.assignedUserName ?? <span className="italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {st.result != null ? (
                          <span className={cn("font-mono text-xs font-semibold", st.passFailStatus === "pass" ? "text-green-600 dark:text-green-400" : st.passFailStatus === "fail" ? "text-red-600 dark:text-red-400" : "")}>
                            {st.result}{st.unit ? ` ${st.unit}` : ""}
                          </span>
                        ) : <span className="text-xs text-muted-foreground italic">Pending</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={st.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─── Condition & Receipt ─────────────────── */}
        <TabsContent value="condition" className="mt-4">
          {!sample.packageCondition ? (
            <div className="text-center py-12 space-y-3">
              <ClipboardList size={36} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No receipt inspection recorded yet.</p>
              {canReceive && (
                <Button onClick={() => setReceiptOpen(true)}>Record Receipt Inspection</Button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Package size={14} /> Packaging & Container</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ConditionRow label="Package Condition" value={sample.packageCondition} />
                  <ConditionRow label="Container Condition" value={sample.containerCondition} />
                  <ConditionRow label="Seal Condition" value={sample.sealCondition} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Thermometer size={14} /> Temperature</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Temperature on Arrival" value={sample.temperature} />
                  <Row label="Temperature Adequate" value={
                    sample.temperatureAdequate === true ? "Yes" :
                    sample.temperatureAdequate === false ? "No" : undefined
                  } />
                </CardContent>
              </Card>
              {sample.sampleConditionNotes && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Condition Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{sample.sampleConditionNotes}</p></CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Chain of Custody ────────────────────── */}
        <TabsContent value="custody" className="mt-4">
          {!chainOfCustody || chainOfCustody.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <GitBranch size={36} className="mx-auto mb-3 opacity-40" />
              No custody entries yet.
            </div>
          ) : (
            <div className="relative space-y-0">
              {chainOfCustody.map((entry, i) => (
                <div key={entry._id} className="flex gap-4 pb-6">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
                      <CustodyIcon action={entry.action} />
                    </div>
                    {i < chainOfCustody.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-0 pt-1 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm capitalize">{entry.action.replace(/_/g, " ")}</p>
                        {entry.fromName && <p className="text-xs text-muted-foreground">From: {entry.fromName}</p>}
                        {entry.toName && <p className="text-xs text-muted-foreground">To: {entry.toName}</p>}
                        {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{entry.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.timestamp), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Audit Trail ─────────────────────────── */}
        <TabsContent value="audit" className="mt-4">
          {!auditTrail || auditTrail.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No audit entries.</p>
          ) : (
            <div className="space-y-2">
              {[...auditTrail].reverse().map((entry) => (
                <div key={entry._id} className="flex items-start gap-3 bg-muted/30 rounded-lg px-4 py-3">
                  <Clock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(entry.timestamp), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">by {entry.userName ?? "System"}</p>
                    {entry.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {entry.reason}</p>}
                    {(entry.oldValue ?? entry.newValue) && (
                      <p className="text-xs text-muted-foreground">
                        {entry.oldValue && <span className="line-through mr-1">{entry.oldValue}</span>}
                        {entry.newValue && <span className="text-foreground font-mono">{entry.newValue}</span>}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Record Receipt Dialog ─────────────────────────────────────── */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList size={18} /> Record Sample Receipt
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="space-y-1">
              <Label>Receipt Date</Label>
              <Input type="date" value={receiptForm.receivedDate} onChange={(e) => setReceiptForm((f) => ({ ...f, receivedDate: e.target.value }))} />
            </div>

            {/* Package */}
            <div className="space-y-2">
              <Label>Package / Outer Packaging Condition</Label>
              <div className="flex gap-2">
                {CONDITION_OPTIONS.package.map((opt) => (
                  <ConditionButton key={opt} value={opt} selected={receiptForm.packageCondition === opt} onClick={() => setReceiptForm((f) => ({ ...f, packageCondition: opt as PackageCond }))} />
                ))}
              </div>
            </div>

            {/* Container */}
            <div className="space-y-2">
              <Label>Container Condition</Label>
              <div className="flex flex-wrap gap-2">
                {CONDITION_OPTIONS.container.map((opt) => (
                  <ConditionButton key={opt} value={opt} selected={receiptForm.containerCondition === opt} onClick={() => setReceiptForm((f) => ({ ...f, containerCondition: opt as ContainerCond }))} />
                ))}
              </div>
            </div>

            {/* Seal */}
            <div className="space-y-2">
              <Label>Seal / Tamper Evidence Condition</Label>
              <div className="flex gap-2">
                {CONDITION_OPTIONS.seal.map((opt) => (
                  <ConditionButton key={opt} value={opt} selected={receiptForm.sealCondition === opt} onClick={() => setReceiptForm((f) => ({ ...f, sealCondition: opt as SealCond }))} />
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Temperature on Arrival</Label>
                <Input value={receiptForm.temperature} onChange={(e) => setReceiptForm((f) => ({ ...f, temperature: e.target.value }))} placeholder="e.g., 5°C" />
              </div>
              <div className="space-y-2">
                <Label>Temperature Adequate?</Label>
                <div className="flex gap-2">
                  <ConditionButton value="Yes" selected={receiptForm.temperatureAdequate} onClick={() => setReceiptForm((f) => ({ ...f, temperatureAdequate: true }))} />
                  <ConditionButton value="No" selected={!receiptForm.temperatureAdequate} onClick={() => setReceiptForm((f) => ({ ...f, temperatureAdequate: false }))} isNegative />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Condition Notes / Observations</Label>
              <textarea
                rows={3}
                value={receiptForm.sampleConditionNotes}
                onChange={(e) => setReceiptForm((f) => ({ ...f, sampleConditionNotes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Describe any observations, deviations, or special remarks..."
              />
            </div>

            {hasConcern && (
              <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2.5">
                <AlertTriangle size={14} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 dark:text-orange-300">One or more conditions are non-conforming. Review carefully before accepting the sample.</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setReceiptOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Confirm Receipt</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ─────────────────────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle size={18} /> Reject Sample
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rejecting this sample will record the reason and notify the relevant parties. This action is logged in the audit trail.
            </p>
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <div className="space-y-1.5">
                {REJECTION_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2.5 cursor-pointer text-sm py-1">
                    <input
                      type="radio"
                      name="rejection"
                      value={r}
                      checked={rejectionReason === r}
                      onChange={() => setRejectionReason(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            {rejectionReason === "Other (see notes)" && (
              <div className="space-y-1">
                <Label>Specify reason</Label>
                <textarea
                  rows={3}
                  value={rejectionOther}
                  onChange={(e) => setRejectionOther(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Describe the reason for rejection..."
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !rejectionReason} variant="destructive">
                Confirm Rejection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ConditionRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold capitalize", CONDITION_COLOR[value] ?? "")}>{value}</span>
    </div>
  );
}

function ConditionButton({ value, selected, onClick, isNegative = false }: { value: string; selected: boolean; onClick: () => void; isNegative?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all border",
        selected
          ? isNegative
            ? "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300"
            : value === "intact" || value === "Yes"
              ? "bg-green-100 border-green-400 text-green-700 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
              : "bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300"
          : "border-border text-muted-foreground hover:border-muted-foreground"
      )}
    >
      {value}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map = {
    routine: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    stat: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  } as const;
  return (
    <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded", map[priority as keyof typeof map] ?? "bg-muted text-muted-foreground")}>
      {priority}
    </span>
  );
}

function CustodyIcon({ action }: { action: string }) {
  if (action === "registered") return <FlaskConical size={14} className="text-primary" />;
  if (action === "received") return <Package size={14} className="text-blue-500" />;
  if (action === "accepted") return <CheckCircle size={14} className="text-green-500" />;
  if (action === "rejected") return <XCircle size={14} className="text-red-500" />;
  if (action === "transferred") return <GitBranch size={14} className="text-purple-500" />;
  return <TestTube size={14} className="text-muted-foreground" />;
}
