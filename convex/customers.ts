import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";

// ─── Customers ────────────────────────────────────────────

export const listCustomers = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
  },
});

export const getCustomer = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) return null;
    const contacts = await ctx.db
      .query("customerContacts")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .collect();
    const projects = await ctx.db
      .query("customerProjects")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .collect();
    // Count samples for this customer
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .collect();
    return { ...customer, contacts, projects, sampleCount: samples.length };
  },
});

export const createCustomer = mutation({
  args: {
    name: v.string(),
    legalName: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    collectionAddress: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    contractStart: v.optional(v.string()),
    contractExpiry: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const customerCode = `CUST-${String(existing.length + 1).padStart(4, "0")}`;
    return await ctx.db.insert("customers", {
      ...args,
      customerCode,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateCustomer = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    legalName: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    collectionAddress: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    contractStart: v.optional(v.string()),
    contractExpiry: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ─── Contacts ─────────────────────────────────────────────

export const listContacts = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerContacts")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
  },
});

export const createContact = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.string(),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    // If marking as primary, unset all others
    if (args.isPrimary) {
      const existing = await ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
        .collect();
      for (const c of existing) {
        if (c.isPrimary) await ctx.db.patch(c._id, { isPrimary: false });
      }
    }
    return await ctx.db.insert("customerContacts", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateContact = mutation({
  args: {
    id: v.id("customerContacts"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteContact = mutation({
  args: { id: v.id("customerContacts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

// ─── Projects ─────────────────────────────────────────────

export const listProjects = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerProjects")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
  },
});

export const createProject = mutation({
  args: {
    customerId: v.id("customers"),
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db
      .query("customerProjects")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
    const projectCode = `PROJ-${String(existing.length + 1).padStart(3, "0")}`;
    return await ctx.db.insert("customerProjects", {
      ...args,
      projectCode,
      status: "active",
      createdBy: me._id,
    });
  },
});

export const updateProject = mutation({
  args: {
    id: v.id("customerProjects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("on_hold"),
      v.literal("cancelled"),
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
