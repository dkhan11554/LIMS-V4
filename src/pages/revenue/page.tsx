import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Plus, RefreshCw,
  PieChart, Clock, CheckCircle2, Receipt, Package, Zap, Wrench,
  Users, Settings, HelpCircle, Pencil, Trash2, Check
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { Id } from "@/convex/_generated/dataModel.js";

// ─── Types ────────────────────────────────────────────────────────────────

type Expense = {
  _id: Id<"expenses">;
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  vendor?: string;
  invoiceRef?: string;
  expenseDate: string;
  status: string;
  costCentre?: string;
  notes?: string;
};

type ExpenseFormState = {
  category: string;
  description: string;
  amount: string;
  currency: string;
  vendor: string;
  invoiceRef: string;
  expenseDate: string;
  costCentre: string;
  notes: string;
};

const EMPTY_FORM: ExpenseFormState = {
  category: "reagents",
  description: "",
  amount: "",
  currency: "USD",
  vendor: "",
  invoiceRef: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  costCentre: "",
  notes: "",
};

const EXPENSE_CATEGORIES = [
  { value: "reagents",      label: "Reagents & Chemicals",   icon: <Package size={14} /> },
  { value: "equipment",     label: "Equipment",               icon: <Settings size={14} /> },
  { value: "staffing",      label: "Staffing & HR",           icon: <Users size={14} /> },
  { value: "utilities",     label: "Utilities",               icon: <Zap size={14} /> },
  { value: "maintenance",   label: "Maintenance",             icon: <Wrench size={14} /> },
  { value: "consumables",   label: "Consumables",             icon: <Package size={14} /> },
  { value: "overhead",      label: "Overhead",                icon: <Settings size={14} /> },
  { value: "other",         label: "Other",                   icon: <HelpCircle size={14} /> },
];

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const CHART_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager"]}>
      <Authenticated>
        <RevenuePageInner />
      </Authenticated>
    </PageGuard>
  );
}

function RevenuePageInner() {
  const { lab } = useActiveLab();
  const summary = useQuery(api.revenue.getRevenueSummary, lab ? { laboratoryId: lab._id } : "skip");
  const expenses = useQuery(api.revenue.listExpenses, lab ? { laboratoryId: lab._id } : "skip");
  const createExpense = useMutation(api.revenue.createExpense);
  const updateExpense = useMutation(api.revenue.updateExpense);
  const approveExpense = useMutation(api.revenue.approveExpense);
  const deleteExpense = useMutation(api.revenue.deleteExpense);

  const [tab, setTab] = useState<"overview" | "expenses" | "budgets">("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expFilter, setExpFilter] = useState("all");
  const [expSearch, setExpSearch] = useState("");

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!lab) return;
    if (!form.description || !form.amount) return toast.error("Description and amount required");
    setSaving(true);
    try {
      await createExpense({
        laboratoryId: lab._id,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        vendor: form.vendor || undefined,
        invoiceRef: form.invoiceRef || undefined,
        expenseDate: form.expenseDate,
        costCentre: form.costCentre || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Expense recorded");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      toast.error("Failed to create expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!editExpense) return;
    setSaving(true);
    try {
      await updateExpense({
        id: editExpense._id,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        vendor: form.vendor || undefined,
        invoiceRef: form.invoiceRef || undefined,
        expenseDate: form.expenseDate,
        costCentre: form.costCentre || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Expense updated");
      setEditExpense(null);
    } catch {
      toast.error("Failed to update expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: Id<"expenses">) {
    try {
      await approveExpense({ id });
      toast.success("Expense approved");
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function handleDelete(id: Id<"expenses">) {
    try {
      await deleteExpense({ id });
      toast.success("Expense deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  function openEdit(exp: Expense) {
    setForm({
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      currency: exp.currency,
      vendor: exp.vendor ?? "",
      invoiceRef: exp.invoiceRef ?? "",
      expenseDate: exp.expenseDate.slice(0, 10),
      costCentre: exp.costCentre ?? "",
      notes: exp.notes ?? "",
    });
    setEditExpense(exp);
  }

  const filteredExpenses = (expenses ?? []).filter((e) => {
    const matchCat = expFilter === "all" || e.category === expFilter;
    const q = expSearch.toLowerCase();
    const matchSearch = !q || e.description.toLowerCase().includes(q) || (e.vendor ?? "").toLowerCase().includes(q) || e.expenseNumber.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={22} className="text-primary" /> Revenue & Finance
          </h1>
          <p className="text-sm text-muted-foreground">Financial management, expenses, budgets & P&amp;L</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Record Expense
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["overview", "expenses", "budgets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer -mb-px border-b-2",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Revenue",  value: fmt(summary?.totalRevenue ?? 0),  icon: <TrendingUp size={18} />,  color: "text-green-500",  bg: "bg-green-50 dark:bg-green-900/20" },
              { label: "Total Expenses", value: fmt(summary?.totalExpenses ?? 0), icon: <TrendingDown size={18} />, color: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/20" },
              { label: "Net Profit",     value: fmt(summary?.netProfit ?? 0),     icon: <DollarSign size={18} />,  color: (summary?.netProfit ?? 0) >= 0 ? "text-green-500" : "text-red-500", bg: "bg-primary/5" },
              { label: "Invoices",       value: String(summary?.invoiceCount ?? 0), icon: <Receipt size={18} />,   color: "text-primary",    bg: "bg-primary/10" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                      <span className={kpi.color}>{kpi.icon}</span>
                    </div>
                  </div>
                  {summary === undefined ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className={cn("text-xl font-bold", kpi.color)}>{kpi.value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue vs Expenses chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Expenses — Last 12 Months</CardTitle>
            </CardHeader>
            <CardContent>
              {summary === undefined ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={summary.monthlyRevenue} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: unknown) => `$${Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v: unknown, n: unknown) => [fmt(Number(v)), String(n)]} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Expense by category + AR Aging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {summary === undefined ? (
                  <Skeleton className="h-52 w-full" />
                ) : summary.expenseByCategory.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No expense data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RePieChart>
                      <Pie data={summary.expenseByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {summary.expenseByCategory.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock size={16} className="text-primary" /> Accounts Receivable Aging
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary === undefined ? (
                  <Skeleton className="h-52 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.arAging} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: unknown) => `$${Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(0)}k` : v}`} />
                      <Tooltip formatter={(v: unknown, n: unknown) => [fmt(Number(v)), String(n)]} />
                      <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]}>
                        {summary.arAging.map((entry, idx) => (
                          <Cell key={idx} fill={idx === 0 ? "#22c55e" : idx === 1 ? "#f59e0b" : idx === 2 ? "#f97316" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── EXPENSES TAB ─────────────────────────────────────────────── */}
      {tab === "expenses" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search expenses…"
              value={expSearch}
              onChange={(e) => setExpSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={expFilter} onValueChange={setExpFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {expenses === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredExpenses.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                <EmptyTitle>No expenses found</EmptyTitle>
                <EmptyDescription>Record your first expense to start tracking financials</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>Record Expense</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ref #</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{exp.expenseNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">{exp.description}</p>
                        {exp.vendor && <p className="text-xs text-muted-foreground">{exp.vendor}</p>}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground hidden md:table-cell">{exp.category}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(exp.amount, exp.currency)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(exp.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[exp.status] ?? "")}>
                          {exp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {exp.status === "pending" && (
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" title="Approve"
                              onClick={() => handleApprove(exp._id)}
                            >
                              <Check size={13} />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(exp)}>
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete" onClick={() => handleDelete(exp._id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BUDGETS TAB ──────────────────────────────────────────────── */}
      {tab === "budgets" && (
        <BudgetsTab lab={lab} expenses={expenses ?? []} summary={summary} />
      )}

      {/* ── CREATE DIALOG ───────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateExpense} className="space-y-3">
            <ExpenseForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record Expense"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={!!editExpense} onOpenChange={(o) => !o && setEditExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateExpense} className="space-y-3">
            <ExpenseForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditExpense(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Expense form shared fields ───────────────────────────────────────────

function ExpenseForm({ form, setForm }: { form: ExpenseFormState; setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>> }) {
  const f = (field: keyof ExpenseFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Description *</Label>
          <Input value={form.description} onChange={f("description")} placeholder="Reagents order for March" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Amount *</Label>
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={f("amount")} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["USD","EUR","GBP","AUD","CAD","JPY","CHF","ZAR","AED","SGD"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={form.expenseDate} onChange={f("expenseDate")} />
        </div>
        <div className="space-y-1.5">
          <Label>Vendor</Label>
          <Input value={form.vendor} onChange={f("vendor")} placeholder="Sigma-Aldrich" />
        </div>
        <div className="space-y-1.5">
          <Label>Invoice Ref</Label>
          <Input value={form.invoiceRef} onChange={f("invoiceRef")} placeholder="INV-12345" />
        </div>
        <div className="space-y-1.5">
          <Label>Cost Centre</Label>
          <Input value={form.costCentre} onChange={f("costCentre")} placeholder="CC-LAB-01" />
        </div>
      </div>
    </>
  );
}

// ─── Budgets tab ──────────────────────────────────────────────────────────

type BudgetRow = { category: string; allocated: number; spent: number; variance: number; pct: number };

function BudgetsTab({ lab, expenses, summary }: {
  lab: { _id: Id<"laboratories"> } | null | undefined;
  expenses: Expense[];
  summary: { expenseByCategory: { category: string; amount: number }[] } | null | undefined;
}) {
  const upsertBudget = useMutation(api.revenue.upsertBudget);
  const year = new Date().getFullYear();
  const budgets = useQuery(api.revenue.listBudgets, lab ? { laboratoryId: lab._id, fiscalYear: year } : "skip");

  const [editCat, setEditCat] = useState<string | null>(null);
  const [budgetAmt, setBudgetAmt] = useState("");

  const rows: BudgetRow[] = EXPENSE_CATEGORIES.map((cat) => {
    const budRow = budgets?.find((b) => b.category === cat.value);
    const allocated = budRow?.allocatedAmount ?? 0;
    const spent = (summary?.expenseByCategory.find((e) => e.category === cat.value)?.amount ?? 0);
    return {
      category: cat.value,
      allocated,
      spent,
      variance: allocated - spent,
      pct: allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0,
    };
  });

  async function saveBudget() {
    if (!lab || !editCat) return;
    const amount = parseFloat(budgetAmt);
    if (isNaN(amount)) return toast.error("Enter a valid amount");
    try {
      await upsertBudget({ laboratoryId: lab._id, fiscalYear: year, category: editCat, allocatedAmount: amount, currency: "USD" });
      toast.success("Budget saved");
      setEditCat(null);
    } catch {
      toast.error("Failed to save budget");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">FY{year} Budget vs Actual</h2>
        <p className="text-sm text-muted-foreground">Click any row to set budget allocation</p>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Category</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Budget</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actual</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Variance</th>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell w-40">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.category}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => { setEditCat(row.category); setBudgetAmt(String(row.allocated || "")); }}
              >
                <td className="px-4 py-3 capitalize font-medium">{row.category}</td>
                <td className="px-4 py-3 text-right">
                  {editCat === row.category ? (
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number" min="0" step="100"
                        className="w-28 h-7 text-xs text-right"
                        value={budgetAmt}
                        onChange={(e) => setBudgetAmt(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => void saveBudget()}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditCat(null)}>✕</Button>
                    </div>
                  ) : (
                    row.allocated > 0 ? fmt(row.allocated) : <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">{fmt(row.spent)}</td>
                <td className={cn("px-4 py-3 text-right hidden md:table-cell font-medium", row.variance < 0 ? "text-red-500" : "text-green-600")}>
                  {row.allocated > 0 ? (row.variance < 0 ? "-" : "+") + fmt(Math.abs(row.variance)) : "—"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {row.allocated > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", row.pct > 90 ? "bg-red-500" : row.pct > 70 ? "bg-amber-500" : "bg-green-500")}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-9 text-right">{row.pct.toFixed(0)}%</span>
                    </div>
                  ) : <span className="text-muted-foreground text-xs">No budget set</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
