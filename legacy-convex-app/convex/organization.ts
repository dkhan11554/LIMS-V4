import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";

// ─── Companies ────────────────────────────────────────────

export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").collect();
  },
});

export const createCompany = mutation({
  args: {
    name: v.string(),
    legalName: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("companies", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateCompany = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    legalName: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ─── Laboratories ─────────────────────────────────────────

export const listLaboratories = query({
  args: { companyId: v.optional(v.id("companies")) },
  handler: async (ctx, args) => {
    if (args.companyId) {
      return await ctx.db
        .query("laboratories")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId!))
        .collect();
    }
    return await ctx.db.query("laboratories").collect();
  },
});

export const createLaboratory = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    companyId: v.id("companies"),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accreditationNumber: v.optional(v.string()),
    accreditationExpiry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("laboratories", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateLaboratory = mutation({
  args: {
    id: v.id("laboratories"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accreditationNumber: v.optional(v.string()),
    accreditationExpiry: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ─── Departments ──────────────────────────────────────────

export const listDepartments = query({
  args: { laboratoryId: v.optional(v.id("laboratories")) },
  handler: async (ctx, args) => {
    if (args.laboratoryId) {
      return await ctx.db
        .query("departments")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId!))
        .collect();
    }
    return await ctx.db.query("departments").collect();
  },
});

export const createDepartment = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    laboratoryId: v.id("laboratories"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("departments", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateDepartment = mutation({
  args: {
    id: v.id("departments"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
