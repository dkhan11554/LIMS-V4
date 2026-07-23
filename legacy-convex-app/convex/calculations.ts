import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import type { Id } from "./_generated/dataModel";

// ─── Formula Library ──────────────────────────────────────────────────────────

export const listFormulas = query({
  args: { laboratoryId: v.id("laboratories"), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const formulas = await ctx.db
      .query("calculationFormulas")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    if (args.category) return formulas.filter((f) => f.category === args.category);
    return formulas.filter((f) => f.isActive);
  },
});

export const getFormula = query({
  args: { id: v.id("calculationFormulas") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const createFormula = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    formula: v.string(),
    variables: v.array(v.object({
      symbol: v.string(),
      label: v.string(),
      unit: v.optional(v.string()),
      defaultValue: v.optional(v.number()),
    })),
    resultUnit: v.optional(v.string()),
    decimalPlaces: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("calculationFormulas", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateFormula = mutation({
  args: {
    id: v.id("calculationFormulas"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    formula: v.optional(v.string()),
    variables: v.optional(v.array(v.object({
      symbol: v.string(),
      label: v.string(),
      unit: v.optional(v.string()),
      defaultValue: v.optional(v.number()),
    }))),
    resultUnit: v.optional(v.string()),
    decimalPlaces: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteFormula = mutation({
  args: { id: v.id("calculationFormulas") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

// ─── Sample Test Calculations ─────────────────────────────────────────────────

export const getCalculation = query({
  args: { sampleTestId: v.id("sampleTests") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sampleTestCalculations")
      .withIndex("by_sample_test", (q) => q.eq("sampleTestId", args.sampleTestId))
      .first();
  },
});

export const saveCalculation = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    formulaId: v.optional(v.id("calculationFormulas")),
    formulaName: v.optional(v.string()),
    variableValues: v.optional(v.record(v.string(), v.number())),
    calculatedResult: v.optional(v.number()),
    replicates: v.optional(v.array(v.number())),
    average: v.optional(v.number()),
    stdDev: v.optional(v.number()),
    rsd: v.optional(v.number()),
    uncertainty: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sampleTestCalculations">> => {
    const me = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db
      .query("sampleTestCalculations")
      .withIndex("by_sample_test", (q) => q.eq("sampleTestId", args.sampleTestId))
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("sampleTestCalculations", {
      ...args,
      createdBy: me._id,
      updatedAt: now,
    });
  },
});

// ─── Retest Requests ──────────────────────────────────────────────────────────

export const listRetestRequests = query({
  args: {
    sampleId: v.optional(v.id("samples")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let requests;
    if (args.sampleId) {
      requests = await ctx.db
        .query("retestRequests")
        .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId!))
        .collect();
    } else if (args.status) {
      requests = await ctx.db
        .query("retestRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending_approval" | "approved" | "rejected" | "in_progress" | "completed"))
        .collect();
    } else {
      requests = await ctx.db.query("retestRequests").order("desc").take(200);
    }

    return await Promise.all(requests.map(async (r) => {
      const [requester, approver, sample, sampleTest] = await Promise.all([
        ctx.db.get(r.requestedBy),
        r.approvedBy ? ctx.db.get(r.approvedBy) : null,
        ctx.db.get(r.sampleId),
        ctx.db.get(r.sampleTestId),
      ]);
      let testName: string | undefined;
      if (sampleTest) {
        const test = await ctx.db.get(sampleTest.testId);
        testName = test?.name;
      }
      return {
        ...r,
        requesterName: requester?.name,
        approverName: approver?.name,
        limsNumber: sample?.limsNumber,
        sampleName: sample?.sampleName,
        testName,
      };
    }));
  },
});

export const createRetestRequest = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    sampleId: v.id("samples"),
    reason: v.string(),
    reasonDetail: v.optional(v.string()),
    originalResult: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"retestRequests">> => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("retestRequests", {
      ...args,
      requestedBy: me._id,
      requestedAt: new Date().toISOString(),
      status: "pending_approval",
      createdBy: me._id,
    });
  },
});

export const approveRetestRequest = mutation({
  args: {
    id: v.id("retestRequests"),
    approve: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, {
      status: args.approve ? "approved" : "rejected",
      approvedBy: me._id,
      approvedAt: new Date().toISOString(),
      notes: args.notes,
    });
  },
});

export const updateRetestRequest = mutation({
  args: {
    id: v.id("retestRequests"),
    status: v.optional(v.union(
      v.literal("pending_approval"), v.literal("approved"), v.literal("rejected"),
      v.literal("in_progress"), v.literal("completed"),
    )),
    retestResult: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    conclusion: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ─── Specification Sets ───────────────────────────────────────────────────────

export const listSpecSets = query({
  args: { laboratoryId: v.id("laboratories"), type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const sets = await ctx.db
      .query("specificationSets")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const filtered = args.type ? sets.filter((s) => s.type === args.type) : sets;
    return await Promise.all(filtered.map(async (s) => {
      const [approver, customer] = await Promise.all([
        s.approvedBy ? ctx.db.get(s.approvedBy) : null,
        s.customerId ? ctx.db.get(s.customerId) : null,
      ]);
      const params = await ctx.db
        .query("specificationParameters")
        .withIndex("by_spec_set", (q) => q.eq("specSetId", s._id))
        .collect();
      return { ...s, approverName: approver?.name, customerName: customer?.name, parameterCount: params.length };
    }));
  },
});

export const getSpecSet = query({
  args: { id: v.id("specificationSets") },
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.id);
    if (!set) return null;
    const params = await ctx.db
      .query("specificationParameters")
      .withIndex("by_spec_set", (q) => q.eq("specSetId", args.id))
      .collect();
    const paramsWithTests = await Promise.all(params.map(async (p) => {
      const test = p.testId ? await ctx.db.get(p.testId) : null;
      return { ...p, testName: test?.name, testCode: test?.testCode };
    }));
    return { ...set, parameters: paramsWithTests };
  },
});

export const createSpecSet = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    name: v.string(),
    code: v.string(),
    type: v.string(),
    pharmacopoeiaRef: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    product: v.optional(v.string()),
    country: v.optional(v.string()),
    version: v.string(),
    effectiveDate: v.string(),
    expiryDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"specificationSets">> => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("specificationSets", {
      ...args,
      status: "draft",
      createdBy: me._id,
    });
  },
});

export const updateSpecSet = mutation({
  args: {
    id: v.id("specificationSets"),
    name: v.optional(v.string()),
    version: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"), v.literal("approved"),
      v.literal("superseded"), v.literal("obsolete"),
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const { id, ...updates } = args;
    const approveFields = updates.status === "approved"
      ? { approvedBy: me._id, approvedAt: new Date().toISOString() }
      : {};
    await ctx.db.patch(id, { ...updates, ...approveFields });
  },
});

export const addSpecParameter = mutation({
  args: {
    specSetId: v.id("specificationSets"),
    testId: v.optional(v.id("tests")),
    parameterName: v.string(),
    unit: v.optional(v.string()),
    resultType: v.string(),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    alertLower: v.optional(v.number()),
    alertUpper: v.optional(v.number()),
    actionLower: v.optional(v.number()),
    actionUpper: v.optional(v.number()),
    nominalValue: v.optional(v.number()),
    tolerance: v.optional(v.number()),
    method: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"specificationParameters">> => {
    return await ctx.db.insert("specificationParameters", args);
  },
});

export const updateSpecParameter = mutation({
  args: {
    id: v.id("specificationParameters"),
    parameterName: v.optional(v.string()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    alertLower: v.optional(v.number()),
    alertUpper: v.optional(v.number()),
    actionLower: v.optional(v.number()),
    actionUpper: v.optional(v.number()),
    nominalValue: v.optional(v.number()),
    tolerance: v.optional(v.number()),
    unit: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteSpecParameter = mutation({
  args: { id: v.id("specificationParameters") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});
