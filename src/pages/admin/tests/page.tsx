import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Plus, TestTube, BookOpen, Search, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

const RESULT_TYPES = [
  { value: "numeric", label: "Numeric" },
  { value: "text", label: "Text" },
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "pos_neg", label: "Positive / Negative" },
  { value: "selection", label: "Selection List" },
] as const;

type ResultType = "numeric" | "text" | "pass_fail" | "pos_neg" | "selection";

export default function TestCataloguePage() {
  const { labId } = useActiveLab();
  const tests = useQuery(api.catalogue.listTests, labId ? { laboratoryId: labId } : "skip");
  const categories = useQuery(api.catalogue.listCategories, labId ? { laboratoryId: labId } : "skip");
  const methods = useQuery(api.catalogue.listMethods, labId ? { laboratoryId: labId } : "skip");
  const departments = useQuery(api.organization.listDepartments, labId ? { laboratoryId: labId } : "skip");

  const createTest = useMutation(api.catalogue.createTest);
  const updateTest = useMutation(api.catalogue.updateTest);
  const createMethod = useMutation(api.catalogue.createMethod);
  const updateMethod = useMutation(api.catalogue.updateMethod);

  const [testSearch, setTestSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<string | null>(null);

  const [testForm, setTestForm] = useState({
    testCode: "", name: "", category: "", unit: "",
    resultType: "numeric" as ResultType,
    lowerLimit: "", upperLimit: "", detectionLimit: "",
    standardTAT: "", price: "", decimalPlaces: "",
    departmentId: "", methodId: "",
  });
  const [methodForm, setMethodForm] = useState({
    methodCode: "", name: "", version: "1.0",
    description: "", documentReference: "", departmentId: "", isAccredited: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTests = tests?.filter((t) => {
    if (!showInactive && !t.isActive) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (testSearch) {
      const q = testSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.testCode.toLowerCase().includes(q) || (t.category ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !testForm.testCode || !testForm.name) return toast.error("Code and name required");
    setIsSubmitting(true);
    try {
      await createTest({
        testCode: testForm.testCode,
        name: testForm.name,
        category: testForm.category || undefined,
        unit: testForm.unit || undefined,
        resultType: testForm.resultType,
        lowerLimit: testForm.lowerLimit ? parseFloat(testForm.lowerLimit) : undefined,
        upperLimit: testForm.upperLimit ? parseFloat(testForm.upperLimit) : undefined,
        detectionLimit: testForm.detectionLimit ? parseFloat(testForm.detectionLimit) : undefined,
        decimalPlaces: testForm.decimalPlaces ? parseInt(testForm.decimalPlaces) : undefined,
        standardTAT: testForm.standardTAT ? parseInt(testForm.standardTAT) : undefined,
        price: testForm.price ? parseFloat(testForm.price) : undefined,
        departmentId: testForm.departmentId ? testForm.departmentId as Id<"departments"> : undefined,
        methodId: testForm.methodId ? testForm.methodId as Id<"testMethods"> : undefined,
        laboratoryId: labId,
      });
      toast.success("Test created");
      setTestOpen(false);
      setTestForm({ testCode: "", name: "", category: "", unit: "", resultType: "numeric", lowerLimit: "", upperLimit: "", detectionLimit: "", standardTAT: "", price: "", decimalPlaces: "", departmentId: "", methodId: "" });
    } catch { toast.error("Failed to create test"); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !methodForm.methodCode || !methodForm.name) return toast.error("Code and name required");
    setIsSubmitting(true);
    try {
      await createMethod({
        methodCode: methodForm.methodCode,
        name: methodForm.name,
        version: methodForm.version,
        description: methodForm.description || undefined,
        documentReference: methodForm.documentReference || undefined,
        laboratoryId: labId,
        departmentId: methodForm.departmentId ? methodForm.departmentId as Id<"departments"> : undefined,
        isAccredited: methodForm.isAccredited,
      });
      toast.success("Method created");
      setMethodOpen(false);
    } catch { toast.error("Failed to create method"); }
    finally { setIsSubmitting(false); }
  };

  const toggleTestActive = async (testId: Id<"tests">, current: boolean) => {
    try {
      await updateTest({ id: testId, isActive: !current });
      toast.success(current ? "Test deactivated" : "Test activated");
    } catch { toast.error("Failed to update"); }
  };

  const toggleMethodActive = async (methodId: Id<"testMethods">, current: boolean) => {
    try {
      await updateMethod({ id: methodId, isActive: !current });
      toast.success(current ? "Method deactivated" : "Method activated");
    } catch { toast.error("Failed to update"); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Test Catalogue</h1>
        <p className="text-sm text-muted-foreground">
          {tests?.filter(t => t.isActive).length ?? 0} active tests · {methods?.filter(m => m.isActive).length ?? 0} methods
        </p>
      </div>

      <Tabs defaultValue="tests">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="tests" className="flex items-center gap-1.5">
              <TestTube size={14} /> Tests
            </TabsTrigger>
            <TabsTrigger value="methods" className="flex items-center gap-1.5">
              <BookOpen size={14} /> Methods
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMethodOpen(true)}>
              <Plus size={14} className="mr-1" /> Add Method
            </Button>
            <Button size="sm" onClick={() => setTestOpen(true)}>
              <Plus size={14} className="mr-1" /> Add Test
            </Button>
          </div>
        </div>

        {/* ─── Tests Tab ─────────────────────────────────────── */}
        <TabsContent value="tests" className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm w-56"
                placeholder="Search tests..."
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                All
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              {showInactive ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} />}
              Show inactive
            </button>
          </div>

          {tests === undefined ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredTests?.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><TestTube /></EmptyMedia>
                <EmptyTitle>No tests found</EmptyTitle>
              </EmptyHeader>
              <EmptyContent><Button size="sm" onClick={() => setTestOpen(true)}>Add Test</Button></EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Specification</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Department</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">TAT</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Price</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTests?.map((t) => (
                      <tr key={t._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{t.testCode}</td>
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.category ?? "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{t.resultType.replace("_", "/")}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell font-mono">
                          {t.resultType === "numeric" && (t.lowerLimit != null || t.upperLimit != null)
                            ? `${t.lowerLimit ?? "—"} – ${t.upperLimit ?? "—"}${t.unit ? ` ${t.unit}` : ""}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{t.departmentName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">{t.standardTAT ? `${t.standardTAT}h` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">{t.price != null ? `$${t.price}` : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={t.isActive ? "active" : "inactive"} /></td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleTestActive(t._id, t.isActive)}
                          >
                            {t.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Methods Tab ───────────────────────────────────── */}
        <TabsContent value="methods" className="mt-4">
          {methods === undefined ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : methods.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                <EmptyTitle>No test methods yet</EmptyTitle>
              </EmptyHeader>
              <EmptyContent><Button size="sm" onClick={() => setMethodOpen(true)}>Add Method</Button></EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Version</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Reference</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Department</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Accredited</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {methods.map((m) => (
                    <tr key={m._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{m.methodCode}</td>
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">v{m.version}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{m.documentReference ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{m.departmentName ?? "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {m.isAccredited
                          ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">Yes</span>
                          : <span className="text-xs text-muted-foreground">No</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={m.isActive ? "active" : "inactive"} /></td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => toggleMethodActive(m._id, m.isActive)}
                        >
                          {m.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Add Test Dialog ──────────────────────────────── */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Test</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTest} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Test Code *</Label>
                <Input value={testForm.testCode} onChange={(e) => setTestForm((f) => ({ ...f, testCode: e.target.value }))} placeholder="HPLC-001" />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input value={testForm.category} onChange={(e) => setTestForm((f) => ({ ...f, category: e.target.value }))} placeholder="Chemical" list="categories-list" />
                <datalist id="categories-list">
                  {categories?.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Test Name *</Label>
              <Input value={testForm.name} onChange={(e) => setTestForm((f) => ({ ...f, name: e.target.value }))} placeholder="Assay by HPLC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Result Type</Label>
                <Select value={testForm.resultType} onValueChange={(v) => setTestForm((f) => ({ ...f, resultType: v as ResultType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RESULT_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Input value={testForm.unit} onChange={(e) => setTestForm((f) => ({ ...f, unit: e.target.value }))} placeholder="mg/L, %, NTU..." />
              </div>
            </div>
            {testForm.resultType === "numeric" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Lower Limit</Label>
                  <Input type="number" step="any" value={testForm.lowerLimit} onChange={(e) => setTestForm((f) => ({ ...f, lowerLimit: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Upper Limit</Label>
                  <Input type="number" step="any" value={testForm.upperLimit} onChange={(e) => setTestForm((f) => ({ ...f, upperLimit: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Decimal Places</Label>
                  <Input type="number" min="0" max="10" value={testForm.decimalPlaces} onChange={(e) => setTestForm((f) => ({ ...f, decimalPlaces: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Std TAT (hours)</Label>
                <Input type="number" value={testForm.standardTAT} onChange={(e) => setTestForm((f) => ({ ...f, standardTAT: e.target.value }))} placeholder="24" />
              </div>
              <div className="space-y-1">
                <Label>Price</Label>
                <Input type="number" step="0.01" value={testForm.price} onChange={(e) => setTestForm((f) => ({ ...f, price: e.target.value }))} placeholder="50.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Department</Label>
                <select value={testForm.departmentId} onChange={(e) => setTestForm((f) => ({ ...f, departmentId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">All departments</option>
                  {departments?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <select value={testForm.methodId} onChange={(e) => setTestForm((f) => ({ ...f, methodId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">None</option>
                  {methods?.filter(m => m.isActive).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setTestOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create Test</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Add Method Dialog ────────────────────────────── */}
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Test Method</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateMethod} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Method Code *</Label>
                <Input value={methodForm.methodCode} onChange={(e) => setMethodForm((f) => ({ ...f, methodCode: e.target.value }))} placeholder="USP-905" />
              </div>
              <div className="space-y-1">
                <Label>Version</Label>
                <Input value={methodForm.version} onChange={(e) => setMethodForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.0" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={methodForm.name} onChange={(e) => setMethodForm((f) => ({ ...f, name: e.target.value }))} placeholder="Uniformity of Dosage Units" />
            </div>
            <div className="space-y-1">
              <Label>Document Reference</Label>
              <Input value={methodForm.documentReference} onChange={(e) => setMethodForm((f) => ({ ...f, documentReference: e.target.value }))} placeholder="SOP-CHEM-001" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={methodForm.description} onChange={(e) => setMethodForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <select value={methodForm.departmentId} onChange={(e) => setMethodForm((f) => ({ ...f, departmentId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All departments</option>
                {departments?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={methodForm.isAccredited} onChange={(e) => setMethodForm((f) => ({ ...f, isAccredited: e.target.checked }))} />
              Accredited method
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMethodOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create Method</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
