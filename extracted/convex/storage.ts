import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

export const listLocations = query({
  args: { laboratoryId: v.id("laboratories"), parentId: v.optional(v.id("storageLocations")) },
  handler: async (ctx, args) => {
    const locs = await ctx.db.query("storageLocations").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const filtered = args.parentId !== undefined
      ? locs.filter((l) => l.parentId === args.parentId)
      : locs.filter((l) => !l.parentId); // top-level only
    return filtered;
  },
});

export const getAllLocations = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    return await ctx.db.query("storageLocations").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
  },
});

export const createLocation = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    code: v.string(),
    locationType: v.union(v.literal("room"), v.literal("cabinet"), v.literal("refrigerator"), v.literal("freezer"), v.literal("shelf"), v.literal("rack"), v.literal("box")),
    parentId: v.optional(v.id("storageLocations")),
    temperature: v.optional(v.string()),
    capacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("storageLocations", { ...args, isActive: true, currentOccupancy: 0, createdBy: user._id });
  },
});

export const updateLocation = mutation({
  args: {
    locationId: v.id("storageLocations"),
    name: v.optional(v.string()),
    temperature: v.optional(v.string()),
    capacity: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { locationId, ...fields } = args;
    await ctx.db.patch(locationId, fields);
  },
});

export const assignSampleToStorage = mutation({
  args: {
    sampleId: v.id("samples"),
    locationId: v.id("storageLocations"),
    laboratoryId: v.id("laboratories"),
    position: v.optional(v.string()),
    retentionExpiry: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const loc = await ctx.db.get(args.locationId);
    if (!loc) throw new ConvexError({ message: "Location not found", code: "NOT_FOUND" });
    // Check out any existing active storage for this sample
    const existing = await ctx.db.query("sampleStorageAssignments").withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId)).collect();
    for (const a of existing.filter((a) => a.status === "in_storage")) {
      await ctx.db.patch(a._id, { status: "retrieved", checkOutDate: new Date().toISOString(), checkOutBy: user._id });
    }
    const id = await ctx.db.insert("sampleStorageAssignments", {
      ...args,
      checkInDate: new Date().toISOString(),
      checkInBy: user._id,
      status: "in_storage",
    });
    await ctx.db.patch(args.locationId, { currentOccupancy: (loc.currentOccupancy ?? 0) + 1 });
    return id;
  },
});

export const retrieveSample = mutation({
  args: { assignmentId: v.id("sampleStorageAssignments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const a = await ctx.db.get(args.assignmentId);
    if (!a) throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.assignmentId, { status: "retrieved", checkOutDate: new Date().toISOString(), checkOutBy: user._id });
    const loc = await ctx.db.get(a.locationId);
    if (loc) await ctx.db.patch(a.locationId, { currentOccupancy: Math.max(0, (loc.currentOccupancy ?? 1) - 1) });
  },
});

export const getSampleStorage = query({
  args: { sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db.query("sampleStorageAssignments").withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId)).collect();
    return await Promise.all(assignments.map(async (a) => {
      const loc = await ctx.db.get(a.locationId);
      const checkInUser = await ctx.db.get(a.checkInBy);
      return { ...a, locationName: loc?.name, locationCode: loc?.code, locationType: loc?.locationType, checkInByName: checkInUser?.name };
    }));
  },
});

export const listStorageAssignments = query({
  args: { laboratoryId: v.id("laboratories"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let assignments = await ctx.db.query("sampleStorageAssignments").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    if (args.status) assignments = assignments.filter((a) => a.status === args.status);
    return await Promise.all(assignments.map(async (a) => {
      const sample = await ctx.db.get(a.sampleId);
      const loc = await ctx.db.get(a.locationId);
      return { ...a, sampleName: sample?.sampleName, limsNumber: sample?.limsNumber, locationName: loc?.name, locationCode: loc?.code };
    }));
  },
});
