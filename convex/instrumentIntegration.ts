import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { getCurrentUserOrThrow } from "./users.ts";

// ─── Instrument Interfaces ────────────────────────────────────────────────────

export const listInterfaces = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const interfaces = await ctx.db
      .query("instrumentInterfaces")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    return await Promise.all(
      interfaces.map(async (iface) => {
        const instrument = await ctx.db.get(iface.instrumentId);
        return { ...iface, instrumentName: instrument?.name ?? "Unknown", instrumentCode: instrument?.instrumentCode };
      }),
    );
  },
});

export const getInterface = query({
  args: { interfaceId: v.id("instrumentInterfaces") },
  handler: async (ctx, args) => {
    const iface = await ctx.db.get(args.interfaceId);
    if (!iface) return null;
    const instrument = await ctx.db.get(iface.instrumentId);
    return { ...iface, instrumentName: instrument?.name, instrumentCode: instrument?.instrumentCode };
  },
});

export const listInterfacesForInstrument = query({
  args: { instrumentId: v.id("instruments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instrumentInterfaces")
      .withIndex("by_instrument", (q) => q.eq("instrumentId", args.instrumentId))
      .collect();
  },
});

export const createInterface = mutation({
  args: {
    instrumentId: v.id("instruments"),
    laboratoryId: v.id("laboratories"),
    interfaceName: v.string(),
    fileFormat: v.union(v.literal("csv"), v.literal("tsv"), v.literal("txt")),
    delimiter: v.optional(v.string()),
    hasHeaderRow: v.boolean(),
    headerRowIndex: v.optional(v.number()),
    dataStartRow: v.optional(v.number()),
    useNamedColumns: v.optional(v.boolean()),
    colLimsNumber: v.optional(v.number()),
    colTestCode: v.optional(v.number()),
    colResult: v.optional(v.number()),
    colUnit: v.optional(v.number()),
    colFlags: v.optional(v.number()),
    colAnalysisDate: v.optional(v.number()),
    colOperator: v.optional(v.number()),
    colNameLimsNumber: v.optional(v.string()),
    colNameTestCode: v.optional(v.string()),
    colNameResult: v.optional(v.string()),
    colNameUnit: v.optional(v.string()),
    colNameFlags: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("instrumentInterfaces", {
      ...args,
      isActive: true,
      createdBy: user._id,
    });
  },
});

export const updateInterface = mutation({
  args: {
    interfaceId: v.id("instrumentInterfaces"),
    interfaceName: v.optional(v.string()),
    fileFormat: v.optional(v.union(v.literal("csv"), v.literal("tsv"), v.literal("txt"))),
    delimiter: v.optional(v.string()),
    hasHeaderRow: v.optional(v.boolean()),
    headerRowIndex: v.optional(v.number()),
    dataStartRow: v.optional(v.number()),
    useNamedColumns: v.optional(v.boolean()),
    colLimsNumber: v.optional(v.number()),
    colTestCode: v.optional(v.number()),
    colResult: v.optional(v.number()),
    colUnit: v.optional(v.number()),
    colFlags: v.optional(v.number()),
    colAnalysisDate: v.optional(v.number()),
    colOperator: v.optional(v.number()),
    colNameLimsNumber: v.optional(v.string()),
    colNameTestCode: v.optional(v.string()),
    colNameResult: v.optional(v.string()),
    colNameUnit: v.optional(v.string()),
    colNameFlags: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { interfaceId, ...fields } = args;
    const iface = await ctx.db.get(interfaceId);
    if (!iface) throw new ConvexError({ message: "Interface not found", code: "NOT_FOUND" });
    await ctx.db.patch(interfaceId, fields);
  },
});

export const deleteInterface = mutation({
  args: { interfaceId: v.id("instrumentInterfaces") },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.delete(args.interfaceId);
  },
});

// ─── Result Batches ───────────────────────────────────────────────────────────

export const listBatches = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("instrumentResultBatches")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .take(100);
    return await Promise.all(
      batches.map(async (b) => {
        const instrument = await ctx.db.get(b.instrumentId);
        const uploader = await ctx.db.get(b.uploadedBy);
        return { ...b, instrumentName: instrument?.name ?? "Unknown", uploaderName: uploader?.name ?? "Unknown" };
      }),
    );
  },
});

export const getBatchRows = query({
  args: { batchId: v.id("instrumentResultBatches") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instrumentResultRows")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

export const createBatch = mutation({
  args: {
    instrumentId: v.id("instruments"),
    interfaceId: v.id("instrumentInterfaces"),
    laboratoryId: v.id("laboratories"),
    fileName: v.string(),
    rows: v.array(v.object({
      rawData: v.string(),
      limsNumber: v.optional(v.string()),
      testCode: v.optional(v.string()),
      result: v.optional(v.string()),
      unit: v.optional(v.string()),
      flags: v.optional(v.string()),
      analysisDate: v.optional(v.string()),
      operator: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const now = new Date().toISOString();

    // Match each row to a sampleTest
    let matchedRows = 0;
    let unmatchedRows = 0;

    type RowInput = typeof args.rows[number];
    type MatchedRow = RowInput & {
      matchStatus: "matched" | "unmatched" | "duplicate" | "skipped";
      sampleTestId?: string;
    };

    const enriched: MatchedRow[] = [];

    for (const row of args.rows) {
      if (!row.limsNumber || !row.testCode) {
        enriched.push({ ...row, matchStatus: "unmatched" });
        unmatchedRows++;
        continue;
      }

      // Find sample by LIMS number
      const sample = await ctx.db
        .query("samples")
        .withIndex("by_lims_number", (q) => q.eq("limsNumber", row.limsNumber!))
        .first();

      if (!sample) {
        enriched.push({ ...row, matchStatus: "unmatched" });
        unmatchedRows++;
        continue;
      }

      // Find test by code in the lab
      const test = await ctx.db
        .query("tests")
        .withIndex("by_code", (q) => q.eq("testCode", row.testCode!))
        .first();

      if (!test) {
        enriched.push({ ...row, matchStatus: "unmatched" });
        unmatchedRows++;
        continue;
      }

      // Find the sampleTest link
      const sampleTests = await ctx.db
        .query("sampleTests")
        .withIndex("by_sample", (q) => q.eq("sampleId", sample._id))
        .collect();

      const st = sampleTests.find((s) => s.testId === test._id);

      if (!st) {
        enriched.push({ ...row, matchStatus: "unmatched" });
        unmatchedRows++;
        continue;
      }

      // Check for duplicate (already has a result)
      if (st.result) {
        enriched.push({ ...row, matchStatus: "duplicate", sampleTestId: st._id });
        unmatchedRows++;
        continue;
      }

      enriched.push({ ...row, matchStatus: "matched", sampleTestId: st._id });
      matchedRows++;
    }

    // Create the batch record
    const batchId = await ctx.db.insert("instrumentResultBatches", {
      instrumentId: args.instrumentId,
      interfaceId: args.interfaceId,
      laboratoryId: args.laboratoryId,
      fileName: args.fileName,
      uploadedAt: now,
      uploadedBy: user._id,
      status: "pending",
      totalRows: args.rows.length,
      matchedRows,
      unmatchedRows,
      importedRows: 0,
    });

    // Insert rows
    for (const row of enriched) {
      await ctx.db.insert("instrumentResultRows", {
        batchId,
        laboratoryId: args.laboratoryId,
        rawData: row.rawData,
        limsNumber: row.limsNumber,
        testCode: row.testCode,
        result: row.result,
        unit: row.unit,
        flags: row.flags,
        analysisDate: row.analysisDate,
        operator: row.operator,
        matchStatus: row.matchStatus,
        sampleTestId: (row.matchStatus === "matched" || row.matchStatus === "duplicate") && row.sampleTestId
          ? (row.sampleTestId as Id<"sampleTests">)
          : undefined,
      });
    }

    return batchId;
  },
});

export const importBatch = mutation({
  args: { batchId: v.id("instrumentResultBatches") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new ConvexError({ message: "Batch not found", code: "NOT_FOUND" });

    const rows = await ctx.db
      .query("instrumentResultRows")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();

    const now = new Date().toISOString();
    let imported = 0;

    for (const row of rows) {
      if (row.matchStatus !== "matched" || !row.sampleTestId || !row.result) continue;

      const st = await ctx.db.get(row.sampleTestId);
      if (!st || st.result) continue; // skip if already has result

      // Auto-populate result
      await ctx.db.patch(row.sampleTestId, {
        result: row.result,
        status: "result_entered",
        startedAt: row.analysisDate ?? now,
        completedAt: now,
        assignedTo: st.assignedTo ?? user._id,
        comments: row.flags ? `Instrument flags: ${row.flags}` : undefined,
      });

      // Mark row as imported
      await ctx.db.patch(row._id, { importedAt: now });
      imported++;
    }

    // Determine final batch status
    const batchStatus = imported === batch.matchedRows ? "imported" : imported > 0 ? "partial" : "failed";
    await ctx.db.patch(args.batchId, { status: batchStatus, importedRows: imported });

    return { imported, total: batch.matchedRows };
  },
});

// ─── QC Results ───────────────────────────────────────────────────────────────

export const listQcResults = query({
  args: { instrumentId: v.id("instruments"), analyte: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let results;
    if (args.analyte) {
      results = await ctx.db
        .query("instrumentQcResults")
        .withIndex("by_instrument_analyte", (q) =>
          q.eq("instrumentId", args.instrumentId).eq("analyte", args.analyte!),
        )
        .order("asc")
        .take(200);
    } else {
      results = await ctx.db
        .query("instrumentQcResults")
        .withIndex("by_instrument", (q) => q.eq("instrumentId", args.instrumentId))
        .order("asc")
        .take(200);
    }
    return await Promise.all(
      results.map(async (r) => {
        const op = r.operatorId ? await ctx.db.get(r.operatorId) : null;
        return { ...r, operatorName: op?.name };
      }),
    );
  },
});

export const listAnalytesForInstrument = query({
  args: { instrumentId: v.id("instruments") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("instrumentQcResults")
      .withIndex("by_instrument", (q) => q.eq("instrumentId", args.instrumentId))
      .collect();
    const analytes = [...new Set(all.map((r) => r.analyte))];
    return analytes;
  },
});

export const addQcResult = mutation({
  args: {
    instrumentId: v.id("instruments"),
    laboratoryId: v.id("laboratories"),
    analyte: v.string(),
    controlLevel: v.string(),
    controlLotNumber: v.optional(v.string()),
    targetMean: v.number(),
    targetSd: v.number(),
    measuredValue: v.number(),
    runDate: v.string(),
    runNumber: v.optional(v.number()),
    operatorId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { targetMean: mean, targetSd: sd, measuredValue: val } = args;

    // Westgard rules evaluation
    const violations: string[] = [];
    const z = (val - mean) / sd;

    // Fetch last 10 results for same instrument+analyte+level for multi-rule checks
    const prev = await ctx.db
      .query("instrumentQcResults")
      .withIndex("by_instrument_analyte", (q) =>
        q.eq("instrumentId", args.instrumentId).eq("analyte", args.analyte),
      )
      .order("desc")
      .take(10);
    const prevSameLevel = prev.filter((r) => r.controlLevel === args.controlLevel);
    const zPrev = prevSameLevel.map((r) => (r.measuredValue - r.targetMean) / r.targetSd);

    if (Math.abs(z) > 3) violations.push("1-3s: Value exceeds ±3SD — reject");
    else if (Math.abs(z) > 2) violations.push("1-2s: Value exceeds ±2SD — warning");

    // 2-2s: 2 consecutive > 2SD same side
    if (zPrev[0] !== undefined && Math.sign(z) === Math.sign(zPrev[0]) && Math.abs(z) > 2 && Math.abs(zPrev[0]) > 2) {
      violations.push("2-2s: Two consecutive >2SD same direction — reject");
    }

    // R-4s: range of last 2 > 4SD
    if (zPrev[0] !== undefined && Math.abs(z - zPrev[0]) > 4) {
      violations.push("R-4s: Range between two consecutive >4SD — reject");
    }

    // 4-1s: 4 consecutive >1SD same side
    const last4z = [z, ...zPrev.slice(0, 3).map((v) => v)];
    if (last4z.length === 4 && last4z.every((zi) => zi > 1 && Math.sign(zi) === Math.sign(last4z[0]!))) {
      violations.push("4-1s: Four consecutive >1SD same direction — reject");
    } else if (last4z.length === 4 && last4z.every((zi) => zi < -1 && Math.sign(zi) === Math.sign(last4z[0]!))) {
      violations.push("4-1s: Four consecutive >1SD same direction — reject");
    }

    // 10x: 10 consecutive same side of mean
    const last10z = [z, ...zPrev.slice(0, 9).map((v) => v)];
    if (last10z.length === 10 && last10z.every((zi) => zi > 0)) {
      violations.push("10x: Ten consecutive values above mean — reject");
    } else if (last10z.length === 10 && last10z.every((zi) => zi < 0)) {
      violations.push("10x: Ten consecutive values below mean — reject");
    }

    const accepted = violations.filter((v) => v.includes("reject")).length === 0;

    return await ctx.db.insert("instrumentQcResults", {
      ...args,
      westgardViolations: violations,
      accepted,
      createdBy: user._id,
    });
  },
});

export const deleteQcResult = mutation({
  args: { qcResultId: v.id("instrumentQcResults") },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.delete(args.qcResultId);
  },
});

export const getQcSummary = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    // Get all instruments in lab
    const instruments = await ctx.db
      .query("instruments")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    const summaries = await Promise.all(
      instruments.map(async (inst) => {
        const recent = await ctx.db
          .query("instrumentQcResults")
          .withIndex("by_instrument", (q) => q.eq("instrumentId", inst._id))
          .order("desc")
          .take(20);
        const violations = recent.filter((r) => (r.westgardViolations?.length ?? 0) > 0).length;
        const rejected = recent.filter((r) => !r.accepted).length;
        return { instrumentId: inst._id, instrumentName: inst.name, instrumentCode: inst.instrumentCode, recentRuns: recent.length, violations, rejected };
      }),
    );

    return summaries.filter((s) => s.recentRuns > 0);
  },
});
