import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

// ─── Helpers ────────────────────────────────────────────────────────

async function generateItemCode(ctx: Parameters<typeof getCurrentUserOrThrow>[0], labId: string): Promise<string> {
  const existing = await ctx.db
    .query("inventoryItems")
    .withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId as never))
    .collect();
  const seq = String(existing.length + 1).padStart(4, "0");
  return `ITEM-${seq}`;
}

// ─── Inventory Items ─────────────────────────────────────────────────

export const listInventoryItems = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    return items.map((item) => ({
      ...item,
      isLowStock: item.currentStock <= item.minStock,
      isExpiringSoon: item.expiryDate
        ? new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : false,
      isExpired: item.expiryDate ? new Date(item.expiryDate) < new Date() : false,
    }));
  },
});

export const getInventoryItem = query({
  args: { itemId: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return null;

    const transactions = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_item", (q) => q.eq("inventoryItemId", args.itemId))
      .order("desc")
      .take(50);

    const enrichedTx = await Promise.all(
      transactions.map(async (t) => {
        const performer = await ctx.db.get(t.performedBy);
        return { ...t, performerName: performer?.name };
      }),
    );

    return {
      ...item,
      transactions: enrichedTx,
      isLowStock: item.currentStock <= item.minStock,
      isExpiringSoon: item.expiryDate
        ? new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : false,
      isExpired: item.expiryDate ? new Date(item.expiryDate) < new Date() : false,
    };
  },
});

export const createInventoryItem = mutation({
  args: {
    name: v.string(),
    category: v.union(
      v.literal("reagent"), v.literal("consumable"), v.literal("standard"),
      v.literal("equipment"), v.literal("ppe"), v.literal("other"),
    ),
    supplier: v.optional(v.string()),
    catalogueNumber: v.optional(v.string()),
    unit: v.string(),
    currentStock: v.number(),
    minStock: v.number(),
    maxStock: v.optional(v.number()),
    reorderPoint: v.optional(v.number()),
    location: v.optional(v.string()),
    storageCondition: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    linkedInstrumentIds: v.optional(v.array(v.id("instruments"))),
    expiryDate: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const code = await generateItemCode(ctx, args.laboratoryId);
    const id = await ctx.db.insert("inventoryItems", {
      ...args,
      itemCode: code,
      isActive: true,
      createdBy: user._id,
    });
    // Record opening stock transaction
    if (args.currentStock > 0) {
      await ctx.db.insert("inventoryTransactions", {
        inventoryItemId: id,
        transactionType: "receipt",
        quantity: args.currentStock,
        quantityBefore: 0,
        quantityAfter: args.currentStock,
        reason: "Opening stock",
        performedBy: user._id,
        transactionDate: new Date().toISOString(),
      });
    }
    return id;
  },
});

export const updateInventoryItem = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    name: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("reagent"), v.literal("consumable"), v.literal("standard"),
      v.literal("equipment"), v.literal("ppe"), v.literal("other"),
    )),
    supplier: v.optional(v.string()),
    catalogueNumber: v.optional(v.string()),
    unit: v.optional(v.string()),
    minStock: v.optional(v.number()),
    maxStock: v.optional(v.number()),
    reorderPoint: v.optional(v.number()),
    location: v.optional(v.string()),
    storageCondition: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    linkedInstrumentIds: v.optional(v.array(v.id("instruments"))),
    expiryDate: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { itemId, ...fields } = args;
    await getCurrentUserOrThrow(ctx);
    const item = await ctx.db.get(itemId);
    if (!item) throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    await ctx.db.patch(itemId, fields);
  },
});

// ─── Stock Transactions ──────────────────────────────────────────────

export const recordTransaction = mutation({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    transactionType: v.union(
      v.literal("receipt"), v.literal("issue"), v.literal("adjustment"),
      v.literal("waste"), v.literal("return"),
    ),
    quantity: v.number(),
    referenceNumber: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const item = await ctx.db.get(args.inventoryItemId);
    if (!item) throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });

    // For issues and waste, quantity should be positive (we subtract)
    const delta =
      args.transactionType === "issue" || args.transactionType === "waste"
        ? -Math.abs(args.quantity)
        : Math.abs(args.quantity);

    const newStock = item.currentStock + delta;
    if (newStock < 0) {
      throw new ConvexError({ message: "Insufficient stock", code: "BAD_REQUEST" });
    }

    await ctx.db.insert("inventoryTransactions", {
      inventoryItemId: args.inventoryItemId,
      transactionType: args.transactionType,
      quantity: delta,
      quantityBefore: item.currentStock,
      quantityAfter: newStock,
      referenceNumber: args.referenceNumber,
      reason: args.reason,
      performedBy: user._id,
      transactionDate: new Date().toISOString(),
    });

    await ctx.db.patch(args.inventoryItemId, { currentStock: newStock });
  },
});

// ─── Alerts / Summary ───────────────────────────────────────────────

export const getInventoryAlerts = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const lowStock = items.filter((i) => i.isActive && i.currentStock <= i.minStock);
    const expiringSoon = items.filter(
      (i) => i.isActive && i.expiryDate && new Date(i.expiryDate) <= soon && new Date(i.expiryDate) >= now,
    );
    const expired = items.filter(
      (i) => i.isActive && i.expiryDate && new Date(i.expiryDate) < now,
    );

    return { lowStock, expiringSoon, expired };
  },
});
