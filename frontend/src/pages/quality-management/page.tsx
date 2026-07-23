import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";
import {
  ShieldCheck, Plus, AlertTriangle, CheckCircle2,
  Clock, XCircle, ChevronDown, ChevronUp, Edit2,
  FlaskConical, Wrench, FileText, GitMerge, Sparkles, Brain, Lightbulb, ListChecks
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion, AnimatePresence } from "motion/react";

// ─── Shared status configs ────────────────────────────────────────────

const OOS_STATUS: Record<string, { label: string; color: string }> = {
  open:       { label: "Open",       color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  phase1:     { label: "Phase 1",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  phase2:     { label: "Phase 2",    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  concluded:  { label: "Concluded",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  closed:     { label: "Closed",     color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const DEV_STATUS: Record<string, { label: string; color: string }> = {
  open:                 { label: "Open",          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  under_investigation:  { label: "Investigating",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  closed:               { label: "Closed",         color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const CAPA_STATUS: Record<string, { label: string; color: string }> = {
  open:         { label: "Open",         color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  in_progress:  { label: "In Progress",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  verification: { label: "Verification", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  closed:       { label: "Closed",       color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const CC_STATUS: Record<string, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  submitted:    { label: "Submitted",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  approved:     { label: "Approved",     color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected:     { label: "Rejected",     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  implemented:  { label: "Implemented",  color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  closed:       { label: "Closed",       color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const SEVERITY: Record<string, string> = {
  minor:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  major:    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusPill({ cfg, label }: { cfg: { label: string; color: string }; label?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      {label ?? cfg.label}
    </span>
  );
}

// ─── OOS Tab ──────────────────────────────────────────────────────────

type OosItem = {
  _id: string; oosNumber: string; title: string; status: string;
  detectedDate: string; assigneeName?: string; limsNumber?: string;
  rootCause?: string; outcome?: string;
};

function AddOosDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.quality.createOos);
  const [form, setForm] = useState({ title: "", description: "", detectedDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      await create({ laboratoryId: labId as never, title: form.title, description: form.description, detectedDate: form.detectedDate, notes: form.notes || undefined });
      toast.success("OOS investigation created");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to create OOS");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New OOS Investigation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief description of the OOS result" /></div>
          <div className="space-y-1"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What result was obtained? What was expected?" /></div>
          <div className="space-y-1"><Label>Detected Date *</Label><Input type="date" value={form.detectedDate} onChange={(e) => set("detectedDate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateOosDialog({ item, open, onClose }: { item: OosItem; open: boolean; onClose: () => void }) {
  const update = useMutation(api.quality.updateOos);
  const [status, setStatus] = useState(item.status);
  const [phase1Summary, setP1] = useState("");
  const [phase2Summary, setP2] = useState("");
  const [rootCause, setRootCause] = useState(item.rootCause ?? "");
  const [rootCauseCategory, setRcc] = useState("");
  const [outcome, setOutcome] = useState(item.outcome ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await update({
        id: item._id as never,
        status: status as never,
        phase1Summary: phase1Summary || undefined,
        phase1CompletedDate: status === "phase1" ? new Date().toISOString() : undefined,
        phase2Summary: phase2Summary || undefined,
        phase2CompletedDate: status === "phase2" ? new Date().toISOString() : undefined,
        rootCause: rootCause || undefined,
        rootCauseCategory: rootCauseCategory || undefined,
        outcome: (outcome as never) || undefined,
      });
      toast.success("OOS updated");
      onClose();
    } catch (e) {
      toast.error("Failed to update OOS");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Update OOS — {item.oosNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(OOS_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(status === "phase1" || status === "phase2") && (
            <div className="space-y-1">
              <Label>{status === "phase1" ? "Phase 1 Summary" : "Phase 2 Summary"}</Label>
              <Textarea rows={3} value={status === "phase1" ? phase1Summary : phase2Summary}
                onChange={(e) => status === "phase1" ? setP1(e.target.value) : setP2(e.target.value)} />
            </div>
          )}
          {(status === "concluded" || status === "closed") && (
            <>
              <div className="space-y-1">
                <Label>Root Cause</Label>
                <Textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Root Cause Category</Label>
                <Select value={rootCauseCategory} onValueChange={setRcc}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["human_error", "equipment", "reagent", "method", "environmental", "unknown"].map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invalidated">Invalidated</SelectItem>
                    <SelectItem value="confirmed">Confirmed OOS</SelectItem>
                    <SelectItem value="inconclusive">Inconclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OosSummary = {
  rootCauseHypothesis: string;
  probableCategory: string;
  confidenceScore: number;
  investigationSteps: string[];
  preventiveMeasures: string[];
  executiveSummary: string;
};

function OosTab({ labId }: { labId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<OosItem | null>(null);
  const [summaryOosId, setSummaryOosId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, OosSummary>>({});
  const rows = useQuery(api.quality.listOos, { laboratoryId: labId as never });
  const generateSummary = useAction(api.ai.generateOosSummary);

  async function handleGenerateSummary(r: OosItem) {
    if (summaries[r._id]) { setSummaryOosId(r._id); return; }
    setSummaryOosId(r._id);
    setSummaryLoading(true);
    try {
      const result = await generateSummary({
        oosNumber: r.oosNumber,
        title: r.title,
        description: r.title, // we use title as description fallback
        sampleType: undefined,
      });
      setSummaries((prev) => ({ ...prev, [r._id]: result as OosSummary }));
    } catch {
      toast.error("AI summary unavailable.");
    } finally { setSummaryLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" /> New OOS</Button>
      </div>
      {rows === undefined ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
          <p>No OOS investigations recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const cfg = OOS_STATUS[r.status] ?? OOS_STATUS.open;
            const expanded = summaryOosId === r._id;
            const summary = summaries[r._id];
            return (
              <Card key={r._id} className="border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{r.oosNumber}</span>
                      <StatusPill cfg={cfg} />
                      {r.limsNumber && <span className="text-xs text-muted-foreground">Sample: {r.limsNumber}</span>}
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Detected: {format(parseISO(r.detectedDate), "dd MMM yyyy")}
                      {r.assigneeName && ` · Assigned: ${r.assigneeName}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="secondary" className="gap-1 h-7 px-2 text-xs"
                      onClick={() => {
                        if (expanded) { setSummaryOosId(null); } else { handleGenerateSummary(r as OosItem); }
                      }}>
                      {summaryLoading && expanded ? <Spinner /> : <Sparkles size={12} />}
                      AI
                    </Button>
                    {r.status !== "closed" && (
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r as OosItem)}>
                        <Edit2 size={13} className="mr-1" /> Update
                      </Button>
                    )}
                  </div>
                </CardContent>

                <AnimatePresence>
                  {expanded && summary && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t"
                    >
                      <div className="p-4 space-y-3 bg-gradient-to-r from-primary/4 to-teal-500/4">
                        <div className="flex items-center gap-2 mb-1">
                          <Brain size={14} className="text-primary" />
                          <span className="text-xs font-semibold text-primary">AI Investigation Analysis</span>
                          <span className="text-xs text-muted-foreground ml-auto">{summary.confidenceScore}% confidence</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{summary.executiveSummary}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-lg border bg-background/70 p-3">
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                              <AlertTriangle size={12} className="text-orange-500" />
                              Root Cause Hypothesis
                            </p>
                            <p className="text-xs text-foreground/80">{summary.rootCauseHypothesis}</p>
                            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {summary.probableCategory}
                            </span>
                          </div>
                          <div className="rounded-lg border bg-background/70 p-3">
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                              <ListChecks size={12} className="text-blue-500" />
                              Investigation Steps
                            </p>
                            <ol className="space-y-0.5">
                              {summary.investigationSteps.map((step, i) => (
                                <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>{step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                        <div className="rounded-lg border bg-background/70 p-3">
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                            <Lightbulb size={12} className="text-yellow-500" />
                            Recommended CAPA Actions
                          </p>
                          <ul className="space-y-0.5">
                            {summary.preventiveMeasures.map((m, i) => (
                              <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                                <CheckCircle2 size={11} className="text-primary mt-0.5 shrink-0" />{m}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
      <AddOosDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <UpdateOosDialog item={editing} open={!!editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Deviations Tab ───────────────────────────────────────────────────

type DevItem = {
  _id: string; deviationNumber: string; title: string; status: string;
  severity: string; deviationType: string; detectedDate: string; assigneeName?: string;
};

function AddDevDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.quality.createDeviation);
  const [form, setForm] = useState({
    title: "", description: "", deviationType: "procedural",
    severity: "minor", detectedDate: new Date().toISOString().slice(0, 10), immediateAction: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      await create({
        laboratoryId: labId as never,
        title: form.title,
        description: form.description,
        deviationType: form.deviationType as never,
        severity: form.severity as never,
        detectedDate: form.detectedDate,
        immediateAction: form.immediateAction || undefined,
      });
      toast.success("Deviation recorded");
      onClose();
    } catch (e) {
      toast.error("Failed to record deviation");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record Deviation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.deviationType} onValueChange={(v) => set("deviationType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["equipment", "procedural", "environmental", "material", "personnel", "other"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Detected Date</Label><Input type="date" value={form.detectedDate} onChange={(e) => set("detectedDate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Immediate Action Taken</Label><Textarea rows={2} value={form.immediateAction} onChange={(e) => set("immediateAction", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateDevDialog({ item, open, onClose }: { item: DevItem; open: boolean; onClose: () => void }) {
  const update = useMutation(api.quality.updateDeviation);
  const [status, setStatus] = useState(item.status);
  const [investigation, setInv] = useState("");
  const [rootCause, setRc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await update({ id: item._id as never, status: status as never, investigation: investigation || undefined, rootCause: rootCause || undefined });
      toast.success("Deviation updated");
      onClose();
    } catch (e) { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Deviation — {item.deviationNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DEV_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Investigation Findings</Label><Textarea rows={3} value={investigation} onChange={(e) => setInv(e.target.value)} /></div>
          <div className="space-y-1"><Label>Root Cause</Label><Textarea rows={2} value={rootCause} onChange={(e) => setRc(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviationsTab({ labId }: { labId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DevItem | null>(null);
  const rows = useQuery(api.quality.listDeviations, { laboratoryId: labId as never });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" /> Record Deviation</Button>
      </div>
      {rows === undefined ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench size={36} className="mx-auto mb-3 opacity-30" />
          <p>No deviations recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const statusCfg = DEV_STATUS[r.status] ?? DEV_STATUS.open;
            return (
              <Card key={r._id} className="border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{r.deviationNumber}</span>
                      <StatusPill cfg={statusCfg} />
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium capitalize", SEVERITY[r.severity])}>{r.severity}</span>
                      <span className="text-xs text-muted-foreground capitalize">{r.deviationType}</span>
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Detected: {format(parseISO(r.detectedDate), "dd MMM yyyy")}
                      {r.assigneeName && ` · Assigned: ${r.assigneeName}`}
                    </p>
                  </div>
                  {r.status !== "closed" && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r as DevItem)}>
                      <Edit2 size={13} className="mr-1" /> Update
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AddDevDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <UpdateDevDialog item={editing} open={!!editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── CAPA Tab ────────────────────────────────────────────────────────

type CapaItem = {
  _id: string; capaNumber: string; title: string; status: string;
  capaType: string; priority: string; dueDate?: string; assigneeName?: string; overdue: boolean;
};

function AddCapaDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.quality.createCapa);
  const [form, setForm] = useState({
    title: "", description: "", capaType: "corrective",
    priority: "medium", dueDate: "", actions: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      await create({
        laboratoryId: labId as never,
        title: form.title,
        description: form.description,
        capaType: form.capaType as "corrective" | "preventive",
        priority: form.priority as "low" | "medium" | "high",
        dueDate: form.dueDate || undefined,
        actions: form.actions || undefined,
      });
      toast.success("CAPA created");
      onClose();
    } catch (e) { toast.error("Failed to create CAPA"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New CAPA</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.capaType} onValueChange={(v) => set("capaType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrective">Corrective</SelectItem>
                  <SelectItem value="preventive">Preventive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Planned Actions</Label><Textarea rows={3} value={form.actions} onChange={(e) => set("actions", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create CAPA"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateCapaDialog({ item, open, onClose }: { item: CapaItem; open: boolean; onClose: () => void }) {
  const update = useMutation(api.quality.updateCapa);
  const [status, setStatus] = useState(item.status);
  const [implDate, setImplDate] = useState(new Date().toISOString().slice(0, 10));
  const [verDate, setVerDate] = useState(new Date().toISOString().slice(0, 10));
  const [verCriteria, setVerCriteria] = useState("");
  const [effectiveness, setEff] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await update({
        id: item._id as never,
        status: status as never,
        implementationDate: status === "in_progress" ? implDate : undefined,
        verificationDate: status === "verification" ? verDate : undefined,
        verificationCriteria: verCriteria || undefined,
        effectivenessReview: effectiveness || undefined,
      });
      toast.success("CAPA updated");
      onClose();
    } catch (e) { toast.error("Failed to update CAPA"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update CAPA — {item.capaNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CAPA_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {status === "in_progress" && (
            <div className="space-y-1"><Label>Implementation Date</Label><Input type="date" value={implDate} onChange={(e) => setImplDate(e.target.value)} /></div>
          )}
          {status === "verification" && (
            <>
              <div className="space-y-1"><Label>Verification Date</Label><Input type="date" value={verDate} onChange={(e) => setVerDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>Verification Criteria</Label><Textarea rows={2} value={verCriteria} onChange={(e) => setVerCriteria(e.target.value)} /></div>
            </>
          )}
          {status === "closed" && (
            <div className="space-y-1"><Label>Effectiveness Review</Label><Textarea rows={3} value={effectiveness} onChange={(e) => setEff(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapaTab({ labId }: { labId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CapaItem | null>(null);
  const rows = useQuery(api.quality.listCapas, { laboratoryId: labId as never });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" /> New CAPA</Button>
      </div>
      {rows === undefined ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p>No CAPAs recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const statusCfg = CAPA_STATUS[r.status] ?? CAPA_STATUS.open;
            return (
              <Card key={r._id} className={cn("border", r.overdue ? "border-destructive/40" : "")}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{r.capaNumber}</span>
                      <StatusPill cfg={statusCfg} />
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", PRIORITY[r.priority])}>{r.priority}</span>
                      <span className="text-xs text-muted-foreground capitalize">{r.capaType}</span>
                      {r.overdue && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle size={11} />Overdue</span>}
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{r.title}</p>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      {r.dueDate && <span>Due: {format(parseISO(r.dueDate), "dd MMM yyyy")}</span>}
                      {r.assigneeName && <span>Assigned: {r.assigneeName}</span>}
                    </div>
                  </div>
                  {r.status !== "closed" && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r as CapaItem)}>
                      <Edit2 size={13} className="mr-1" /> Update
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AddCapaDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <UpdateCapaDialog item={editing} open={!!editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Change Control Tab ───────────────────────────────────────────────

function AddChangeControlDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.quality.createChangeControl);
  const [form, setForm] = useState({
    title: "", description: "", changeType: "procedure",
    priority: "medium", justification: "", riskAssessment: "",
    implementationPlan: "", plannedDate: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      await create({
        laboratoryId: labId as never,
        title: form.title,
        description: form.description,
        changeType: form.changeType as never,
        priority: form.priority as "low" | "medium" | "high",
        justification: form.justification || undefined,
        riskAssessment: form.riskAssessment || undefined,
        implementationPlan: form.implementationPlan || undefined,
        plannedDate: form.plannedDate || undefined,
      });
      toast.success("Change control request created");
      onClose();
    } catch (e) { toast.error("Failed to create change control"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Change Control Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Description *</Label><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Change Type</Label>
              <Select value={form.changeType} onValueChange={(v) => set("changeType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["equipment", "method", "reagent", "software", "personnel", "facility", "procedure", "other"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Justification</Label><Textarea rows={2} value={form.justification} onChange={(e) => set("justification", e.target.value)} /></div>
          <div className="space-y-1"><Label>Risk Assessment</Label><Textarea rows={2} value={form.riskAssessment} onChange={(e) => set("riskAssessment", e.target.value)} /></div>
          <div className="space-y-1"><Label>Implementation Plan</Label><Textarea rows={2} value={form.implementationPlan} onChange={(e) => set("implementationPlan", e.target.value)} /></div>
          <div className="space-y-1"><Label>Planned Date</Label><Input type="date" value={form.plannedDate} onChange={(e) => set("plannedDate", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Submit Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateCCDialog({ item, open, onClose }: { item: { _id: string; changeNumber: string; status: string }; open: boolean; onClose: () => void }) {
  const update = useMutation(api.quality.updateChangeControl);
  const [status, setStatus] = useState(item.status);
  const [implDate, setImplDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await update({ id: item._id as never, status: status as never, implementedDate: status === "implemented" ? implDate : undefined, notes: notes || undefined });
      toast.success("Change control updated");
      onClose();
    } catch (e) { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Change Control — {item.changeNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CC_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {status === "implemented" && (
            <div className="space-y-1"><Label>Implementation Date</Label><Input type="date" value={implDate} onChange={(e) => setImplDate(e.target.value)} /></div>
          )}
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeControlTab({ labId }: { labId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ _id: string; changeNumber: string; status: string } | null>(null);
  const rows = useQuery(api.quality.listChangeControls, { laboratoryId: labId as never });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" /> New Request</Button>
      </div>
      {rows === undefined ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GitMerge size={36} className="mx-auto mb-3 opacity-30" />
          <p>No change control requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const statusCfg = CC_STATUS[r.status] ?? CC_STATUS.draft;
            return (
              <Card key={r._id} className="border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{r.changeNumber}</span>
                      <StatusPill cfg={statusCfg} />
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium capitalize", PRIORITY[r.priority])}>{r.priority}</span>
                      <span className="text-xs text-muted-foreground capitalize">{r.changeType}</span>
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requested: {format(parseISO(r.requestedDate), "dd MMM yyyy")}
                      {r.requesterName && ` by ${r.requesterName}`}
                    </p>
                  </div>
                  {r.status !== "closed" && r.status !== "rejected" && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                      <Edit2 size={13} className="mr-1" /> Update
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AddChangeControlDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <UpdateCCDialog item={editing} open={!!editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

type TabId = "oos" | "deviations" | "capa" | "change_control";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "oos",            label: "OOS / OOT",      icon: <FlaskConical size={14} /> },
  { id: "deviations",     label: "Deviations",     icon: <AlertTriangle size={14} /> },
  { id: "capa",           label: "CAPA",           icon: <CheckCircle2 size={14} /> },
  { id: "change_control", label: "Change Control", icon: <GitMerge size={14} /> },
];

function QualityManagementInner() {
  const { labId } = useActiveLab();
  const [activeTab, setActiveTab] = useState<TabId>("oos");

  const summary = useQuery(api.quality.getQualitySummary, labId ? { laboratoryId: labId as never } : "skip");

  if (!labId) return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;

  const kpis = [
    { label: "Open OOS",       value: summary?.openOos ?? 0,              color: "text-red-600",    icon: <FlaskConical size={18} /> },
    { label: "Open Deviations", value: summary?.openDeviations ?? 0,      color: "text-orange-500", icon: <AlertTriangle size={18} /> },
    { label: "Open CAPAs",     value: summary?.openCapas ?? 0,            color: "text-blue-600",   icon: <CheckCircle2 size={18} /> },
    { label: "Overdue CAPAs",  value: summary?.overdueCapas ?? 0,         color: "text-destructive", icon: <Clock size={18} /> },
    { label: "Pending Changes", value: summary?.pendingChangeControls ?? 0, color: "text-teal-600", icon: <GitMerge size={18} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> Quality Management
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">OOS/OOT investigations, deviations, CAPAs and change control</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">
                  {summary === undefined ? <Skeleton className="h-7 w-8" /> : s.value}
                </p>
              </div>
              <span className={s.color}>{s.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >{t.icon}{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "oos"            && <OosTab labId={labId} />}
      {activeTab === "deviations"     && <DeviationsTab labId={labId} />}
      {activeTab === "capa"           && <CapaTab labId={labId} />}
      {activeTab === "change_control" && <ChangeControlTab labId={labId} />}
    </div>
  );
}

export default function QualityManagementPage() {
  return <Authenticated><QualityManagementInner /></Authenticated>;
}
