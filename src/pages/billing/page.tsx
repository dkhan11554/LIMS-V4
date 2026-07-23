import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";
import { generateInvoicePdf, formatMoney, CURRENCIES } from "@/lib/generate-invoice.ts";
import type { InvoicePdfData } from "@/lib/generate-invoice.ts";
import {
  Receipt, Plus, DollarSign, AlertTriangle, CheckCircle2,
  FileText, Edit2, CreditCard, MessageSquare, Trash2, Download
} from "lucide-react";

// ─── Status configs ───────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  sent:      { label: "Sent",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  partial:   { label: "Partial",   color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  paid:      { label: "Paid",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  overdue:   { label: "Overdue",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
  credited:  { label: "Credited",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const QUO_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  sent:     { label: "Sent",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  expired:  { label: "Expired",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const COMP_STATUS: Record<string, { label: string; color: string }> = {
  open:          { label: "Open",          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  under_review:  { label: "Under Review",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  resolved:      { label: "Resolved",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  closed:        { label: "Closed",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function StatusPill({ cfg }: { cfg: { label: string; color: string } }) {
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>{cfg.label}</span>;
}

function fmt(n: number, currency = "USD") {
  return formatMoney(n, currency);
}

// ─── Currency selector ────────────────────────────────────────────────────────

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Currency" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Line item editor ─────────────────────────────────────────────────────────

type LineItem = { description: string; quantity: number; unitPrice: number };

function LineItemEditor({ items, onChange, currency }: { items: LineItem[]; onChange: (items: LineItem[]) => void; currency: string }) {
  const addRow = () => onChange([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeRow = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, k: keyof LineItem, v: string | number) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [k]: v } : item);
    onChange(updated);
  };
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 text-xs text-muted-foreground px-1">
        <span>Description</span><span>Qty</span><span>Unit Price</span><span />
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2">
          <Input value={item.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="Service / test" className="text-sm h-8" />
          <Input type="number" min={1} value={item.quantity} onChange={(e) => update(i, "quantity", Number(e.target.value))} className="text-sm h-8" />
          <Input type="number" min={0} step={0.01} value={item.unitPrice} onChange={(e) => update(i, "unitPrice", Number(e.target.value))} className="text-sm h-8" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeRow(i)}><Trash2 size={13} /></Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={addRow} className="mt-1"><Plus size={13} className="mr-1" />Add Line</Button>
      <div className="text-right text-sm font-medium pt-1">
        Subtotal: {fmt(subtotal, currency)}
      </div>
    </div>
  );
}

// ─── Create Invoice dialog ────────────────────────────────────────────────────

function CreateInvoiceDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const customers = useQuery(api.customers.listCustomers, { laboratoryId: labId as never });
  const createInv = useMutation(api.billing.createInvoice);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (lineItems.some((l) => !l.description.trim())) { toast.error("All line items need a description"); return; }
    setSaving(true);
    try {
      await createInv({
        laboratoryId: labId as never,
        customerId: customerId as never,
        dueDate: dueDate || undefined,
        taxRate: Number(taxRate) || undefined,
        currency,
        paymentTerms: paymentTerms || undefined,
        notes: notes || undefined,
        lineItems: lineItems.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.quantity * l.unitPrice,
        })),
      });
      toast.success("Invoice created");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to create invoice");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Payment Terms</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Line Items</Label>
            <LineItemEditor items={lineItems} onChange={setLineItems} currency={currency} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create Invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Quotation dialog ──────────────────────────────────────────────────

function CreateQuotationDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const customers = useQuery(api.customers.listCustomers, { laboratoryId: labId as never });
  const createQuo = useMutation(api.billing.createQuotation);
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    setSaving(true);
    try {
      await createQuo({
        laboratoryId: labId as never,
        customerId: customerId as never,
        validUntil: validUntil || undefined,
        taxRate: Number(taxRate) || undefined,
        currency,
        notes: notes || undefined,
        termsConditions: termsConditions || undefined,
        lineItems: lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      toast.success("Quotation created");
      onClose();
    } catch { toast.error("Failed to create quotation"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Quotation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valid Until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Line Items</Label>
            <LineItemEditor items={lineItems} onChange={setLineItems} currency={currency} />
          </div>
          <div className="space-y-1">
            <Label>Terms {"&"} Conditions</Label>
            <Textarea rows={2} value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create Quotation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record payment dialog ────────────────────────────────────────────────────

function RecordPaymentDialog({ invoiceId, labId, outstanding, currency, open, onClose }: {
  invoiceId: string; labId: string; outstanding: number; currency: string; open: boolean; onClose: () => void;
}) {
  const record = useMutation(api.billing.recordPayment);
  const [amount, setAmount] = useState(String(outstanding.toFixed(2)));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await record({
        invoiceId: invoiceId as never,
        laboratoryId: labId as never,
        amount: Number(amount),
        paymentDate,
        paymentMethod: paymentMethod as never,
        referenceNumber: ref || undefined,
      });
      toast.success("Payment recorded");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to record payment");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted px-4 py-2 text-sm">Outstanding: <strong>{fmt(outstanding, currency)}</strong></div>
          <div className="space-y-1"><Label>Amount *</Label><Input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label>Payment Date *</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Reference Number</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Payment ref / cheque number" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Complaint dialog ──────────────────────────────────────────────────

function CreateComplaintDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const customers = useQuery(api.customers.listCustomers, { laboratoryId: labId as never });
  const create = useMutation(api.billing.createComplaint);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("low");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!customerId || !title.trim() || !description.trim()) { toast.error("All fields are required"); return; }
    setSaving(true);
    try {
      await create({ laboratoryId: labId as never, customerId: customerId as never, title, description, severity: severity as "low" | "medium" | "high" });
      toast.success("Complaint recorded");
      onClose();
    } catch { toast.error("Failed to record complaint"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record Customer Complaint</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description *</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice PDF download helper ──────────────────────────────────────────────

type InvRow = {
  _id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency?: string;
  customerName?: string;
  total: number;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  amountPaid?: number;
  balance: number;
  paymentTerms?: string;
  notes?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
};

function DownloadInvoicePdfButton({ inv, labName }: { inv: InvRow; labName: string }) {
  const handleDownload = () => {
    const data: InvoicePdfData = {
      labName,
      invoiceNumber: inv.invoiceNumber,
      issueDate: format(parseISO(inv.issueDate), "dd MMM yyyy"),
      dueDate: inv.dueDate ? format(parseISO(inv.dueDate), "dd MMM yyyy") : undefined,
      currency: inv.currency ?? "USD",
      customerName: inv.customerName ?? "—",
      paymentTerms: inv.paymentTerms,
      notes: inv.notes,
      lineItems: inv.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
      })),
      subtotal: inv.subtotal,
      taxRate: inv.taxRate,
      taxAmount: inv.taxAmount,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: inv.balance,
    };
    generateInvoicePdf(data);
    toast.success(`${inv.invoiceNumber}.pdf downloaded`);
  };

  return (
    <Button size="sm" variant="secondary" onClick={handleDownload} title="Download PDF">
      <Download size={13} className="mr-1" />PDF
    </Button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabId = "invoices" | "quotations" | "complaints";

function BillingInner() {
  const { labId } = useActiveLab();
  const lab = useQuery(api.organization.listLaboratories, {});
  const labName = lab?.find((l) => l._id === labId)?.name ?? "Laboratory";

  const [activeTab, setActiveTab] = useState<TabId>("invoices");
  const [createInvOpen, setCreateInvOpen] = useState(false);
  const [createQuoOpen, setCreateQuoOpen] = useState(false);
  const [createCompOpen, setCreateCompOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<{ id: string; balance: number; currency: string } | null>(null);

  const summary = useQuery(api.billing.getBillingSummary, labId ? { laboratoryId: labId as never } : "skip");
  const invoices = useQuery(api.billing.listInvoices, labId ? { laboratoryId: labId as never } : "skip");
  const quotations = useQuery(api.billing.listQuotations, labId ? { laboratoryId: labId as never } : "skip");
  const complaints = useQuery(api.billing.listComplaints, labId ? { laboratoryId: labId as never } : "skip");
  const updateInvStatus = useMutation(api.billing.updateInvoiceStatus);
  const updateQuoStatus = useMutation(api.billing.updateQuotationStatus);
  const updateComplaint = useMutation(api.billing.updateComplaint);

  if (!labId) return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;

  // Determine display currency for KPI cards (use most common currency)
  const kpiCurrency = "USD";

  const kpis = [
    { label: "Total Invoiced",   value: summary ? fmt(summary.totalInvoiced, kpiCurrency)   : "—", icon: <Receipt size={18} />,      color: "text-primary" },
    { label: "Total Paid",       value: summary ? fmt(summary.totalPaid, kpiCurrency)        : "—", icon: <CheckCircle2 size={18} />, color: "text-green-600" },
    { label: "Outstanding",      value: summary ? fmt(summary.totalOutstanding, kpiCurrency) : "—", icon: <DollarSign size={18} />,   color: "text-orange-500" },
    { label: "Overdue",          value: summary?.overdueCount ?? 0,                                  icon: <AlertTriangle size={18} />, color: "text-destructive" },
    { label: "Open Complaints",  value: summary?.openComplaints ?? 0,                                icon: <MessageSquare size={18} />, color: "text-red-500" },
  ];

  const TABS = [
    { id: "invoices" as TabId,    label: `Invoices (${invoices?.length ?? 0})`,     icon: <Receipt size={14} /> },
    { id: "quotations" as TabId,  label: `Quotations (${quotations?.length ?? 0})`, icon: <FileText size={14} /> },
    { id: "complaints" as TabId,  label: `Complaints (${complaints?.length ?? 0})`, icon: <MessageSquare size={14} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt size={22} className="text-primary" /> Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quotations, invoices, payments and complaints</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "invoices"   && <Button size="sm" onClick={() => setCreateInvOpen(true)}><Plus size={14} className="mr-1" />Invoice</Button>}
          {activeTab === "quotations" && <Button size="sm" onClick={() => setCreateQuoOpen(true)}><Plus size={14} className="mr-1" />Quotation</Button>}
          {activeTab === "complaints" && <Button size="sm" onClick={() => setCreateCompOpen(true)}><Plus size={14} className="mr-1" />Complaint</Button>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{summary === undefined ? <Skeleton className="h-7 w-16" /> : s.value}</p>
              </div>
              <span className={s.color}>{s.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* ── Invoices ── */}
      {activeTab === "invoices" && (
        invoices === undefined
          ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : invoices.length === 0
          ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt size={36} className="mx-auto mb-3 opacity-30" /><p>No invoices yet.</p>
              <Button className="mt-3" size="sm" onClick={() => setCreateInvOpen(true)}>Create First Invoice</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => {
                const cfg = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                const overdue = inv.isOverdue;
                const cur = inv.currency ?? "USD";
                return (
                  <Card key={inv._id} className={cn("border", overdue ? "border-destructive/40" : "")}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                          <StatusPill cfg={cfg} />
                          {/* Currency badge */}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-medium text-muted-foreground">{cur}</span>
                          {overdue && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle size={11} />Overdue</span>}
                        </div>
                        <p className="text-sm font-semibold mt-0.5">{inv.customerName}</p>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                          <span>Issued: {format(parseISO(inv.issueDate), "dd MMM yyyy")}</span>
                          {inv.dueDate && <span>Due: {format(parseISO(inv.dueDate), "dd MMM yyyy")}</span>}
                          <span className="font-medium">Total: {fmt(inv.total, cur)}</span>
                          {inv.balance > 0 && <span className="text-orange-600">Balance: {fmt(inv.balance, cur)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        {/* PDF download always visible */}
                        <DownloadInvoicePdfButton inv={inv as InvRow} labName={labName} />
                        {["draft", "sent", "partial"].includes(inv.status) && inv.balance > 0 && (
                          <Button size="sm" variant="secondary" onClick={() => setPaymentInvoice({ id: inv._id, balance: inv.balance, currency: cur })}>
                            <CreditCard size={13} className="mr-1" />Pay
                          </Button>
                        )}
                        {inv.status === "draft" && (
                          <Button size="sm" onClick={() => updateInvStatus({ id: inv._id as never, status: "sent" }).then(() => toast.success("Marked as sent"))}>
                            Send
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
      )}

      {/* ── Quotations ── */}
      {activeTab === "quotations" && (
        quotations === undefined
          ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : quotations.length === 0
          ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={36} className="mx-auto mb-3 opacity-30" /><p>No quotations yet.</p>
              <Button className="mt-3" size="sm" onClick={() => setCreateQuoOpen(true)}>Create First Quotation</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {quotations.map((q) => {
                const cfg = QUO_STATUS[q.status] ?? QUO_STATUS.draft;
                const cur = q.currency ?? "USD";
                return (
                  <Card key={q._id} className="border">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{q.quotationNumber}</span>
                          <StatusPill cfg={cfg} />
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-medium text-muted-foreground">{cur}</span>
                        </div>
                        <p className="text-sm font-semibold mt-0.5">{q.customerName}</p>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                          <span className="font-medium">Total: {fmt(q.total, cur)}</span>
                          {q.validUntil && <span>Valid until: {format(parseISO(q.validUntil), "dd MMM yyyy")}</span>}
                        </div>
                      </div>
                      {q.status === "draft" && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="secondary" onClick={() => updateQuoStatus({ id: q._id as never, status: "sent" }).then(() => toast.success("Marked as sent"))}>Send</Button>
                          <Button size="sm" onClick={() => updateQuoStatus({ id: q._id as never, status: "accepted" }).then(() => toast.success("Accepted"))}>Accept</Button>
                        </div>
                      )}
                      {q.status === "sent" && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => updateQuoStatus({ id: q._id as never, status: "accepted" }).then(() => toast.success("Accepted"))}>Accept</Button>
                          <Button size="sm" variant="secondary" onClick={() => updateQuoStatus({ id: q._id as never, status: "rejected" }).then(() => toast.success("Rejected"))}>Reject</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
      )}

      {/* ── Complaints ── */}
      {activeTab === "complaints" && (
        complaints === undefined
          ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : complaints.length === 0
          ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare size={36} className="mx-auto mb-3 opacity-30" /><p>No complaints recorded.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => {
                const cfg = COMP_STATUS[c.status] ?? COMP_STATUS.open;
                return (
                  <Card key={c._id} className="border">
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{c.complaintNumber}</span>
                          <StatusPill cfg={cfg} />
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium capitalize",
                            c.severity === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            c.severity === "medium" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>{c.severity}</span>
                        </div>
                        <p className="text-sm font-semibold mt-0.5">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.customerName} · {format(parseISO(c.submittedDate), "dd MMM yyyy")}</p>
                      </div>
                      {c.status === "open" && (
                        <Button size="sm" variant="secondary" onClick={() => updateComplaint({ id: c._id as never, status: "under_review" }).then(() => toast.success("Marked under review"))}>
                          <Edit2 size={13} className="mr-1" />Review
                        </Button>
                      )}
                      {c.status === "under_review" && (
                        <Button size="sm" onClick={() => updateComplaint({ id: c._id as never, status: "resolved" }).then(() => toast.success("Resolved"))}>Resolve</Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
      )}

      {/* Dialogs */}
      <CreateInvoiceDialog labId={labId} open={createInvOpen} onClose={() => setCreateInvOpen(false)} />
      <CreateQuotationDialog labId={labId} open={createQuoOpen} onClose={() => setCreateQuoOpen(false)} />
      <CreateComplaintDialog labId={labId} open={createCompOpen} onClose={() => setCreateCompOpen(false)} />
      {paymentInvoice && (
        <RecordPaymentDialog
          invoiceId={paymentInvoice.id}
          labId={labId}
          outstanding={paymentInvoice.balance}
          currency={paymentInvoice.currency}
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
        />
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Authenticated>
      <PageGuard allowed={["system_admin", "lab_manager", "reception"]}>
        <BillingInner />
      </PageGuard>
    </Authenticated>
  );
}
