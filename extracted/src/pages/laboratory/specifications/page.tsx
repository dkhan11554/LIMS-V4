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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import {
  FileCheck, Plus, CheckCircle2, Clock, Archive, Edit, Trash2,
  ChevronRight, AlertTriangle, Info, BookOpen, Shield, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.js";

const SPEC_TYPES = [
  { value: "product",        label: "Product",        icon: <FileCheck size={13} /> },
  { value: "customer",       label: "Customer",       icon: <Info size={13} /> },
  { value: "regulatory",     label: "Regulatory",     icon: <Shield size={13} /> },
  { value: "pharmacopoeia",  label: "Pharmacopoeia",  icon: <BookOpen size={13} /> },
  { value: "internal",       label: "Internal",       icon: <Archive size={13} /> },
];

const PHARMA_REFS = ["USP", "BP", "EP", "IP", "JP", "ChP", "ICH"];

const STATUS_STYLES: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  superseded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  obsolete:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type SpecSet = {
  _id: Id<"specificationSets">;
  name: string; code: string; type: string;
  pharmacopoeiaRef?: string; product?: string; country?: string;
  version: string; effectiveDate: string; expiryDate?: string;
  status: string; approverName?: string; customerName?: string;
  parameterCount: number; notes?: string;
};

type SpecParam = {
  _id: Id<"specificationParameters">;
  parameterName: string; unit?: string; resultType: string;
  lowerLimit?: number; upperLimit?: number;
  alertLower?: number; alertUpper?: number;
  actionLower?: number; actionUpper?: number;
  nominalValue?: number; tolerance?: number;
  method?: string; notes?: string;
  testName?: string; testCode?: string;
  testId?: Id<"tests">;
};

// ─── Parameter Row ─────────────────────────────────────────────────────────────

function ParamRow({ p, onEdit, onDelete }: { p: SpecParam; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/10">
      <td className="px-3 py-2.5">
        <div className="font-medium text-sm">{p.parameterName}</div>
        {p.testCode && <div className="text-xs text-muted-foreground">{p.testCode}</div>}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.unit || "—"}</td>
      <td className="px-3 py-2.5 font-mono text-xs">
        {p.lowerLimit != null && p.upperLimit != null
          ? `${p.lowerLimit} – ${p.upperLimit}`
          : p.lowerLimit != null ? `≥ ${p.lowerLimit}`
          : p.upperLimit != null ? `≤ ${p.upperLimit}`
          : "—"}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-orange-600 dark:text-orange-400">
        {p.alertLower != null || p.alertUpper != null
          ? `${p.alertLower ?? "?"} – ${p.alertUpper ?? "?"}`
          : "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onEdit}><Edit size={12} /></Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onDelete}><Trash2 size={12} /></Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Add/Edit Parameter Dialog ─────────────────────────────────────────────────

function ParamDialog({
  open, onClose, specSetId, editParam,
}: {
  open: boolean; onClose: () => void;
  specSetId: Id<"specificationSets">;
  editParam?: SpecParam | null;
}) {
  const add = useMutation(api.calculations.addSpecParameter);
  const update = useMutation(api.calculations.updateSpecParameter);
  const { labId } = useActiveLab();
  const tests = useQuery(api.catalogue.listTests, labId ? { laboratoryId: labId } : "skip");

  const [name, setName] = useState(editParam?.parameterName ?? "");
  const [unit, setUnit] = useState(editParam?.unit ?? "");
  const [resultType, setResultType] = useState(editParam?.resultType ?? "numeric");
  const [testId, setTestId] = useState<string>(editParam?.testId ?? "none");
  const [lower, setLower] = useState(editParam?.lowerLimit != null ? String(editParam.lowerLimit) : "");
  const [upper, setUpper] = useState(editParam?.upperLimit != null ? String(editParam.upperLimit) : "");
  const [alertLower, setAlertLower] = useState(editParam?.alertLower != null ? String(editParam.alertLower) : "");
  const [alertUpper, setAlertUpper] = useState(editParam?.alertUpper != null ? String(editParam.alertUpper) : "");
  const [actionLower, setActionLower] = useState(editParam?.actionLower != null ? String(editParam.actionLower) : "");
  const [actionUpper, setActionUpper] = useState(editParam?.actionUpper != null ? String(editParam.actionUpper) : "");
  const [method, setMethod] = useState(editParam?.method ?? "");
  const [notes, setNotes] = useState(editParam?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name) { toast.error("Parameter name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        parameterName: name,
        unit: unit || undefined,
        resultType,
        testId: testId !== "none" ? testId as Id<"tests"> : undefined,
        lowerLimit: lower ? parseFloat(lower) : undefined,
        upperLimit: upper ? parseFloat(upper) : undefined,
        alertLower: alertLower ? parseFloat(alertLower) : undefined,
        alertUpper: alertUpper ? parseFloat(alertUpper) : undefined,
        actionLower: actionLower ? parseFloat(actionLower) : undefined,
        actionUpper: actionUpper ? parseFloat(actionUpper) : undefined,
        method: method || undefined,
        notes: notes || undefined,
      };
      if (editParam) {
        await update({ id: editParam._id, ...payload });
        toast.success("Parameter updated");
      } else {
        await add({ specSetId, ...payload });
        toast.success("Parameter added");
      }
      onClose();
    } catch { toast.error("Failed to save parameter"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editParam ? "Edit Parameter" : "Add Parameter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Parameter Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assay, pH, Moisture" />
            </div>
            <div className="space-y-1.5">
              <Label>Link to Test (optional)</Label>
              <Select value={testId} onValueChange={setTestId}>
                <SelectTrigger><SelectValue placeholder="Select test…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No link</SelectItem>
                  {(tests ?? []).map((t) => <SelectItem key={t._id} value={t._id}>{t.name} ({t.testCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Result Type</Label>
              <Select value={resultType} onValueChange={setResultType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="pass_fail">Pass/Fail</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, mg/L…" />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Method reference" />
            </div>
          </div>

          {resultType === "numeric" && (
            <>
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specification Limits</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Lower Limit</Label><Input type="number" value={lower} onChange={(e) => setLower(e.target.value)} placeholder="NLT" className="font-mono text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Upper Limit</Label><Input type="number" value={upper} onChange={(e) => setUpper(e.target.value)} placeholder="NMT" className="font-mono text-sm" /></div>
                </div>
              </div>
              <div className="border rounded-lg p-3 space-y-2 border-orange-200 dark:border-orange-800">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Alert Limits (warn before OOS)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Alert Lower</Label><Input type="number" value={alertLower} onChange={(e) => setAlertLower(e.target.value)} className="font-mono text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Alert Upper</Label><Input type="number" value={alertUpper} onChange={(e) => setAlertUpper(e.target.value)} className="font-mono text-sm" /></div>
                </div>
              </div>
              <div className="border rounded-lg p-3 space-y-2 border-red-200 dark:border-red-800">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Action Limits (trigger investigation)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Action Lower</Label><Input type="number" value={actionLower} onChange={(e) => setActionLower(e.target.value)} className="font-mono text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Action Upper</Label><Input type="number" value={actionUpper} onChange={(e) => setActionUpper(e.target.value)} className="font-mono text-sm" /></div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : null}
            {editParam ? "Update" : "Add Parameter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Spec Set Detail ──────────────────────────────────────────────────────────

function SpecSetDetail({ specId, onBack }: { specId: Id<"specificationSets">; onBack: () => void }) {
  const specSet = useQuery(api.calculations.getSpecSet, { id: specId });
  const updateSpecSet = useMutation(api.calculations.updateSpecSet);
  const deleteParam = useMutation(api.calculations.deleteSpecParameter);

  const [paramDialog, setParamDialog] = useState(false);
  const [editParam, setEditParam] = useState<SpecParam | null>(null);

  if (!specSet) return <Skeleton className="h-64 rounded-xl" />;

  const params = (specSet as typeof specSet & { parameters?: SpecParam[] }).parameters ?? [];

  async function handleApprove() {
    await updateSpecSet({ id: specId, status: "approved" });
    toast.success("Specification set approved");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronRight size={14} className="rotate-180 mr-1" />Back</Button>
        <h2 className="text-lg font-bold">{specSet.name}</h2>
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[specSet.status])}>{specSet.status}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: "Code", value: specSet.code },
          { label: "Version", value: specSet.version },
          { label: "Type", value: specSet.type },
          { label: "Effective", value: specSet.effectiveDate },
        ].map((f) => (
          <div key={f.label} className="border rounded-lg p-2.5">
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="font-medium capitalize">{f.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Parameters ({params.length})</p>
        <div className="flex gap-2">
          {specSet.status === "draft" && (
            <Button variant="ghost" size="sm" onClick={handleApprove}>
              <CheckCircle2 size={13} className="mr-1.5 text-green-600" />Approve Spec Set
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditParam(null); setParamDialog(true); }}>
            <Plus size={13} className="mr-1.5" />Add Parameter
          </Button>
        </div>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold">Parameter</th>
              <th className="text-left px-3 py-2.5 font-semibold">Unit</th>
              <th className="text-left px-3 py-2.5 font-semibold">Specification</th>
              <th className="text-left px-3 py-2.5 font-semibold">Alert Limits</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {params.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-sm">No parameters yet. Add the first one.</td></tr>
            ) : params.map((p) => (
              <ParamRow
                key={p._id} p={p}
                onEdit={() => { setEditParam(p); setParamDialog(true); }}
                onDelete={() => deleteParam({ id: p._id }).then(() => toast.success("Deleted"))}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ParamDialog
        open={paramDialog}
        onClose={() => { setParamDialog(false); setEditParam(null); }}
        specSetId={specId}
        editParam={editParam}
      />
    </div>
  );
}

// ─── Create Spec Set Dialog ────────────────────────────────────────────────────

function SpecSetDialog({ open, onClose, labId }: {
  open: boolean; onClose: () => void; labId: Id<"laboratories">;
}) {
  const createSpecSet = useMutation(api.calculations.createSpecSet);
  const customers = useQuery(api.customers.listCustomers, { laboratoryId: labId });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("product");
  const [pharmaRef, setPharmaRef] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [product, setProduct] = useState("");
  const [country, setCountry] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !code) { toast.error("Name and code are required"); return; }
    setSaving(true);
    try {
      await createSpecSet({
        laboratoryId: labId, name, code, type,
        pharmacopoeiaRef: pharmaRef || undefined,
        customerId: customerId !== "none" ? customerId as Id<"customers"> : undefined,
        product: product || undefined,
        country: country || undefined,
        version, effectiveDate,
        notes: notes || undefined,
      });
      toast.success("Specification set created");
      onClose();
    } catch { toast.error("Failed to create spec set"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Specification Set</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product X Specification" /></div>
            <div className="space-y-1.5"><Label>Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SPEC-001" /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPEC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" /></div>
            {type === "pharmacopoeia" && (
              <div className="space-y-1.5">
                <Label>Pharmacopoeia Ref</Label>
                <Select value={pharmaRef || "none"} onValueChange={(v) => setPharmaRef(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PHARMA_REFS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {type === "customer" && (
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(customers ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Product / Material</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Paracetamol 500mg" /></div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Globe size={12} />Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. UK, US, EU" />
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Effective Date</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 mr-1.5" /> : null}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpecificationsPage() {
  const { labId } = useActiveLab();
  const specSets = useQuery(
    api.calculations.listSpecSets,
    labId ? { laboratoryId: labId } : "skip"
  ) as SpecSet[] | undefined;

  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"specificationSets"> | null>(null);

  if (selectedId) {
    return <SpecSetDetail specId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const filtered = (specSets ?? []).filter((s) => typeFilter === "all" || s.type === typeFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Specification Management</h1>
            <p className="text-sm text-muted-foreground">Product · Customer · Regulatory · Pharmacopoeia specs</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!labId}>
          <Plus size={14} className="mr-1.5" />New Spec Set
        </Button>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...SPEC_TYPES].map((t) => (
          <Button key={t.value} variant={typeFilter === t.value ? "default" : "ghost"} size="sm" onClick={() => setTypeFilter(t.value)} className="cursor-pointer capitalize">{t.label}</Button>
        ))}
      </div>

      {/* Summary cards */}
      {specSets && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: specSets.length, color: "text-primary" },
            { label: "Approved", value: specSets.filter((s) => s.status === "approved").length, color: "text-green-600 dark:text-green-400" },
            { label: "Draft", value: specSets.filter((s) => s.status === "draft").length, color: "text-yellow-600 dark:text-yellow-400" },
            { label: "Obsolete", value: specSets.filter((s) => s.status === "obsolete" || s.status === "superseded").length, color: "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-3xl font-bold mt-1", s.color)}>{s.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Grid */}
      {!specSets ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileCheck size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No specification sets yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first product, customer, or regulatory spec set</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Card key={s._id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => setSelectedId(s._id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.code} · v{s.version}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", STATUS_STYLES[s.status])}>{s.status}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-xs capitalize">{s.type}</Badge>
                  {s.pharmacopoeiaRef && <Badge variant="outline" className="text-xs">{s.pharmacopoeiaRef}</Badge>}
                  {s.country && <Badge variant="outline" className="text-xs"><Globe size={9} className="mr-0.5" />{s.country}</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{s.parameterCount} parameters</span>
                  <span>Effective: {s.effectiveDate}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {labId && (
        <SpecSetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} labId={labId} />
      )}
    </div>
  );
}
