/**
 * Error Logs — admin diagnostics backend
 * Records client-side errors with full context.
 * End users only see friendly messages; admins see full log.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import type { Id } from "./_generated/dataModel";

export const logError = mutation({
  args: {
    errorId: v.string(),
    timestamp: v.string(),
    laboratoryId: v.optional(v.id("laboratories")),
    module: v.string(),
    screen: v.string(),
    action: v.string(),
    fieldId: v.optional(v.string()),
    category: v.string(),
    title: v.string(),
    detail: v.string(),
    rawMessage: v.string(),
    userAgent: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Best-effort: don't block the UI if auth is unavailable
    let userId: Id<"users"> | undefined;
    let userName: string | undefined;
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
          .unique();
        userId = user?._id;
        userName = user?.name;
      }
    } catch { /* silent */ }

    await ctx.db.insert("errorLogs", {
      ...args,
      userId,
      userName,
    });
  },
});

export const listErrorLogs = query({
  args: {
    laboratoryId: v.optional(v.id("laboratories")),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);

    let rows;
    if (args.laboratoryId) {
      rows = await ctx.db
        .query("errorLogs")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
        .order("desc")
        .take(args.limit ?? 200);
    } else {
      rows = await ctx.db
        .query("errorLogs")
        .order("desc")
        .take(args.limit ?? 200);
    }

    if (args.category && args.category !== "all") {
      rows = rows.filter((r) => r.category === args.category);
    }

    return rows;
  },
});

export const getErrorLogStats = query({
  args: { laboratoryId: v.optional(v.id("laboratories")) },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);

    const rows = args.laboratoryId
      ? await ctx.db
          .query("errorLogs")
          .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
          .order("desc")
          .take(500)
      : await ctx.db.query("errorLogs").order("desc").take(500);

    const total = rows.length;
    const byCat: Record<string, number> = {};
    for (const r of rows) {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    }
    const byModule: Record<string, number> = {};
    for (const r of rows) {
      byModule[r.module] = (byModule[r.module] ?? 0) + 1;
    }

    return { total, byCat, byModule };
  },
});

export const clearErrorLogs = mutation({
  args: { laboratoryId: v.optional(v.id("laboratories")) },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);

    const rows = args.laboratoryId
      ? await ctx.db
          .query("errorLogs")
          .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
          .take(500)
      : await ctx.db.query("errorLogs").take(500);

    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
    return { deleted: rows.length };
  },
});
