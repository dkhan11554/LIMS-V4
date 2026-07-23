import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { getCurrentUserOrThrow } from "./users.ts";
import { requireBilling } from "./lib/roles.ts";

// ─── Sequence helpers ─────────────────────────────────────────────────

async function nextBillingSeq(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  labId: Id<"laboratories">,
  prefix: string,
  table: "quotations" | "invoices" | "complaints",
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await ctx.db
    .query(table)
    .withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId))
    .collect();
  const seq = String(existing.length + 1).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

// ═══════════════════════════════════════════════════════════════════
// Quotations
// ═══════════════════════════════════════════════════════════════════

export const listQuotations = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("quotations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const customer = await ctx.db.get(r.customerId);
      return { ...r, customerName: customer?.name };
    }));
  },
});

export const getQuotation = query({
  args: { id: v.id("quotations") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [customer, project] = await Promise.all([
      ctx.db.get(r.customerId),
      r.projectId ? ctx.db.get(r.projectId) : null,
    ]);
    const lineItems = await Promise.all(r.lineItems.map(async (li) => {
      const test = li.testId ? await ctx.db.get(li.testId) : null;
      return { ...li, testName: test?.name };
    }));
    return { ...r, customerName: customer?.name, projectName: project?.name, lineItems };
  },
});

export const createQuotation = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    validUntil: v.optional(v.string()),
    lineItems: v.array(v.object({
      description: v.string(),
      testId: v.optional(v.id("tests")),
      quantity: v.number(),
      unitPrice: v.number(),
    })),
    taxRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    termsConditions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireBilling(ctx);
    const quotationNumber = await nextBillingSeq(ctx, args.laboratoryId, "QUO", "quotations");
    const subtotal = args.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const taxAmount = args.taxRate ? subtotal * (args.taxRate / 100) : 0;
    const total = subtotal + taxAmount;
    return await ctx.db.insert("quotations", {
      ...args,
      quotationNumber,
      status: "draft",
      subtotal,
      taxAmount: taxAmount || undefined,
      total,
      createdBy: user._id,
    });
  },
});

export const updateQuotationStatus = mutation({
  args: {
    id: v.id("quotations"),
    status: v.union(
      v.literal("draft"), v.literal("sent"), v.literal("accepted"),
      v.literal("rejected"), v.literal("expired"),
    ),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// ═══════════════════════════════════════════════════════════════════
// Invoices
// ═══════════════════════════════════════════════════════════════════

export const listInvoices = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    const now = new Date();
    return await Promise.all(rows.map(async (r) => {
      const customer = await ctx.db.get(r.customerId);
      const isOverdue = r.status === "sent" && r.dueDate && new Date(r.dueDate) < now;
      const balance = r.total - (r.amountPaid ?? 0);
      return { ...r, customerName: customer?.name, isOverdue, balance };
    }));
  },
});

export const getInvoice = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [customer, project] = await Promise.all([
      ctx.db.get(r.customerId),
      r.projectId ? ctx.db.get(r.projectId) : null,
    ]);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .order("desc")
      .collect();
    const enrichedPayments = await Promise.all(payments.map(async (p) => {
      const recorder = await ctx.db.get(p.recordedBy);
      return { ...p, recorderName: recorder?.name };
    }));
    const lineItems = await Promise.all(r.lineItems.map(async (li) => {
      const test = li.testId ? await ctx.db.get(li.testId) : null;
      return { ...li, testName: test?.name };
    }));
    const balance = r.total - (r.amountPaid ?? 0);
    const isOverdue = r.status === "sent" && r.dueDate && new Date(r.dueDate) < new Date();
    return { ...r, customerName: customer?.name, projectName: project?.name, lineItems, payments: enrichedPayments, balance, isOverdue };
  },
});

export const createInvoice = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    quotationId: v.optional(v.id("quotations")),
    sampleIds: v.optional(v.array(v.id("samples"))),
    dueDate: v.optional(v.string()),
    lineItems: v.array(v.object({
      description: v.string(),
      testId: v.optional(v.id("tests")),
      sampleId: v.optional(v.id("samples")),
      quantity: v.number(),
      unitPrice: v.number(),
      amount: v.number(),
    })),
    taxRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const invoiceNumber = await nextBillingSeq(ctx, args.laboratoryId, "INV", "invoices");
    const subtotal = args.lineItems.reduce((sum, li) => sum + li.amount, 0);
    const taxAmount = args.taxRate ? subtotal * (args.taxRate / 100) : 0;
    const total = subtotal + taxAmount;
    return await ctx.db.insert("invoices", {
      ...args,
      invoiceNumber,
      status: "draft",
      issueDate: new Date().toISOString(),
      subtotal,
      taxAmount: taxAmount || undefined,
      total,
      amountPaid: 0,
      createdBy: user._id,
    });
  },
});

export const updateInvoiceStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.union(
      v.literal("draft"), v.literal("sent"), v.literal("partial"),
      v.literal("paid"), v.literal("overdue"), v.literal("cancelled"), v.literal("credited"),
    ),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    laboratoryId: v.id("laboratories"),
    amount: v.number(),
    paymentDate: v.string(),
    paymentMethod: v.union(
      v.literal("bank_transfer"), v.literal("credit_card"),
      v.literal("cheque"), v.literal("cash"), v.literal("other"),
    ),
    referenceNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError({ message: "Invoice not found", code: "NOT_FOUND" });

    await ctx.db.insert("payments", {
      ...args,
      currency: invoice.currency,
      recordedBy: user._id,
    });

    const newAmountPaid = (invoice.amountPaid ?? 0) + args.amount;
    const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";
    await ctx.db.patch(args.invoiceId, { amountPaid: newAmountPaid, status: newStatus });
  },
});

// ═══════════════════════════════════════════════════════════════════
// Complaints
// ═══════════════════════════════════════════════════════════════════

export const listComplaints = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("complaints")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const [customer, assignee] = await Promise.all([
        ctx.db.get(r.customerId),
        r.assignedTo ? ctx.db.get(r.assignedTo) : null,
      ]);
      return { ...r, customerName: customer?.name, assigneeName: assignee?.name };
    }));
  },
});

export const createComplaint = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    customerId: v.id("customers"),
    sampleId: v.optional(v.id("samples")),
    title: v.string(),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const complaintNumber = await nextBillingSeq(ctx, args.laboratoryId, "COMP", "complaints");
    return await ctx.db.insert("complaints", {
      ...args,
      complaintNumber,
      status: "open",
      submittedDate: new Date().toISOString(),
      submittedBy: user._id,
      createdBy: user._id,
    });
  },
});

export const updateComplaint = mutation({
  args: {
    id: v.id("complaints"),
    status: v.optional(v.union(v.literal("open"), v.literal("under_review"), v.literal("resolved"), v.literal("closed"))),
    assignedTo: v.optional(v.id("users")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === "resolved" || fields.status === "closed") {
      patch.resolvedDate = new Date().toISOString();
      patch.resolvedBy = user._id;
    }
    await ctx.db.patch(id, patch);
  },
});

// ═══════════════════════════════════════════════════════════════════
// Billing Summary
// ═══════════════════════════════════════════════════════════════════

export const getBillingSummary = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    openComplaints: number;
    draftQuotations: number;
  }> => {
    const [invoices, complaints, quotations] = await Promise.all([
      ctx.db.query("invoices").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
      ctx.db.query("complaints").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
      ctx.db.query("quotations").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
    ]);
    const now = new Date();
    const active = invoices.filter((i) => !["cancelled", "credited"].includes(i.status));
    return {
      totalInvoiced: active.reduce((s, i) => s + i.total, 0),
      totalPaid: active.reduce((s, i) => s + (i.amountPaid ?? 0), 0),
      totalOutstanding: active.reduce((s, i) => s + (i.total - (i.amountPaid ?? 0)), 0),
      overdueCount: active.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < now).length,
      openComplaints: complaints.filter((c) => c.status !== "closed").length,
      draftQuotations: quotations.filter((q) => q.status === "draft").length,
    };
  },
});

// Customer-facing queries (for portal)
export const getCustomerSamples = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(50);
    return samples;
  },
});

export const getCustomerInvoices = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect();
    return rows.map((r) => ({
      ...r,
      balance: r.total - (r.amountPaid ?? 0),
    }));
  },
});
