/**
 * COA Records — M36: Enhanced COA Generation
 * Version control, watermark, AI summary, email tracking.
 */
import { mutation, query, action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import type { Id } from "./_generated/dataModel";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listCoaRecords = query({
  args: { sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("coaRecords")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .order("desc")
      .collect();

    return await Promise.all(records.map(async (r) => {
      const issuer = await ctx.db.get(r.issuedBy);
      return { ...r, issuerName: issuer?.name };
    }));
  },
});

export const getLatestCoa = query({
  args: { sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("coaRecords")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .order("desc")
      .first();
    if (!record) return null;
    const issuer = await ctx.db.get(record.issuedBy);
    return { ...record, issuerName: issuer?.name };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const issueCoa = mutation({
  args: {
    sampleId: v.id("samples"),
    laboratoryId: v.id("laboratories"),
    limsNumber: v.string(),
    watermark: v.optional(v.union(v.literal("DRAFT"), v.literal("CANCELLED"), v.literal("REISSUED"))),
    aiSummary: v.optional(v.string()),
    notes: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"coaRecords">> => {
    const me = await getCurrentUserOrThrow(ctx);
    const now = new Date().toISOString();

    // Find the latest existing version for this sample
    const existing = await ctx.db
      .query("coaRecords")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .order("desc")
      .first();

    const version = (existing?.version ?? 0) + 1;

    // If previous was "issued", mark it as superseded via reissued status
    if (existing && existing.status === "issued") {
      await ctx.db.patch(existing._id, { status: "reissued" });
    }

    const status = args.isDraft ? "draft" : "issued";

    return await ctx.db.insert("coaRecords", {
      sampleId: args.sampleId,
      laboratoryId: args.laboratoryId,
      limsNumber: args.limsNumber,
      version,
      status,
      watermark: args.watermark,
      issuedAt: status === "issued" ? now : undefined,
      issuedBy: me._id,
      aiSummary: args.aiSummary,
      notes: args.notes,
    });
  },
});

export const cancelCoa = mutation({
  args: { id: v.id("coaRecords"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      watermark: "CANCELLED",
      notes: args.reason,
    });
  },
});

export const recordEmailSent = mutation({
  args: { id: v.id("coaRecords"), emailedTo: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      emailedTo: args.emailedTo,
      emailedAt: new Date().toISOString(),
    });
  },
});

export const saveAiSummary = mutation({
  args: { id: v.id("coaRecords"), aiSummary: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { aiSummary: args.aiSummary });
  },
});

// ─── AI Summary Action ────────────────────────────────────────────────────────

export const generateAiSummary = action({
  args: {
    coaRecordId: v.id("coaRecords"),
    sampleName: v.string(),
    batchNumber: v.optional(v.string()),
    customerName: v.string(),
    tests: v.array(v.object({
      testName: v.string(),
      result: v.string(),
      unit: v.optional(v.string()),
      lowerLimit: v.optional(v.number()),
      upperLimit: v.optional(v.number()),
      passFailStatus: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<{ summary: string }> => {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      baseURL: "https://ai-gateway.hercules.app/v1",
      apiKey: process.env.HERCULES_API_KEY,
    });

    const passCount = args.tests.filter((t) => t.passFailStatus === "pass").length;
    const failCount = args.tests.filter((t) => t.passFailStatus === "fail").length;
    const pendingCount = args.tests.filter((t) => !t.passFailStatus).length;

    const testSummary = args.tests.map((t) => {
      const spec = t.lowerLimit != null || t.upperLimit != null
        ? ` (Spec: ${t.lowerLimit ?? ""}–${t.upperLimit ?? ""} ${t.unit ?? ""})`
        : "";
      return `- ${t.testName}: ${t.result} ${t.unit ?? ""}${spec} → ${t.passFailStatus?.toUpperCase() ?? "PENDING"}`;
    }).join("\n");

    const prompt = `You are a senior quality assurance pharmacist reviewing a Certificate of Analysis. Write a concise professional interpretation summary (3–5 sentences) suitable for inclusion on a COA.

Sample: ${args.sampleName}
Batch: ${args.batchNumber ?? "N/A"}
Customer: ${args.customerName}
Tests (${args.tests.length} total): ${passCount} PASS, ${failCount} FAIL, ${pendingCount} pending

${testSummary}

Instructions:
- State the overall compliance verdict clearly (COMPLIANT / NON-COMPLIANT / INCOMPLETE)
- Briefly note any out-of-specification findings and their significance
- Note if all results are within specification
- Use professional pharmaceutical QA language
- Do NOT include sample IDs, dates, or lab names — those appear elsewhere
- Maximum 5 sentences`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      });
      const summary = response.choices[0]?.message?.content?.trim() ?? "";
      return { summary };
    } catch (error) {
      if (error instanceof Error && error.message.includes("403")) {
        throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Insufficient AI credits. Please top up in Billing." });
      }
      throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "AI summary generation failed." });
    }
  },
});

// ─── Internal mutation for saving AI summary from action ─────────────────────

export const saveAiSummaryInternal = mutation({
  args: { id: v.id("coaRecords"), aiSummary: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { aiSummary: args.aiSummary });
  },
});