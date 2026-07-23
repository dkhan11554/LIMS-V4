import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import {
  Calculator, Plus, Sigma, Beaker, FlaskConical, Percent,
  Trash2, Edit, BookOpen, Play, X, Info, RotateCcw, Save,
} from "lucide-react";
import {
  evaluateFormula, mean, stdDev, rsd, confidenceInterval,
  measurementUncertainty, grubbs, FORMULA_TEMPLATES,
} from "@/lib/calculations.ts";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.js";

const CATEGORIES = [
  { value: "dilution",       label: "Dilution",       icon: <Beaker size={13} /> },
  { value: "concentration",  label: "Concentration",  icon: <FlaskConical size={13} /> },
  { value: "recovery",       label: "Recovery",       icon: <Percent size={13} /> },
  { value: "moisture",       label: "Moisture",       icon: <Beaker size={13} /> },
  { value: "yield",          label: "Yield",          icon: <Percent size={13} /> },
  { value: "statistics",     label: "Statistics",     icon: <Sigma size={13} /> },
  { value: "custom",         label: "Custom",         icon: <Calculator size={13} /> },
];

type Variable = { symbol: string; label: string; unit?: string; defaultValue?: number };
type Formula = {
  _id: Id<"calculationFormulas">;
  name: string; description?: string; category: string;
  formula: string; variables: Variable[];
  resultUnit?: string; decimalPlaces?: number;
};

// ─── Scientific Calculator ────────────────────────────────────────────────────

function ScientificCalculator() {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [memory, setMemory] = useState(0);

  const buttons = [
    ["MC", "MR", "M+", "M−"],
    ["sin", "cos", "tan", "√"],
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "−"],
    ["0", ".", "=", "+"],
    ["C", "±", "%", "^"],
  ];

  function press(key: string) {
    if (key === "C") { setDisplay("0"); setExpr(""); return; }
    if (key === "MC") { setMemory(0); return; }
    if (key === "MR") { setDisplay(String(memory)); return; }
    if (key === "M+") { setMemory((m) => m + parseFloat(display)); return; }
    if (key === "M−") { setMemory((m) => m - parseFloat(display)); return; }
    if (key === "=") {
      try {
        const e = expr + display;
        const safe = e.replace(/÷/g, "/").replace(/×/g, "*").replace(/\^/g, "**")
          .replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(")
          .replace(/tan\(/g, "Math.tan(").replace(/√\(/g, "Math.sqrt(");
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${safe});`)();
        setDisplay(typeof result === "number" ? String(parseFloat(result.toFixed(10))) : "Error");
        setExpr("");
      } catch { setDisplay("Error"); setExpr(""); }
      return;
    }
    if (key === "±") { setDisplay((d) => d.startsWith("-") ? d.slice(1) : "-" + d); return; }
    if (key === "%") { setDisplay((d) => String(parseFloat(d) / 100)); return; }
    if (["sin", "cos", "tan", "√"].includes(key)) {
      setExpr((e) => e + display + key + "(");
      setDisplay("0");
      return;
    }
    if (["+", "−", "×", "÷", "^"].includes(key)) {
      setExpr((e) => e + display + key);
      setDisplay("0");
      return;
    }
    if (key === ".") {
      setDisplay((d) => d.includes(".") ? d : d + ".");
      return;
    }
    setDisplay((d) => d === "0" ? key : d + key);
  }

  return (
    <div className="bg-muted/20 rounded-xl border p-4 w-full max-w-xs">
      <div className="bg-background rounded-lg border px-3 py-2 mb-3 text-right">
        <div className="text-xs text-muted-foreground font-mono h-4 overflow-hidden">{expr || " "}</div>
        <div className="text-2xl font-mono font-bold truncate">{display}</div>
      </div>
      {buttons.map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 gap-1.5 mb-1.5">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => press(key)}
              className={cn(
                "rounded-lg text-sm font-medium py-2.5 transition-colors cursor-pointer",
                key === "=" ? "bg-primary text-primary-foreground hover:bg-primary/90" :
                  ["C", "±", "%"].includes(key) ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:opacity-80" :
                    ["+", "−", "×", "÷", "^"].includes(key) ? "bg-primary/10 text-primary hover:bg-primary/20" :
                      ["MC","MR","M+","M−"].includes(key) ? "bg-muted hover:bg-muted/70 text-muted-foreground text-xs" :
                        "bg-background hover:bg-muted border"
              )}
            >{key}</button>
          ))}
        </div>
      ))}
      <div className="text-xs text-muted-foreground text-center mt-2">Memory: {memory}</div>
    </div>
  );
}

// ─── Replicate Stats ──────────────────────────────────────────────────────────

function ReplicateStats() {
  const [reps, setReps] = useState<string[]>(["", "", ""]);

  const values = reps.map((r) => parseFloat(r)).filter((v) => !isNaN(v));
  const avg = values.length >= 1 ? mean(values) : null;
  const sd = values.length >= 2 ? stdDev(values) : null;
  const rsdVal = values.length >= 2 ? rsd(values) : null;
  const uVal = values.length >= 2 ? measurementUncertainty(values) : null;
  const ci = values.length >= 2 ? confidenceInterval(values) : null;
  const grubResult = values.length >= 3 ? grubbs(values) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Replicate Measurements</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReps((r) => [...r, ""])}>
            <Plus size={13} className="mr-1" />Add
          </Button>
          {reps.length > 2 && (
            <Button variant="ghost" size="sm" onClick={() => setReps((r) => r.slice(0, -1))}>
              <X size={13} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {reps.map((v, i) => (
          <div key={i} className="space-y-1">
            <Label className="text-xs">Rep {i + 1}</Label>
            <Input
              type="number"
              value={v}
              onChange={(e) => {
                const next = [...reps];
                next[i] = e.target.value;
                setReps(next);
              }}
              placeholder="0.000"
              className="font-mono text-sm"
            />
          </div>
        ))}
      </div>

      {values.length >= 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {[
            { label: "n", value: values.length, suffix: "" },
            { label: "Mean", value: avg?.toFixed(4), suffix: "" },
            { label: "Std Dev", value: sd?.toFixed(4) ?? "—", suffix: "" },
            { label: "RSD", value: rsdVal != null ? rsdVal.toFixed(2) : "—", suffix: "%" },
            { label: "Uncertainty (u)", value: uVal != null ? uVal.toFixed(4) : "—", suffix: "" },
            { label: "95% CI ±", value: ci != null ? ci.margin.toFixed(4) : "—", suffix: "" },
          ].map((s) => (
            <div key={s.label} className="border rounded-lg p-2.5 bg-muted/20">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold font-mono">{s.value}{s.suffix}</p>
            </div>
          ))}
        </div>
      )}

      {grubResult && grubResult.outlierIndex !== null && (
        <div className="border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={14} className="text-orange-600 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700 dark:text-orange-400">
            Possible outlier detected: Replicate {(grubResult.outlierIndex ?? 0) + 1} (Grubbs G = {grubResult.gStat.toFixed(3)}, Critical = {grubResult.critical.toFixed(3)})
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Formula Runner ───────────────────────────────────────────────────────────

function FormulaRunner({ formula }: { formula: Formula }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(formula.variables.map((v) => [v.symbol, String(v.defaultValue ?? "")]))
  );
  const [result, setResult] = useState<number | null>(null);

  const numericValues = useMemo(
    () => Object.fromEntries(
      Object.entries(values)
        .map(([k, v]) => [k, parseFloat(v)])
        .filter(([, v]) => !isNaN(v as number))
    ) as Record<string, number>,
    [values]
  );

  const liveResult = useMemo(() => {
    if (Object.keys(numericValues).length < formula.variables.length) return null;
    return evaluateFormula(formula.formula, numericValues);
  }, [numericValues, formula]);

  const dp = formula.decimalPlaces ?? 4;

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-lg px-3 py-2 border">
        <p className="text-xs text-muted-foreground">Formula</p>
        <code className="text-sm font-mono text-primary">{formula.formula}</code>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {formula.variables.map((variable) => (
          <div key={variable.symbol} className="space-y-1">
            <Label className="text-xs flex items-center justify-between">
              <span>{variable.label}</span>
              {variable.unit && <span className="text-muted-foreground">{variable.unit}</span>}
            </Label>
            <Input
              type="number"
              value={values[variable.symbol]}
              onChange={(e) => setValues((prev) => ({ ...prev, [variable.symbol]: e.target.value }))}
              placeholder="Enter value"
              className="font-mono text-sm"
            />
          </div>
        ))}
      </div>

      {liveResult !== null && (
        <div className="border-2 border-primary/20 bg-primary/5 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Result</p>
          <p className="text-3xl font-bold font-mono text-primary">
            {liveResult.toFixed(dp)} {formula.resultUnit && <span className="text-lg">{formula.resultUnit}</span>}
          </p>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => setValues(
        Object.fromEntries(formula.variables.map((v) => [v.symbol, String(v.defaultValue ?? "")]))
      )}>
        <RotateCcw size={13} className="mr-1.5" />Reset
      </Button>
    </div>
  );
}

// ─── Formula Builder Dialog ───────────────────────────────────────────────────

function FormulaDialog({
  open, onClose, labId, editFormula,
}: {
  open: boolean; onClose: () => void;
  labId: Id<"laboratories">;
  editFormula?: Formula | null;
}) {
  const createFormula = useMutation(api.calculations.createFormula);
  const updateFormula = useMutation(api.calculations.updateFormula);

  const [name, setName] = useState(editFormula?.name ?? "");
  const [description, setDescription] = useState(editFormula?.description ?? "");
  const [category, setCategory] = useState(editFormula?.category ?? "custom");
  const [formula, setFormula] = useState(editFormula?.formula ?? "");
  const [resultUnit, setResultUnit] = useState(editFormula?.resultUnit ?? "");
  const [decimalPlaces, setDecimalPlaces] = useState(String(editFormula?.decimalPlaces ?? "4"));
  const [variables, setVariables] = useState<Variable[]>(
    editFormula?.variables ?? [{ symbol: "x", label: "Value", unit: "" }]
  );
  const [saving, setSaving] = useState(false);

  // Live test
  const testValues = Object.fromEntries(variables.map((v) => [v.symbol, v.defaultValue ?? 1]));
  const testResult = formula ? evaluateFormula(formula, testValues) : null;

  function addVariable() {
    setVariables((v) => [...v, { symbol: `var${v.length + 1}`, label: "Variable", unit: "" }]);
  }

  function updateVar(i: number, field: keyof Variable, value: string | number | undefined) {
    setVariables((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  async function handleSave() {
    if (!name || !formula) { toast.error("Name and formula are required"); return; }
    setSaving(true);
    try {
      const payload = {
        name, description: description || undefined, category, formula,
        variables: variables.map((v) => ({
          symbol: v.symbol, label: v.label,
          unit: v.unit || undefined, defaultValue: v.defaultValue,
        })),
        resultUnit: resultUnit || undefined,
        decimalPlaces: decimalPlaces ? parseInt(decimalPlaces) : undefined,
      };
      if (editFormula) {
        await updateFormula({ id: editFormula._id, ...payload });
        toast.success("Formula updated");
      } else {
        await createFormula({ laboratoryId: labId, ...payload });
        toast.success("Formula created");
      }
      onClose();
    } catch { toast.error("Failed to save formula"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator size={16} className="text-primary" />
            {editFormula ? "Edit Formula" : "Create Formula"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Formula Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dilution Factor" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this formula calculate?" />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variables</Label>
              <Button variant="ghost" size="sm" type="button" onClick={addVariable}>
                <Plus size={13} className="mr-1" />Add Variable
              </Button>
            </div>
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Symbol</Label>
                    <Input value={v.symbol} onChange={(e) => updateVar(i, "symbol", e.target.value)} placeholder="x" className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={v.label} onChange={(e) => updateVar(i, "label", e.target.value)} placeholder="Description" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input value={v.unit ?? ""} onChange={(e) => updateVar(i, "unit", e.target.value)} placeholder="mg/L" className="text-sm" />
                  </div>
                  <div className="flex gap-1 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Default</Label>
                      <Input type="number" value={v.defaultValue ?? ""} onChange={(e) => updateVar(i, "defaultValue", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="1" className="font-mono text-sm" />
                    </div>
                    {variables.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-destructive" type="button" onClick={() => setVariables((prev) => prev.filter((_, j) => j !== i))}>
                        <X size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formula expression */}
          <div className="space-y-1.5">
            <Label>Formula Expression *</Label>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. (result * dilutionFactor) / sampleWeight * 100"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use variable symbols defined above. Supports: +, −, *, /, **, (, ), Math.sqrt, Math.log, Math.abs
            </p>
            {formula && testResult !== null && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Play size={11} />Live test (using defaults): {testResult.toFixed(parseInt(decimalPlaces) || 4)} {resultUnit}
              </p>
            )}
            {formula && testResult === null && (
              <p className="text-xs text-orange-600">Formula syntax error — check variable names match</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Result Unit</Label>
              <Input value={resultUnit} onChange={(e) => setResultUnit(e.target.value)} placeholder="%, mg/L, g/cm³…" />
            </div>
            <div className="space-y-1.5">
              <Label>Decimal Places</Label>
              <Input type="number" min="0" max="10" value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save size={13} className="mr-1.5" />{saving ? "Saving…" : "Save Formula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalculationsPage() {
  const { labId } = useActiveLab();
  const formulas = useQuery(
    api.calculations.listFormulas,
    labId ? { laboratoryId: labId } : "skip"
  ) as Formula[] | undefined;

  const createFormula = useMutation(api.calculations.createFormula);
  const deleteFormula = useMutation(api.calculations.deleteFormula);

  const [tab, setTab] = useState("library");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFormula, setEditFormula] = useState<Formula | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);

  const filtered = (formulas ?? []).filter(
    (f) => categoryFilter === "all" || f.category === categoryFilter
  );

  async function importTemplate(tpl: typeof FORMULA_TEMPLATES[number]) {
    if (!labId) return;
    try {
      await createFormula({
        laboratoryId: labId,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        formula: tpl.formula,
        variables: tpl.variables,
        resultUnit: tpl.resultUnit,
        decimalPlaces: 4,
      });
      toast.success(`"${tpl.name}" added to your formula library`);
    } catch { toast.error("Failed to import template"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calculations Engine</h1>
            <p className="text-sm text-muted-foreground">Formula library · Dilution · Statistics · Replicates</p>
          </div>
        </div>
        <Button onClick={() => { setEditFormula(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" />New Formula
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="library">Formula Library</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="replicates">Replicate Stats</TabsTrigger>
          <TabsTrigger value="calculator">Scientific Calculator</TabsTrigger>
        </TabsList>

        {/* ── Formula Library ── */}
        <TabsContent value="library" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => (
              <Button
                key={c.value}
                variant={categoryFilter === c.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setCategoryFilter(c.value)}
                className="cursor-pointer"
              >{c.label}</Button>
            ))}
          </div>

          {!formulas ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calculator size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No formulas yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create a custom formula or import from the Templates tab</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((f) => (
                <Card
                  key={f._id}
                  className={cn("cursor-pointer transition-all hover:shadow-md", selectedFormula?._id === f._id && "border-primary ring-1 ring-primary/20")}
                  onClick={() => setSelectedFormula(selectedFormula?._id === f._id ? null : f)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{f.name}</p>
                        {f.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">{f.category}</Badge>
                    </div>
                    <code className="text-xs font-mono text-primary/80 mt-2 block truncate">{f.formula}</code>
                    <div className="flex items-center gap-1 mt-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={(e) => { e.stopPropagation(); setEditFormula(f); setDialogOpen(true); }}>
                        <Edit size={11} className="mr-1" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteFormula({ id: f._id }).then(() => toast.success("Formula deleted")); }}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedFormula && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play size={15} className="text-primary" />Run: {selectedFormula.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormulaRunner formula={selectedFormula} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Templates ── */}
        <TabsContent value="templates" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">Click "Import" to add any template to your laboratory's formula library.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMULA_TEMPLATES.map((tpl) => (
              <Card key={tpl.name}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                      <code className="text-xs font-mono text-primary/80 mt-1.5 block">{tpl.formula}</code>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tpl.variables.map((v) => (
                          <span key={v.symbol} className="text-xs border rounded px-1.5 py-0.5 font-mono bg-muted/50">{v.symbol}</span>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{tpl.category}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => importTemplate(tpl)}>
                    <Plus size={12} className="mr-1" />Import to Library
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Replicate Stats ── */}
        <TabsContent value="replicates" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sigma size={15} className="text-primary" />Replicate Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReplicateStats />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scientific Calculator ── */}
        <TabsContent value="calculator" className="mt-4 flex justify-center">
          <ScientificCalculator />
        </TabsContent>
      </Tabs>

      {labId && (
        <FormulaDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          labId={labId}
          editFormula={editFormula}
        />
      )}
    </div>
  );
}
