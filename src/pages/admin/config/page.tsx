import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Settings2, Save, CheckCircle2, XCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils.ts";

// ─── Configuration Section Wrapper ──────────────────────────────────────────────

function ConfigSection({
  title,
  description,
  children,
  onSave,
  isSaving,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
          {onSave && (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="shrink-0 cursor-pointer"
            >
              <Save size={14} className="mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ─── Module list with config keys ───────────────────────────────────────────────

const MODULES: { label: string; key: string }[] = [
  { label: "Sample Registration",    key: "mod_sample_registration" },
  { label: "Chain of Custody",       key: "mod_chain_of_custody" },
  { label: "Test Assignment",        key: "mod_test_assignment" },
  { label: "Result Entry",           key: "mod_result_entry" },
  { label: "Technical Review",       key: "mod_technical_review" },
  { label: "QA Approval",            key: "mod_qa_approval" },
  { label: "COA Generation",         key: "mod_coa_generation" },
  { label: "Billing & Invoicing",    key: "mod_billing" },
  { label: "Revenue & Finance",      key: "mod_revenue" },
  { label: "Customer Portal",        key: "mod_customer_portal" },
  { label: "Inventory Management",   key: "mod_inventory" },
  { label: "Instrument Management",  key: "mod_instruments" },
  { label: "Document Control",       key: "mod_documents" },
  { label: "Training & Competency",  key: "mod_training" },
  { label: "Scheduling",             key: "mod_scheduling" },
  { label: "Analytics & Reporting",  key: "mod_analytics" },
  { label: "Storage & Retention",    key: "mod_storage" },
  { label: "Quality Management",     key: "mod_quality_management" },
  { label: "AI Copilot",             key: "mod_ai_copilot" },
  { label: "Supplier Management",    key: "mod_suppliers" },
  { label: "Audit Management",       key: "mod_audits" },
];

// ─── Main Inner Component ───────────────────────────────────────────────────────

function SystemConfigInner() {
  const { labId } = useActiveLab();
  const config = useQuery(api.config.getAllConfig, labId ? { laboratoryId: labId } : "skip");
  const setBulkConfig = useMutation(api.config.setBulkConfig);

  // ─── Branding ───────────────────────────────────────────────────────
  const [labName, setLabName] = useState("");
  const [accreditationNumber, setAccreditationNumber] = useState("");
  const [reportFooter, setReportFooter] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);

  // ─── Numbering ──────────────────────────────────────────────────────
  const [limsPrefix, setLimsPrefix] = useState("LIMS");
  const [limsDigits, setLimsDigits] = useState("6");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [quotationPrefix, setQuotationPrefix] = useState("");
  const [separator, setSeparator] = useState("-");
  const [numberingSaving, setNumberingSaving] = useState(false);

  // ─── TAT ────────────────────────────────────────────────────────────
  const [routineTat, setRoutineTat] = useState("");
  const [urgentTat, setUrgentTat] = useState("");
  const [statTat, setStatTat] = useState("");
  const [tatSaving, setTatSaving] = useState(false);

  // ─── Date & Time ────────────────────────────────────────────────────
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [dateSaving, setDateSaving] = useState(false);

  // ─── Email Notifications ────────────────────────────────────────────
  const [emailSampleRegistered, setEmailSampleRegistered] = useState(false);
  const [emailTestsAssigned, setEmailTestsAssigned] = useState(false);
  const [emailResultsSubmitted, setEmailResultsSubmitted] = useState(false);
  const [emailQaApproved, setEmailQaApproved] = useState(false);
  const [emailCoaGenerated, setEmailCoaGenerated] = useState(false);
  const [emailInvoiceCreated, setEmailInvoiceCreated] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  // ─── Hydrate from config ────────────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    setLabName(config["lab_name"] ?? "");
    setAccreditationNumber(config["accreditation_number"] ?? "");
    setReportFooter(config["report_footer"] ?? "");
    setLabAddress(config["lab_address"] ?? "");
    setLimsPrefix(config["lims_prefix"] ?? "LIMS");
    setLimsDigits(config["lims_digits"] ?? "6");
    setInvoicePrefix(config["invoice_prefix"] ?? "");
    setQuotationPrefix(config["quotation_prefix"] ?? "");
    setSeparator(config["separator"] ?? "-");
    setRoutineTat(config["tat_routine"] ?? "");
    setUrgentTat(config["tat_urgent"] ?? "");
    setStatTat(config["tat_stat"] ?? "");
    setDateFormat(config["date_format"] ?? "DD/MM/YYYY");
    setTimeFormat(config["time_format"] ?? "24h");
    setEmailSampleRegistered(config["email_sample_registered"] === "true");
    setEmailTestsAssigned(config["email_tests_assigned"] === "true");
    setEmailResultsSubmitted(config["email_results_submitted"] === "true");
    setEmailQaApproved(config["email_qa_approved"] === "true");
    setEmailCoaGenerated(config["email_coa_generated"] === "true");
    setEmailInvoiceCreated(config["email_invoice_created"] === "true");
  }, [config]);

  if (!labId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No laboratory configured</p>
      </div>
    );
  }

  if (config === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  // ─── Save helpers ─────────────────────────────────────────────────────

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [
          { key: "lab_name", value: labName },
          { key: "accreditation_number", value: accreditationNumber },
          { key: "report_footer", value: reportFooter },
          { key: "lab_address", value: labAddress },
        ],
      });
      toast.success("Branding settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBrandingSaving(false);
    }
  };

  const saveNumbering = async () => {
    setNumberingSaving(true);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [
          { key: "lims_prefix", value: limsPrefix },
          { key: "lims_digits", value: limsDigits },
          { key: "invoice_prefix", value: invoicePrefix },
          { key: "quotation_prefix", value: quotationPrefix },
          { key: "separator", value: separator },
        ],
      });
      toast.success("Numbering settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setNumberingSaving(false);
    }
  };

  const saveTat = async () => {
    setTatSaving(true);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [
          { key: "tat_routine", value: routineTat },
          { key: "tat_urgent", value: urgentTat },
          { key: "tat_stat", value: statTat },
        ],
      });
      toast.success("TAT targets saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setTatSaving(false);
    }
  };

  const saveDateTime = async () => {
    setDateSaving(true);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [
          { key: "date_format", value: dateFormat },
          { key: "time_format", value: timeFormat },
        ],
      });
      toast.success("Date & time settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setDateSaving(false);
    }
  };

  const saveEmail = async () => {
    setEmailSaving(true);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [
          { key: "email_sample_registered", value: String(emailSampleRegistered) },
          { key: "email_tests_assigned", value: String(emailTestsAssigned) },
          { key: "email_results_submitted", value: String(emailResultsSubmitted) },
          { key: "email_qa_approved", value: String(emailQaApproved) },
          { key: "email_coa_generated", value: String(emailCoaGenerated) },
          { key: "email_invoice_created", value: String(emailInvoiceCreated) },
        ],
      });
      toast.success("Email notification settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">System Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Laboratory settings, numbering, branding & preferences
          </p>
        </div>
      </div>

      {/* 1. Laboratory Branding */}
      <ConfigSection
        title="Laboratory Branding"
        description="Basic laboratory identity used on reports and documents"
        onSave={saveBranding}
        isSaving={brandingSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Laboratory Name</Label>
            <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Acme Analytical Labs" />
          </div>
          <div className="space-y-1.5">
            <Label>Accreditation Number</Label>
            <Input value={accreditationNumber} onChange={(e) => setAccreditationNumber(e.target.value)} placeholder="ISO-17025-XXXX" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Report Footer Text</Label>
          <Input value={reportFooter} onChange={(e) => setReportFooter(e.target.value)} placeholder="This report shall not be reproduced..." />
        </div>
        <div className="space-y-1.5">
          <Label>Laboratory Address</Label>
          <Input value={labAddress} onChange={(e) => setLabAddress(e.target.value)} placeholder="123 Science Drive, Lab City" />
        </div>
      </ConfigSection>

      {/* 2. Numbering Formats */}
      <ConfigSection
        title="Numbering Formats"
        description="Configure auto-generated reference number patterns"
        onSave={saveNumbering}
        isSaving={numberingSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>LIMS Number Prefix</Label>
            <Input value={limsPrefix} onChange={(e) => setLimsPrefix(e.target.value)} placeholder="LIMS" />
          </div>
          <div className="space-y-1.5">
            <Label>LIMS Number Digits</Label>
            <Select value={limsDigits} onValueChange={setLimsDigits}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 digits</SelectItem>
                <SelectItem value="5">5 digits</SelectItem>
                <SelectItem value="6">6 digits</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Prefix</Label>
            <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="INV" />
          </div>
          <div className="space-y-1.5">
            <Label>Quotation Prefix</Label>
            <Input value={quotationPrefix} onChange={(e) => setQuotationPrefix(e.target.value)} placeholder="QUO" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Separator Character</Label>
          <Select value={separator} onValueChange={setSeparator}>
            <SelectTrigger className="cursor-pointer w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-">Hyphen (-)</SelectItem>
              <SelectItem value="/">Slash (/)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ConfigSection>

      {/* 3. TAT Targets */}
      <ConfigSection
        title="TAT Targets"
        description="Default turnaround time targets for different priority levels"
        onSave={saveTat}
        isSaving={tatSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Routine TAT (hours)</Label>
            <Input type="number" value={routineTat} onChange={(e) => setRoutineTat(e.target.value)} placeholder="72" />
          </div>
          <div className="space-y-1.5">
            <Label>Urgent TAT (hours)</Label>
            <Input type="number" value={urgentTat} onChange={(e) => setUrgentTat(e.target.value)} placeholder="24" />
          </div>
          <div className="space-y-1.5">
            <Label>STAT TAT (hours)</Label>
            <Input type="number" value={statTat} onChange={(e) => setStatTat(e.target.value)} placeholder="4" />
          </div>
        </div>
      </ConfigSection>

      {/* 4. Date & Time */}
      <ConfigSection
        title="Date & Time"
        description="Display format preferences for dates and times"
        onSave={saveDateTime}
        isSaving={dateSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Time Format</Label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ConfigSection>

      {/* 5. Email Notifications */}
      <ConfigSection
        title="Email Notifications"
        description="Choose which workflow events trigger email notifications"
        onSave={saveEmail}
        isSaving={emailSaving}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EmailToggle label="Sample registered" checked={emailSampleRegistered} onChange={setEmailSampleRegistered} />
          <EmailToggle label="Tests assigned" checked={emailTestsAssigned} onChange={setEmailTestsAssigned} />
          <EmailToggle label="Results submitted" checked={emailResultsSubmitted} onChange={setEmailResultsSubmitted} />
          <EmailToggle label="QA approved" checked={emailQaApproved} onChange={setEmailQaApproved} />
          <EmailToggle label="COA generated" checked={emailCoaGenerated} onChange={setEmailCoaGenerated} />
          <EmailToggle label="Invoice created" checked={emailInvoiceCreated} onChange={setEmailInvoiceCreated} />
        </div>
      </ConfigSection>

      {/* 6. Module Status — live toggles */}
      <ModuleStatusSection labId={labId} config={config} setBulkConfig={setBulkConfig} />
    </div>
  );
}

// ─── Module Status Section ──────────────────────────────────────────────────────

function ModuleStatusSection({
  labId,
  config,
  setBulkConfig,
}: {
  labId: import("@/convex/_generated/dataModel.js").Id<"laboratories">;
  config: Record<string, string> | null | undefined;
  setBulkConfig: ReturnType<typeof useMutation<typeof import("@/convex/_generated/api.js").api.config.setBulkConfig>>;
}) {
  const [toggling, setToggling] = useState<string | null>(null);

  // Module is active unless explicitly set to "false"
  function isActive(key: string) {
    return config?.[key] !== "false";
  }

  async function toggle(key: string) {
    const nowActive = isActive(key);
    setToggling(key);
    try {
      await setBulkConfig({
        laboratoryId: labId,
        configs: [{ key, value: nowActive ? "false" : "true" }],
      });
      toast.success(`Module ${nowActive ? "deactivated" : "activated"}`);
    } catch {
      toast.error("Failed to update module status");
    } finally {
      setToggling(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Power size={16} className="text-primary" /> Module Status
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Activate or deactivate system modules. Deactivated modules are hidden from all users until re-enabled.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((mod) => {
            const active = isActive(mod.key);
            const isBusy = toggling === mod.key;
            return (
              <div
                key={mod.key}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
                  active ? "border-border" : "border-border bg-muted/40 opacity-75"
                )}
              >
                <span className={cn("text-sm font-medium", !active && "text-muted-foreground")}>{mod.label}</span>
                <button
                  onClick={() => void toggle(mod.key)}
                  disabled={isBusy}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                    active
                      ? "bg-green-100 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      : "bg-red-100 text-red-600 border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                    isBusy && "opacity-50 pointer-events-none"
                  )}
                  title={active ? "Click to deactivate" : "Click to activate"}
                >
                  {active
                    ? <><CheckCircle2 size={11} /> Active</>
                    : <><XCircle size={11} /> Inactive</>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Note: Deactivating a module hides its sidebar link from all non-admin users immediately. System Administrators always retain access.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Email Toggle Component ─────────────────────────────────────────────────────

function EmailToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

// ─── Default Export ─────────────────────────────────────────────────────────────

export default function SystemConfigPage() {
  return (
    <PageGuard allowed={["system_admin"]}>
      <SystemConfigInner />
    </PageGuard>
  );
}
