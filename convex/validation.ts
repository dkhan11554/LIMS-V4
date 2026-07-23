/**
 * Result Validation & Westgard Rules — M33
 * Handles spec-based validation, Westgard multi-rule checks, trend analysis,
 * and electronic sign-off for sample test results.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import type { Id } from "./_generated/dataModel";

// ─── Westgard rule engine (pure TS, V8 runtime) ──────────────────────────────

export type WestgardResult = {
  violations: string[];
  status: "pass" | "warning" | "reject";
};

/**
 * Run all 6 classic Westgard rules plus 10x trend rule on a z-score series.
 * z[0] = oldest, z[n-1] = current.
 */
export function runWestgardRules(zScores: number[]): WestgardResult {
  if (zScores.length === 0) return { violations: [], status: "pass" };
  const violations: string[] = [];
  const n = zScores.length;
  const z = zScores;

  // 1-2S warning: latest value > ±2SD (warning only)
  if (Math.abs(z[n - 1]) > 2) {
    violations.push("1-2S:warning — last value exceeds ±2SD");
  }

  // 1-3S rejection: latest value > ±3SD
  if (Math.abs(z[n - 1]) > 3) {
    violations.push("1-3S:reject — last value exceeds ±3SD");
  }

  // 2-2S: two consecutive values both > +2SD or both < -2SD
  if (n >= 2 && z[n - 1] > 2 && z[n - 2] > 2) {
    violations.push("2-2S:reject — two consecutive values > +2SD");
  }
  if (n >= 2 && z[n - 1] < -2 && z[n - 2] < -2) {
    violations.push("2-2S:reject — two consecutive values < -2SD");
  }

  // R-4S: range between two consecutive values > 4SD
  if (n >= 2 && Math.abs(z[n - 1] - z[n - 2]) > 4) {
    violations.push("R-4S:reject — range between consecutive runs > 4SD");
  }

  // 4-1S: four consecutive values on same side > 1SD
  if (n >= 4) {
    const last4 = z.slice(n - 4);
    if (last4.every((v) => v > 1)) violations.push("4-1S:warning — 4 consecutive values > +1SD");
    if (last4.every((v) => v < -1)) violations.push("4-1S:warning — 4 consecutive values < -1SD");
  }

  // 10x: ten consecutive values on same side of mean
  if (n >= 10) {
    const last10 = z.slice(n - 10);
    if (last10.every((v) => v > 0)) violations.push("10x:warning — 10 consecutive values above mean");
    if (last10.every((v) => v < 0)) violations.push("10x:warning — 10 consecutive values below mean");
  }

  // 7T trend rule: seven consecutive values all trending same direction
  if (n >= 7) {
    const last7 = z.slice(n - 7);
    let ascending = true;
    let descending = true;
    for (let i = 1; i < last7.length; i++) {
      if (last7[i] <= last7[i - 1]) ascending = false;
      if (last7[i] >= last7[i - 1]) descending = false;
    }
    if (ascending) violations.push("7T:warning — 7 consecutive values trending upward");
    if (descending) violations.push("7T:warning — 7 consecutive values trending downward");
  }

  const hasReject = violations.some((v) => v.includes("reject"));
  const hasWarn = violations.some((v) => v.includes("warning"));
  const status: "pass" | "warning" | "reject" = hasReject ? "reject" : hasWarn ? "warning" : "pass";
  return { violations, status };
}

// ─── Spec limit check ─────────────────────────────────────────────────────────

type SpecStatus = "pass" | "fail_oos" | "warn_alert" | "warn_action" | "no_spec";

function checkSpecLimits(
  value: number,
  lower?: number,
  upper?: number,
  alertLower?: number,
  alertUpper?: number,
  actionLower?: number,
  actionUpper?: number,
): SpecStatus {
  if (lower === undefined && upper === undefined) return "no_spec";
  if ((lower !== undefined && value < lower) || (upper !== undefined && value > upper)) return "fail_oos";
  if ((actionLower !== undefined && value < actionLower) || (actionUpper !== undefined && value > actionUpper)) return "warn_action";
  if ((alertLower !== undefined && value < alertLower) || (alertUpper !== undefined && value > alertUpper)) return "warn_alert";
  return "pass";
}

// ─── Backend: create / validate ───────────────────────────────────────────────

export const createValidation = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    sampleId: v.id("samples"),
    laboratoryId: v.id("laboratories"),
    testId: v.id("tests"),
    measuredValue: v.number(),
    unit: v.optional(v.string()),
    specSetId: v.optional(v.id("specificationSets")),
    specParameterId: v.optional(v.id("specificationParameters")),
  },
  handler: async (ctx, args): Promise<Id<"resultValidations">> => {
    const me = await getCurrentUserOrThrow(ctx);

    // Pull spec limits if a parameter is linked
    let lowerLimit: number | undefined;
    let upperLimit: number | undefined;
    let alertLower: number | undefined;
    let alertUpper: number | undefined;
    let actionLower: number | undefined;
    let actionUpper: number | undefined;
    let specStatus: SpecStatus = "no_spec";

    if (args.specParameterId) {
      const param = await ctx.db.get(args.specParameterId);
      if (param) {
        lowerLimit = param.lowerLimit;
        upperLimit = param.upperLimit;
        alertLower = param.alertLower;
        alertUpper = param.alertUpper;
        actionLower = param.actionLower;
        actionUpper = param.actionUpper;
        specStatus = checkSpecLimits(args.measuredValue, lowerLimit, upperLimit, alertLower, alertUpper, actionLower, actionUpper);
      }
    }

    // Westgard: get recent historical QC results for this test to compute z-scores
    // Uses the 30 most recent sampleTest results for the same testId
    const recentResults = await ctx.db
      .query("resultValidations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .take(50);

    const sameTest = recentResults
      .filter((r) => r.testId === args.testId && r.measuredValue !== undefined)
      .slice(0, 29) // 29 historical + 1 current = 30
      .reverse();

    let westgardViolations: string[] = [];
    let westgardStatus: "pass" | "warning" | "reject" = "pass";

    if (sameTest.length >= 3) {
      const values = [...sameTest.map((r) => r.measuredValue), args.measuredValue];
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const sd = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (values.length - 1));
      if (sd > 0) {
        const zScores = values.map((v) => (v - avg) / sd);
        const result = runWestgardRules(zScores);
        westgardViolations = result.violations;
        westgardStatus = result.status;
      }
    }

    // Determine overall validation status
    const validationStatus =
      specStatus === "fail_oos" || westgardStatus === "reject"
        ? "flagged"
        : "pending";

    return await ctx.db.insert("resultValidations", {
      ...args,
      lowerLimit,
      upperLimit,
      specStatus,
      westgardViolations: westgardViolations.length ? westgardViolations : undefined,
      westgardStatus: westgardViolations.length ? westgardStatus : undefined,
      validationStatus,
      createdBy: me._id,
    });
  },
});

export const signOffValidation = mutation({
  args: {
    id: v.id("resultValidations"),
    accept: v.boolean(),
    notes: v.optional(v.string()),
    isOutlier: v.optional(v.boolean()),
    outlierReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, {
      validationStatus: args.accept ? "accepted" : "rejected",
      validatedBy: me._id,
      validatedAt: new Date().toISOString(),
      validationNotes: args.notes,
      isOutlier: args.isOutlier,
      outlierReason: args.outlierReason,
    });
  },
});

export const flagValidation = mutation({
  args: { id: v.id("resultValidations"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.id, {
      validationStatus: "flagged",
      validationNotes: args.notes,
    });
  },
});

export const deleteValidation = mutation({
  args: { id: v.id("resultValidations") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await ctx.db.delete(args.id);
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listValidations = query({
  args: {
    laboratoryId: v.id("laboratories"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("resultValidations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .take(300);

    const filtered = args.status && args.status !== "all"
      ? rows.filter((r) => r.validationStatus === args.status)
      : rows;

    return await Promise.all(filtered.map(async (r) => {
      const [sample, test, validator] = await Promise.all([
        ctx.db.get(r.sampleId),
        ctx.db.get(r.testId),
        r.validatedBy ? ctx.db.get(r.validatedBy) : null,
      ]);
      return {
        ...r,
        limsNumber: sample?.limsNumber,
        sampleName: sample?.sampleName,
        testName: test?.name,
        testCode: test?.testCode,
        validatorName: validator?.name,
      };
    }));
  },
});

export const getValidation = query({
  args: { id: v.id("resultValidations") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [sample, test, validator] = await Promise.all([
      ctx.db.get(r.sampleId),
      ctx.db.get(r.testId),
      r.validatedBy ? ctx.db.get(r.validatedBy) : null,
    ]);
    return { ...r, limsNumber: sample?.limsNumber, sampleName: sample?.sampleName, testName: test?.name, validatorName: validator?.name };
  },
});

export const getValidationForSampleTest = query({
  args: { sampleTestId: v.id("sampleTests") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("resultValidations")
      .withIndex("by_sample_test", (q) => q.eq("sampleTestId", args.sampleTestId))
      .first();
  },
});

export const getTestTrend = query({
  args: { laboratoryId: v.id("laboratories"), testId: v.id("tests") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("resultValidations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .take(100)
      .then((rows) => rows.filter((r) => r.testId === args.testId).reverse());
  },
});

export const getValidationStats = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("resultValidations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .take(500);

    const total = rows.length;
    const pending = rows.filter((r) => r.validationStatus === "pending").length;
    const flagged = rows.filter((r) => r.validationStatus === "flagged").length;
    const accepted = rows.filter((r) => r.validationStatus === "accepted").length;
    const rejected = rows.filter((r) => r.validationStatus === "rejected").length;
    const oos = rows.filter((r) => r.specStatus === "fail_oos").length;
    const westgardFails = rows.filter((r) => r.westgardStatus === "reject").length;

    return { total, pending, flagged, accepted, rejected, oos, westgardFails };
  },
});
