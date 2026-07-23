import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

export const listSuppliers = query({
  args: { laboratoryId: v.id("laboratories"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let suppliers = await ctx.db.query("suppliers").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    if (args.status) suppliers = suppliers.filter((s) => s.qualificationStatus === args.status);
    return suppliers;
  },
});

export const getSupplier = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.supplierId);
  },
});

export const createSupplier = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    category: v.union(v.literal("chemical"), v.literal("equipment"), v.literal("consumable"), v.literal("reference_material"), v.literal("service"), v.literal("other")),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    qualificationNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db.query("suppliers").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const supplierCode = `SUP-${String(existing.length + 1).padStart(4, "0")}`;
    return await ctx.db.insert("suppliers", { ...args, supplierCode, qualificationStatus: "pending", isActive: true, createdBy: user._id });
  },
});

export const updateSupplier = mutation({
  args: {
    supplierId: v.id("suppliers"),
    name: v.optional(v.string()),
    category: v.optional(v.union(v.literal("chemical"), v.literal("equipment"), v.literal("consumable"), v.literal("reference_material"), v.literal("service"), v.literal("other"))),
    qualificationStatus: v.optional(v.union(v.literal("pending"), v.literal("qualified"), v.literal("conditional"), v.literal("disqualified"), v.literal("under_review"))),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    qualificationDate: v.optional(v.string()),
    requalificationDate: v.optional(v.string()),
    qualificationNotes: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
    performanceScore: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { supplierId, ...fields } = args;
    const s = await ctx.db.get(supplierId);
    if (!s) throw new ConvexError({ message: "Supplier not found", code: "NOT_FOUND" });
    await ctx.db.patch(supplierId, fields);
  },
});

export const deleteSupplier = mutation({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.supplierId, { isActive: false });
  },
});
