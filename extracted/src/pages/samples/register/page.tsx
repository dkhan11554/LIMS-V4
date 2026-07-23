import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { useFormValidation } from "@/hooks/use-form-validation.ts";
import { useSmartError } from "@/hooks/use-smart-error.ts";
import { SmartField } from "@/components/ui/smart-field.tsx";
import { ValidationSummary } from "@/components/ui/validation-summary.tsx";
import { SmartErrorDialog } from "@/components/ui/smart-error-dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ArrowLeft, FlaskConical, Plus, X, Search, Printer, CheckCircle2, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_CONDITIONS = ["Room temperature (15–25°C)", "Refrigerated (2–8°C)", "Frozen (-20°C)", "Ultra-frozen (-80°C)", "Dry", "Dark"];
const CONTAINER_TYPES = ["Bottle", "Vial", "Bag", "Tube", "Swab", "Drum", "Jar", "Pouch", "Other"];
const SAMPLE_TYPES = ["Raw Material", "Finished Product", "Intermediate", "In-Process", "Water", "Environmental", "Stability", "Reference Standard", "Other"];
const PRIORITY_COLORS = { routine: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", stat: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" } as const;

export default function RegisterSamplePage() {
  const navigate = useNavigate();
  const { lab, labId } = useActiveLab();
  const registerSample = useMutation(api.samples.registerSample);
  const customers = useQuery(api.customers.listCustomers, labId ? { laboratoryId: labId } : "skip");
  const tests = useQuery(api.catalogue.listTests, labId ? { laboratoryId: labId } : "skip");

  const { fieldErrors, validate, clearFieldError, scrollToField, getIssues, hasErrors } = useFormValidation();
  const { error: smartError, rawError, open: errorOpen, showError, dismiss: dismissError } = useSmartError({
    module: "Samples",
    screen: "Register Sample",
    action: "register",
  });

  const [form, setForm] = useState({
    customerId: "",
    projectId: "",
    sampleName: "",
    sampleType: "",
    product: "",
    batchNumber: "",
    lotNumber: "",
    manufacturingDate: "",
    expiryDate: "",
    collectionDate: new Date().toISOString().split("T")[0],
    collectionLocation: "",
    priority: "routine" as "routine" | "urgent" | "stat",
    containerType: "",
    containerCount: "",
    sampleVolume: "",
    storageCondition: "",
    requestedCompletionDate: "",
    customerInstructions: "",
    customerSampleNumber: "",
    internalNotes: "",
  });
  const [selectedTests, setSelectedTests] = useState<Id<"tests">[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredLimsNumber, setRegisteredLimsNumber] = useState<string | null>(null);
  const [registeredSampleId, setRegisteredSampleId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const projects = useQuery(
    api.customers.listProjects,
    form.customerId && labId ? { customerId: form.customerId as Id<"customers"> } : "skip"
  );

  const activeTests = tests?.filter((t) => t.isActive) ?? [];
  const filteredTests = activeTests.filter((t) => {
    if (!testSearch) return true;
    const q = testSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.testCode.toLowerCase().includes(q) || (t.category ?? "").toLowerCase().includes(q);
  });

  const selectedTestDetails = selectedTests.map((id) => activeTests.find((t) => t._id === id)).filter(Boolean);

  const toggleTest = (id: Id<"tests">) => {
    setSelectedTests((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  // ─── Pre-submission validation ────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const today = new Date().toISOString().split("T")[0];

    const valid = validate([
      {
        fieldId: "customerId",
        fieldLabel: "Customer",
        value: form.customerId,
        required: true,
      },
      {
        fieldId: "sampleName",
        fieldLabel: "Sample Name",
        value: form.sampleName,
        required: true,
      },
      {
        fieldId: "selectedTests",
        fieldLabel: "Tests to Perform",
        value: selectedTests,
        required: true,
      },
      {
        fieldId: "collectionDate",
        fieldLabel: "Collection Date",
        value: form.collectionDate,
        custom: () =>
          form.collectionDate && form.collectionDate > today
            ? "Collection date cannot be in the future — the sample has already been received."
            : null,
      },
      {
        fieldId: "expiryDate",
        fieldLabel: "Expiry Date",
        value: form.expiryDate,
        custom: () =>
          form.expiryDate && form.manufacturingDate && form.expiryDate <= form.manufacturingDate
            ? "Expiry date must be after the manufacturing date."
            : null,
      },
      {
        fieldId: "requestedCompletionDate",
        fieldLabel: "Requested Completion Date",
        value: form.requestedCompletionDate,
        custom: () =>
          form.requestedCompletionDate && form.requestedCompletionDate < today
            ? "The requested completion date must be today or in the future."
            : null,
      },
      {
        fieldId: "containerCount",
        fieldLabel: "No. of Containers",
        value: form.containerCount,
        custom: () =>
          form.containerCount && (isNaN(parseInt(form.containerCount)) || parseInt(form.containerCount) < 1)
            ? "Container count must be a positive number (1 or more)."
            : null,
      },
    ]);

    if (!valid) {
      setShowSummary(true);
      return;
    }

    if (!labId) {
      await showError(new Error("No laboratory found"), {
        title: "No Laboratory Selected",
        detail: "Your account is not linked to any laboratory. Please contact your administrator.",
        fieldId: "laboratoryId",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerSample({
        customerId: form.customerId as Id<"customers">,
        projectId: form.projectId ? form.projectId as Id<"customerProjects"> : undefined,
        laboratoryId: labId,
        sampleName: form.sampleName,
        sampleType: form.sampleType || undefined,
        product: form.product || undefined,
        batchNumber: form.batchNumber || undefined,
        lotNumber: form.lotNumber || undefined,
        manufacturingDate: form.manufacturingDate || undefined,
        expiryDate: form.expiryDate || undefined,
        collectionDate: form.collectionDate || undefined,
        collectionLocation: form.collectionLocation || undefined,
        priority: form.priority,
        containerType: form.containerType || undefined,
        containerCount: form.containerCount ? parseInt(form.containerCount) : undefined,
        sampleVolume: form.sampleVolume || undefined,
        storageCondition: form.storageCondition || undefined,
        requestedCompletionDate: form.requestedCompletionDate || undefined,
        customerInstructions: form.customerInstructions || undefined,
        customerSampleNumber: form.customerSampleNumber || undefined,
        internalNotes: form.internalNotes || undefined,
        testIds: selectedTests,
      });
      setRegisteredLimsNumber(result.limsNumber);
      setRegisteredSampleId(result.sampleId);
      toast.success(`Sample registered: ${result.limsNumber}`);
    } catch (err) {
      await showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintLabel = () => {
    if (!registeredLimsNumber) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const customerName = customers?.find((c) => c._id === form.customerId)?.name ?? "";
    w.document.write(`
      <html><head><title>Sample Label</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
        .label { border: 2px solid #000; padding: 12px; width: 280px; }
        .lims { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
        .row { font-size: 11px; margin: 3px 0; }
        .priority { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; text-transform: uppercase; background: ${form.priority === "stat" ? "#fee2e2" : form.priority === "urgent" ? "#ffedd5" : "#dbeafe"}; }
        .barcode { font-family: "Libre Barcode 128", monospace; font-size: 40px; margin: 6px 0; letter-spacing: 0; }
        @media print { @page { margin: 0; } }
      </style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" />
      </head>
      <body onload="window.print()">
      <div class="label">
        <div class="lims">${registeredLimsNumber}</div>
        <div class="barcode">${registeredLimsNumber}</div>
        <div class="row"><b>Sample:</b> ${form.sampleName}</div>
        <div class="row"><b>Customer:</b> ${customerName}</div>
        ${form.batchNumber ? `<div class="row"><b>Batch:</b> ${form.batchNumber}</div>` : ""}
        ${form.product ? `<div class="row"><b>Product:</b> ${form.product}</div>` : ""}
        <div class="row"><b>Date:</b> ${new Date().toLocaleDateString()}</div>
        <div class="row"><span class="priority">${form.priority}</span></div>
        <div class="row"><b>Tests:</b> ${selectedTestDetails.map((t) => t?.testCode).join(", ")}</div>
      </div>
      </body></html>
    `);
    w.document.close();
  };

  // ─── Success Screen ───────────────────────────────────────────────────────
  if (registeredLimsNumber && registeredSampleId) {
    const selectedCustomer = customers?.find((c) => c._id === form.customerId);
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 size={56} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Sample Registered</h2>
              <p className="text-muted-foreground text-sm mt-1">Sample has been successfully registered in the system</p>
            </div>
            <div className="bg-white dark:bg-card rounded-xl border px-6 py-4 inline-block mx-auto">
              <p className="text-xs text-muted-foreground mb-1">LIMS Number</p>
              <p className="text-3xl font-mono font-bold tracking-widest">{registeredLimsNumber}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-left max-w-xs mx-auto">
              <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{selectedCustomer?.name}</p></div>
              <div><span className="text-muted-foreground">Sample</span><p className="font-medium">{form.sampleName}</p></div>
              <div><span className="text-muted-foreground">Priority</span><p className="font-medium capitalize">{form.priority}</p></div>
              <div><span className="text-muted-foreground">Tests</span><p className="font-medium">{selectedTests.length}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button onClick={handlePrintLabel} variant="secondary">
                <Printer size={14} className="mr-1.5" /> Print Label
              </Button>
              <Button onClick={() => navigate(`/samples/${registeredSampleId}`)}>
                View Sample
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRegisteredLimsNumber(null);
                  setRegisteredSampleId(null);
                  setForm({ customerId: "", projectId: "", sampleName: "", sampleType: "", product: "", batchNumber: "", lotNumber: "", manufacturingDate: "", expiryDate: "", collectionDate: new Date().toISOString().split("T")[0], collectionLocation: "", priority: "routine", containerType: "", containerCount: "", sampleVolume: "", storageCondition: "", requestedCompletionDate: "", customerInstructions: "", customerSampleNumber: "", internalNotes: "" });
                  setSelectedTests([]);
                }}
              >
                Register Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const issues = getIssues();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Smart Error Dialog */}
      <SmartErrorDialog
        open={errorOpen}
        onClose={dismissError}
        error={smartError}
        rawError={rawError}
        onShowField={scrollToField}
      />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/samples"><ArrowLeft size={16} /> Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Register Sample</h1>
          <p className="text-sm text-muted-foreground">Create a new sample submission and assign tests</p>
        </div>
      </div>

      {/* Validation Summary */}
      <AnimatePresence>
        {showSummary && issues.length > 0 && (
          <ValidationSummary
            issues={issues}
            onClose={() => setShowSummary(false)}
            onClickIssue={(fieldId) => {
              setShowSummary(false);
              scrollToField(fieldId);
            }}
          />
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left Column: Sample Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer & Project */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Package size={15} /> Customer & Project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SmartField
                    id="customerId"
                    label="Customer"
                    required
                    error={fieldErrors.customerId}
                    className="col-span-2 md:col-span-1"
                  >
                    <select
                      id="customerId"
                      value={form.customerId}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, customerId: e.target.value, projectId: "" }));
                        if (e.target.value) clearFieldError("customerId");
                      }}
                      className={cn(
                        "w-full h-9 rounded-md border border-input bg-background px-3 text-sm",
                        fieldErrors.customerId && "border-red-500 focus:border-red-500"
                      )}
                      aria-describedby={fieldErrors.customerId ? "customerId-error" : undefined}
                    >
                      <option value="">Select customer...</option>
                      {customers?.filter(c => c.isActive).map((c) => (
                        <option key={c._id} value={c._id}>{c.name} ({c.customerCode})</option>
                      ))}
                    </select>
                  </SmartField>

                  <div className="space-y-1">
                    <Label htmlFor="projectId">Project (optional)</Label>
                    <select
                      id="projectId"
                      value={form.projectId}
                      onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                      disabled={!form.customerId}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                    >
                      <option value="">No project</option>
                      {projects?.filter(p => p.status === "active").map((p) => (
                        <option key={p._id} value={p._id}>{p.name} ({p.projectCode})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="customerSampleNumber">Customer Sample Ref.</Label>
                    <Input
                      id="customerSampleNumber"
                      value={form.customerSampleNumber}
                      onChange={(e) => setForm((f) => ({ ...f, customerSampleNumber: e.target.value }))}
                      placeholder="Customer's own ref #"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Priority *</Label>
                    <div className="flex gap-2">
                      {(["routine", "urgent", "stat"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, priority: p }))}
                          className={cn("flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-all border-2", form.priority === p ? PRIORITY_COLORS[p] + " border-current" : "border-border text-muted-foreground hover:border-muted-foreground")}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FlaskConical size={15} /> Sample Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SmartField
                    id="sampleName"
                    label="Sample Name / Description"
                    required
                    error={fieldErrors.sampleName}
                    className="col-span-2"
                  >
                    <Input
                      id="sampleName"
                      value={form.sampleName}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, sampleName: e.target.value }));
                        if (e.target.value) clearFieldError("sampleName");
                      }}
                      placeholder="e.g., Paracetamol Tablets 500mg"
                      className={cn(fieldErrors.sampleName && "border-red-500")}
                    />
                  </SmartField>

                  <div className="space-y-1">
                    <Label htmlFor="sampleType">Sample Type</Label>
                    <select
                      id="sampleType"
                      value={form.sampleType}
                      onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select type...</option>
                      {SAMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="product">Product / Material</Label>
                    <Input
                      id="product"
                      value={form.product}
                      onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                      placeholder="Product name or code"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="batchNumber">Batch / Lot Number</Label>
                    <Input
                      id="batchNumber"
                      value={form.batchNumber}
                      onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))}
                      placeholder="BN2024-001"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lotNumber">Lot Number</Label>
                    <Input
                      id="lotNumber"
                      value={form.lotNumber}
                      onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="manufacturingDate">Manufacturing Date</Label>
                    <Input
                      id="manufacturingDate"
                      type="date"
                      value={form.manufacturingDate}
                      onChange={(e) => setForm((f) => ({ ...f, manufacturingDate: e.target.value }))}
                    />
                  </div>

                  <SmartField id="expiryDate" label="Expiry Date" error={fieldErrors.expiryDate}>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, expiryDate: e.target.value }));
                        clearFieldError("expiryDate");
                      }}
                      className={cn(fieldErrors.expiryDate && "border-red-500")}
                    />
                  </SmartField>
                </div>
              </CardContent>
            </Card>

            {/* Collection & Container */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Collection & Container</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SmartField id="collectionDate" label="Collection Date" error={fieldErrors.collectionDate}>
                    <Input
                      id="collectionDate"
                      type="date"
                      value={form.collectionDate}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, collectionDate: e.target.value }));
                        clearFieldError("collectionDate");
                      }}
                      className={cn(fieldErrors.collectionDate && "border-red-500")}
                    />
                  </SmartField>

                  <div className="space-y-1">
                    <Label htmlFor="collectionLocation">Collection Location</Label>
                    <Input
                      id="collectionLocation"
                      value={form.collectionLocation}
                      onChange={(e) => setForm((f) => ({ ...f, collectionLocation: e.target.value }))}
                      placeholder="Site / point of collection"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="containerType">Container Type</Label>
                    <select
                      id="containerType"
                      value={form.containerType}
                      onChange={(e) => setForm((f) => ({ ...f, containerType: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select...</option>
                      {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <SmartField id="containerCount" label="No. of Containers" error={fieldErrors.containerCount}>
                    <Input
                      id="containerCount"
                      type="number"
                      min="1"
                      value={form.containerCount}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, containerCount: e.target.value }));
                        clearFieldError("containerCount");
                      }}
                      placeholder="1"
                      className={cn(fieldErrors.containerCount && "border-red-500")}
                    />
                  </SmartField>

                  <div className="space-y-1">
                    <Label htmlFor="sampleVolume">Sample Volume / Weight</Label>
                    <Input
                      id="sampleVolume"
                      value={form.sampleVolume}
                      onChange={(e) => setForm((f) => ({ ...f, sampleVolume: e.target.value }))}
                      placeholder="e.g., 100 mL, 50 g"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="storageCondition">Storage Condition</Label>
                    <select
                      id="storageCondition"
                      value={form.storageCondition}
                      onChange={(e) => setForm((f) => ({ ...f, storageCondition: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select...</option>
                      {STORAGE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <SmartField
                    id="requestedCompletionDate"
                    label="Requested Completion Date"
                    error={fieldErrors.requestedCompletionDate}
                  >
                    <Input
                      id="requestedCompletionDate"
                      type="date"
                      value={form.requestedCompletionDate}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, requestedCompletionDate: e.target.value }));
                        clearFieldError("requestedCompletionDate");
                      }}
                      className={cn(fieldErrors.requestedCompletionDate && "border-red-500")}
                    />
                  </SmartField>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="customerInstructions">Customer Instructions / Remarks</Label>
                  <textarea
                    id="customerInstructions"
                    value={form.customerInstructions}
                    onChange={(e) => setForm((f) => ({ ...f, customerInstructions: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    placeholder="Special handling, regulatory notes, etc."
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="internalNotes" className="flex items-center gap-1.5">
                    Internal Notes
                    <span className="text-xs font-normal text-muted-foreground">(lab staff only — not shown to customer)</span>
                  </Label>
                  <textarea
                    id="internalNotes"
                    value={form.internalNotes}
                    onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Internal observations, sample condition on arrival, special lab instructions, deviations noted, etc."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Test Selection */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    Tests to Perform
                    {fieldErrors.selectedTests && (
                      <span className="text-red-500 text-xs ml-1">*</span>
                    )}
                  </span>
                  {selectedTests.length > 0 && (
                    <Badge variant="secondary">{selectedTests.length} selected</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Test error inline */}
                <AnimatePresence>
                  {fieldErrors.selectedTests && (
                    <motion.div
                      id="selectedTests"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-md px-3 py-2 text-xs text-red-700 dark:text-red-300"
                      role="alert"
                    >
                      {fieldErrors.selectedTests.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected tests */}
                {selectedTestDetails.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedTestDetails.map((t) => t && (
                      <div key={t._id} className="flex items-center justify-between bg-primary/10 rounded-md px-3 py-1.5 text-xs">
                        <div>
                          <span className="font-medium">{t.testCode}</span>
                          <span className="text-muted-foreground ml-1.5">{t.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            toggleTest(t._id);
                            if (selectedTests.length - 1 > 0) clearFieldError("selectedTests");
                          }}
                          className="text-muted-foreground hover:text-destructive ml-2 shrink-0 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                      {selectedTestDetails.length} test{selectedTestDetails.length !== 1 ? "s" : ""} · Est. {Math.max(...selectedTestDetails.map(t => t?.standardTAT ?? 0))}h TAT
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Search tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                  />
                </div>

                {/* Test list */}
                <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
                  {filteredTests.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-4">No tests found</p>
                  ) : filteredTests.map((t) => {
                    const selected = selectedTests.includes(t._id);
                    return (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => {
                          toggleTest(t._id);
                          clearFieldError("selectedTests");
                        }}
                        className={cn(
                          "w-full text-left rounded-md px-3 py-2 text-xs transition-colors flex items-start gap-2 cursor-pointer",
                          selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                        )}
                      >
                        <div className={cn("w-4 h-4 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center", selected ? "bg-primary border-primary" : "border-muted-foreground")}>
                          {selected && <span className="text-primary-foreground text-[10px]">✓</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.name}</p>
                          <p className="text-muted-foreground">{t.testCode}{t.category ? ` · ${t.category}` : ""}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full gap-2"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registering..." : (
                <>
                  <Sparkles size={16} />
                  Register Sample
                </>
              )}
            </Button>

            {hasErrors && !showSummary && (
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowSummary(true)}
                className="w-full text-xs text-red-500 hover:underline cursor-pointer text-center"
              >
                View {issues.length} validation issue{issues.length !== 1 ? "s" : ""}
              </motion.button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
