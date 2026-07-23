import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { getCurrentUserOrThrow, requireAdmin, requireManager } from "./users.ts";

// ─── Expense categories ────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  "reagents", "equipment", "staffing", "utilities",
  "maintenance", "overhead", "consumables", "other",
] as const;

// ─── Sequence helper ───────────────────────────────────────────────────────
async function nextExpenseSeq(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  labId: Id<"laboratories">,
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await ctx.db
    .query("expenses")
    .withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId))
    .collect();
  const num = String(existing.length + 1).padStart(5, "0");
  return `EXP-${year}-${num}`;
}

// ─── Expenses ──────────────────────────────────────────────────────────────

export const listExpenses = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("expenses")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
  },
});

export const createExpense = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    category: v.string(),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    vendor: v.optional(v.string()),
    invoiceRef: v.optional(v.string()),
    expenseDate: v.string(),
    costCentre: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const expenseNumber = await nextExpenseSeq(ctx, args.laboratoryId);
    return await ctx.db.insert("expenses", {
      ...args,
      expenseNumber,
      status: "pending",
      createdBy: user._id,
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateExpense = mutation({
  args: {
    id: v.id("expenses"),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    vendor: v.optional(v.string()),
    invoiceRef: v.optional(v.string()),
    expenseDate: v.optional(v.string()),
    status: v.optional(v.string()),
    costCentre: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const approveExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, { status: "approved", approvedBy: user._id });
  },
});

export const deleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ─── Budgets ───────────────────────────────────────────────────────────────

export const listBudgets = query({
  args: { laboratoryId: v.id("laboratories"), fiscalYear: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    if (args.fiscalYear !== undefined) {
      return budgets.filter((b) => b.fiscalYear === args.fiscalYear);
    }
    return budgets;
  },
});

export const upsertBudget = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    fiscalYear: v.number(),
    category: v.string(),
    allocatedAmount: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_laboratory_year", (q) =>
        q.eq("laboratoryId", args.laboratoryId).eq("fiscalYear", args.fiscalYear),
      )
      .collect();
    const match = existing.find((b) => b.category === args.category);
    if (match) {
      await ctx.db.patch(match._id, {
        allocatedAmount: args.allocatedAmount,
        currency: args.currency,
        notes: args.notes,
      });
      return match._id;
    }
    return await ctx.db.insert("budgets", {
      ...args,
      createdBy: user._id,
      createdAt: new Date().toISOString(),
    });
  },
});

// ─── Revenue summary (from invoices) ──────────────────────────────────────

export const getRevenueSummary = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    invoiceCount: number;
    expenseCount: number;
    monthlyRevenue: { month: string; revenue: number; expenses: number }[];
    expenseByCategory: { category: string; amount: number }[];
    arAging: { bucket: string; amount: number }[];
  }> => {
    const [invoices, expenses] = await Promise.all([
      ctx.db
        .query("invoices")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
        .collect(),
      ctx.db
        .query("expenses")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
        .collect(),
    ]);

    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);

    const approvedExpenses = expenses.filter((e) => e.status === "approved" || e.status === "paid");
    const totalExpenses = approvedExpenses.reduce((s, e) => s + e.amount, 0);

    // Monthly revenue & expenses for last 12 months
    const now = new Date();
    const monthlyRevenue: { month: string; revenue: number; expenses: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rev = paidInvoices
        .filter((inv) => (inv.issueDate ?? "").startsWith(monthStr))
        .reduce((s, inv) => s + inv.total, 0);
      const exp = approvedExpenses
        .filter((e) => e.expenseDate.startsWith(monthStr))
        .reduce((s, e) => s + e.amount, 0);
      monthlyRevenue.push({ month: label, revenue: rev, expenses: exp });
    }

    // Expense breakdown by category
    const catMap: Record<string, number> = {};
    for (const e of approvedExpenses) {
      catMap[e.category] = (catMap[e.category] ?? 0) + e.amount;
    }
    const expenseByCategory = Object.entries(catMap).map(([category, amount]) => ({ category, amount }));

    // AR aging — outstanding invoices
    const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
    const arAging = [
      { bucket: "Current", amount: 0 },
      { bucket: "1-30 days", amount: 0 },
      { bucket: "31-60 days", amount: 0 },
      { bucket: "61-90 days", amount: 0 },
      { bucket: ">90 days", amount: 0 },
    ];
    for (const inv of outstanding) {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date();
      const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
      const amount = inv.total - (inv.amountPaid ?? 0);
      if (daysPast <= 0) arAging[0]!.amount += amount;
      else if (daysPast <= 30) arAging[1]!.amount += amount;
      else if (daysPast <= 60) arAging[2]!.amount += amount;
      else if (daysPast <= 90) arAging[3]!.amount += amount;
      else arAging[4]!.amount += amount;
    }

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      invoiceCount: invoices.length,
      expenseCount: expenses.length,
      monthlyRevenue,
      expenseByCategory,
      arAging,
    };
  },
});
