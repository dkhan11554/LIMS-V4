import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { getCurrentUserOrThrow } from "./users.ts";

// ─── Helpers ────────────────────────────────────────────────────────

async function generateInstrumentCode(ctx: Parameters<typeof getCurrentUserOrThrow>[0], labId: Id<"laboratories">): Promise<string> {
  const existing = await ctx.db
    .query("instruments")
    .withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId))
    .collect();
  const seq = String(existing.length + 1).padStart(4, "0");
  return `INST-${seq}`;
}

// ─── Instruments ────────────────────────────────────────────────────

export const listInstruments = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const instruments = await ctx.db
      .query("instruments")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    return await Promise.all(
      instruments.map(async (inst) => {
        const dept = inst.departmentId ? await ctx.db.get(inst.departmentId) : null;
        const calibrations = await ctx.db
          .query("instrumentCalibrations")
          .withIndex("by_instrument", (q) => q.eq("instrumentId", inst._id))
          .order("desc")
          .take(1);
        const lastCal = calibrations[0] ?? null;
        const overdue = inst.nextCalibrationDue
          ? new Date(inst.nextCalibrationDue) < new Date()
          : false;
        return { ...inst, departmentName: dept?.name, lastCalibration: lastCal, calibrationOverdue: overdue };
      }),
    );
  },
});

export const getInstrument = query({
  args: { instrumentId: v.id("instruments") },
  handler: async (ctx, args) => {
    const inst = await ctx.db.get(args.instrumentId);
    if (!inst) return null;
    const dept = inst.departmentId ? await ctx.db.get(inst.departmentId) : null;
    const calibrations = await ctx.db
      .query("instrumentCalibrations")
      .withIndex("by_instrument", (q) => q.eq("instrumentId", inst._id))
      .order("desc")
      .collect();
    const maintenance = await ctx.db
      .query("instrumentMaintenance")
      .withIndex("by_instrument", (q) => q.eq("instrumentId", inst._id))
      .order("desc")
      .collect();
    // Enrich calibrations with performer name
    const enrichedCals = await Promise.all(
      calibrations.map(async (c) => {
        const performer = c.performedBy ? await ctx.db.get(c.performedBy) : null;
        return { ...c, performerName: performer?.name };
      }),
    );
    const enrichedMaint = await Promise.all(
      maintenance.map(async (m) => {
        const performer = m.performedBy ? await ctx.db.get(m.performedBy) : null;
        return { ...m, performerName: performer?.name };
      }),
    );
    const overdue = inst.nextCalibrationDue
      ? new Date(inst.nextCalibrationDue) < new Date()
      : false;
    return {
      ...inst,
      departmentName: dept?.name,
      calibrations: enrichedCals,
      maintenance: enrichedMaint,
      calibrationOverdue: overdue,
    };
  },
});

export const createInstrument = mutation({
  args: {
    name: v.string(),
    type: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    assetNumber: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    location: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    warrantyExpiry: v.optional(v.string()),
    calibrationIntervalDays: v.optional(v.number()),
    lastCalibrationDate: v.optional(v.string()),
    nextCalibrationDue: v.optional(v.string()),
    linkedMethodIds: v.optional(v.array(v.id("testMethods"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const code = await generateInstrumentCode(ctx, args.laboratoryId);
    const id = await ctx.db.insert("instruments", {
      ...args,
      instrumentCode: code,
      status: "active",
      isActive: true,
      createdBy: user._id,
    });
    return id;
  },
});

export const updateInstrument = mutation({
  args: {
    instrumentId: v.id("instruments"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    assetNumber: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    location: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"), v.literal("inactive"),
      v.literal("under_calibration"), v.literal("under_maintenance"),
      v.literal("decommissioned"),
    )),
    purchaseDate: v.optional(v.string()),
    warrantyExpiry: v.optional(v.string()),
    calibrationIntervalDays: v.optional(v.number()),
    lastCalibrationDate: v.optional(v.string()),
    nextCalibrationDue: v.optional(v.string()),
    linkedMethodIds: v.optional(v.array(v.id("testMethods"))),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { instrumentId, ...fields } = args;
    await getCurrentUserOrThrow(ctx);
    const inst = await ctx.db.get(instrumentId);
    if (!inst) throw new ConvexError({ message: "Instrument not found", code: "NOT_FOUND" });
    await ctx.db.patch(instrumentId, fields);
  },
});

// ─── Calibrations ────────────────────────────────────────────────────

export const addCalibration = mutation({
  args: {
    instrumentId: v.id("instruments"),
    calibrationType: v.optional(v.string()),
    scheduledDate: v.string(),
    completedDate: v.optional(v.string()),
    result: v.optional(v.union(v.literal("pass"), v.literal("fail"), v.literal("conditional"))),
    certificateNumber: v.optional(v.string()),
    performedBy: v.optional(v.id("users")),
    externalProvider: v.optional(v.string()),
    nextDueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const inst = await ctx.db.get(args.instrumentId);
    if (!inst) throw new ConvexError({ message: "Instrument not found", code: "NOT_FOUND" });

    const calId = await ctx.db.insert("instrumentCalibrations", {
      ...args,
      createdBy: user._id,
    });

    // Update instrument's last/next calibration dates
    const patch: {
      lastCalibrationDate?: string;
      nextCalibrationDue?: string;
      status?: "active" | "inactive" | "under_calibration" | "under_maintenance" | "decommissioned";
    } = {};
    if (args.completedDate) patch.lastCalibrationDate = args.completedDate;
    if (args.nextDueDate) patch.nextCalibrationDue = args.nextDueDate;
    if (args.result === "pass") patch.status = "active";
    if (Object.keys(patch).length) await ctx.db.patch(args.instrumentId, patch);

    return calId;
  },
});

// ─── Maintenance ────────────────────────────────────────────────────

export const addMaintenance = mutation({
  args: {
    instrumentId: v.id("instruments"),
    maintenanceType: v.union(
      v.literal("preventive"), v.literal("corrective"), v.literal("breakdown"),
    ),
    description: v.string(),
    performedBy: v.optional(v.id("users")),
    externalProvider: v.optional(v.string()),
    maintenanceDate: v.string(),
    completedDate: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("resolved"), v.literal("pending"), v.literal("escalated"))),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const maintId = await ctx.db.insert("instrumentMaintenance", {
      ...args,
      createdBy: user._id,
    });
    // Reflect status on instrument
    if (args.maintenanceType === "breakdown" && !args.completedDate) {
      await ctx.db.patch(args.instrumentId, { status: "under_maintenance" });
    } else if (args.outcome === "resolved") {
      await ctx.db.patch(args.instrumentId, { status: "active" });
    }
    return maintId;
  },
});

// ─── Upcoming calibrations summary ───────────────────────────────────

export const getCalibrationsDue = query({
  args: { laboratoryId: v.id("laboratories"), daysAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.daysAhead ?? 30;
    const instruments = await ctx.db
      .query("instruments")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return instruments
      .filter((i) => i.isActive && i.nextCalibrationDue)
      .filter((i) => new Date(i.nextCalibrationDue!) <= cutoff)
      .map((i) => ({
        ...i,
        overdue: new Date(i.nextCalibrationDue!) < new Date(),
      }))
      .sort((a, b) => (a.nextCalibrationDue ?? "").localeCompare(b.nextCalibrationDue ?? ""));
  },
});
