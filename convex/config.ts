import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

export const getConfig = query({
  args: { laboratoryId: v.id("laboratories"), key: v.string() },
  handler: async (ctx, args) => {
    const cfg = await ctx.db.query("systemConfig").withIndex("by_lab_key", (q) => q.eq("laboratoryId", args.laboratoryId).eq("key", args.key)).first();
    return cfg?.value ?? null;
  },
});

export const getAllConfig = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const configs = await ctx.db.query("systemConfig").withIndex("by_lab_key", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;
    return map;
  },
});

export const setConfig = mutation({
  args: { laboratoryId: v.id("laboratories"), key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db.query("systemConfig").withIndex("by_lab_key", (q) => q.eq("laboratoryId", args.laboratoryId).eq("key", args.key)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedBy: user._id, updatedAt: new Date().toISOString() });
    } else {
      await ctx.db.insert("systemConfig", { laboratoryId: args.laboratoryId, key: args.key, value: args.value, updatedBy: user._id, updatedAt: new Date().toISOString() });
    }
  },
});

export const setBulkConfig = mutation({
  args: { laboratoryId: v.id("laboratories"), configs: v.array(v.object({ key: v.string(), value: v.string() })) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const now = new Date().toISOString();
    for (const { key, value } of args.configs) {
      const existing = await ctx.db.query("systemConfig").withIndex("by_lab_key", (q) => q.eq("laboratoryId", args.laboratoryId).eq("key", key)).first();
      if (existing) {
        await ctx.db.patch(existing._id, { value, updatedBy: user._id, updatedAt: now });
      } else {
        await ctx.db.insert("systemConfig", { laboratoryId: args.laboratoryId, key, value, updatedBy: user._id, updatedAt: now });
      }
    }
  },
});
