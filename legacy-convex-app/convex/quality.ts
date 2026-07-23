import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { getCurrentUserOrThrow } from "./users.ts";
import { requireQA, requireManager } from "./lib/roles.ts";

// ─── Sequence helpers ────────────────────────────────────────────────

async function nextSeq(
  ctx: Parameters<typeof getCurrentUserOrThrow>[0],
  labId: Id<"laboratories">,
  prefix: string,
  table: "oosInvestigations" | "deviations" | "capas" | "changeControls",
): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await ctx.db
    .query(table)
    .withIndex("by_laboratory", (q) => q.eq("laboratoryId", labId))
    .collect();
  const yearItems = existing.filter((r) => {
    const num = (r as unknown as Record<string, string>)[
      table === "oosInvestigations" ? "oosNumber" :
      table === "deviations" ? "deviationNumber" :
      table === "capas" ? "capaNumber" : "changeNumber"
    ];
    return num?.includes(String(year));
  });
  const seq = String(yearItems.length + 1).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

// ═══════════════════════════════════════════════════════════════════
// OOS Investigations
// ═══════════════════════════════════════════════════════════════════

export const listOos = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("oosInvestigations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const assignee = r.assignedTo ? await ctx.db.get(r.assignedTo) : null;
      const sample = r.sampleId ? await ctx.db.get(r.sampleId) : null;
      return { ...r, assigneeName: assignee?.name, limsNumber: sample?.limsNumber };
    }));
  },
});

export const getOos = query({
  args: { id: v.id("oosInvestigations") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [assignee, detector, sample] = await Promise.all([
      r.assignedTo ? ctx.db.get(r.assignedTo) : null,
      ctx.db.get(r.detectedBy),
      r.sampleId ? ctx.db.get(r.sampleId) : null,
    ]);
    return { ...r, assigneeName: assignee?.name, detectorName: detector?.name, limsNumber: sample?.limsNumber };
  },
});

export const createOos = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    detectedDate: v.string(),
    sampleId: v.optional(v.id("samples")),
    sampleTestId: v.optional(v.id("sampleTests")),
    assignedTo: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const oosNumber = await nextSeq(ctx, args.laboratoryId, "OOS", "oosInvestigations");
    return await ctx.db.insert("oosInvestigations", {
      ...args,
      oosNumber,
      status: "open",
      detectedBy: user._id,
      createdBy: user._id,
    });
  },
});

export const updateOos = mutation({
  args: {
    id: v.id("oosInvestigations"),
    status: v.optional(v.union(
      v.literal("open"), v.literal("phase1"), v.literal("phase2"),
      v.literal("concluded"), v.literal("closed"),
    )),
    phase1Summary: v.optional(v.string()),
    phase1CompletedDate: v.optional(v.string()),
    phase2Summary: v.optional(v.string()),
    phase2CompletedDate: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    rootCauseCategory: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("invalidated"), v.literal("confirmed"), v.literal("inconclusive"))),
    assignedTo: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === "closed") {
      patch.closedDate = new Date().toISOString();
      patch.closedBy = user._id;
    }
    if (fields.status === "phase1" && fields.phase1CompletedDate) {
      patch.phase1CompletedBy = user._id;
    }
    if (fields.status === "phase2" && fields.phase2CompletedDate) {
      patch.phase2CompletedBy = user._id;
    }
    await ctx.db.patch(id, patch);
  },
});

// ═══════════════════════════════════════════════════════════════════
// Deviations
// ═══════════════════════════════════════════════════════════════════

export const listDeviations = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("deviations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const assignee = r.assignedTo ? await ctx.db.get(r.assignedTo) : null;
      return { ...r, assigneeName: assignee?.name };
    }));
  },
});

export const getDeviation = query({
  args: { id: v.id("deviations") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [assignee, detector] = await Promise.all([
      r.assignedTo ? ctx.db.get(r.assignedTo) : null,
      ctx.db.get(r.detectedBy),
    ]);
    return { ...r, assigneeName: assignee?.name, detectorName: detector?.name };
  },
});

export const createDeviation = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    deviationType: v.union(
      v.literal("equipment"), v.literal("procedural"), v.literal("environmental"),
      v.literal("material"), v.literal("personnel"), v.literal("other"),
    ),
    severity: v.union(v.literal("minor"), v.literal("major"), v.literal("critical")),
    detectedDate: v.string(),
    immediateAction: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const deviationNumber = await nextSeq(ctx, args.laboratoryId, "DEV", "deviations");
    return await ctx.db.insert("deviations", {
      ...args,
      deviationNumber,
      status: "open",
      detectedBy: user._id,
      createdBy: user._id,
    });
  },
});

export const updateDeviation = mutation({
  args: {
    id: v.id("deviations"),
    status: v.optional(v.union(v.literal("open"), v.literal("under_investigation"), v.literal("closed"))),
    investigation: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    immediateAction: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    linkedCapaId: v.optional(v.id("capas")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === "closed") {
      patch.closedDate = new Date().toISOString();
      patch.closedBy = user._id;
    }
    await ctx.db.patch(id, patch);
  },
});

// ═══════════════════════════════════════════════════════════════════
// CAPAs
// ═══════════════════════════════════════════════════════════════════

export const listCapas = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("capas")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const assignee = r.assignedTo ? await ctx.db.get(r.assignedTo) : null;
      const overdue = r.dueDate && r.status !== "closed" ? new Date(r.dueDate) < new Date() : false;
      return { ...r, assigneeName: assignee?.name, overdue };
    }));
  },
});

export const getCapa = query({
  args: { id: v.id("capas") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const [assignee, verifier] = await Promise.all([
      r.assignedTo ? ctx.db.get(r.assignedTo) : null,
      r.verifiedBy ? ctx.db.get(r.verifiedBy) : null,
    ]);
    const overdue = r.dueDate && r.status !== "closed" ? new Date(r.dueDate) < new Date() : false;
    return { ...r, assigneeName: assignee?.name, verifierName: verifier?.name, overdue };
  },
});

export const createCapa = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    capaType: v.union(v.literal("corrective"), v.literal("preventive")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    sourceType: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    actions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const capaNumber = await nextSeq(ctx, args.laboratoryId, "CAPA", "capas");
    return await ctx.db.insert("capas", {
      ...args,
      capaNumber,
      status: "open",
      createdBy: user._id,
    });
  },
});

export const updateCapa = mutation({
  args: {
    id: v.id("capas"),
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("verification"), v.literal("closed"))),
    actions: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    implementationDate: v.optional(v.string()),
    verificationCriteria: v.optional(v.string()),
    verificationDate: v.optional(v.string()),
    effectivenessReview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === "in_progress" && fields.implementationDate) {
      patch.implementedBy = user._id;
    }
    if (fields.status === "verification" && fields.verificationDate) {
      patch.verifiedBy = user._id;
    }
    if (fields.status === "closed") {
      patch.closedDate = new Date().toISOString();
      patch.closedBy = user._id;
    }
    await ctx.db.patch(id, patch);
  },
});

// ═══════════════════════════════════════════════════════════════════
// Change Controls
// ═══════════════════════════════════════════════════════════════════

export const listChangeControls = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("changeControls")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map(async (r) => {
      const requester = await ctx.db.get(r.requestedBy);
      return { ...r, requesterName: requester?.name };
    }));
  },
});

export const createChangeControl = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    description: v.string(),
    changeType: v.union(
      v.literal("equipment"), v.literal("method"), v.literal("reagent"),
      v.literal("software"), v.literal("personnel"), v.literal("facility"),
      v.literal("procedure"), v.literal("other"),
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    justification: v.optional(v.string()),
    riskAssessment: v.optional(v.string()),
    implementationPlan: v.optional(v.string()),
    plannedDate: v.optional(v.string()),
    verificationRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const changeNumber = await nextSeq(ctx, args.laboratoryId, "CC", "changeControls");
    return await ctx.db.insert("changeControls", {
      ...args,
      changeNumber,
      status: "draft",
      requestedBy: user._id,
      requestedDate: new Date().toISOString(),
      createdBy: user._id,
    });
  },
});

export const updateChangeControl = mutation({
  args: {
    id: v.id("changeControls"),
    status: v.optional(v.union(
      v.literal("draft"), v.literal("submitted"), v.literal("approved"),
      v.literal("rejected"), v.literal("implemented"), v.literal("closed"),
    )),
    plannedDate: v.optional(v.string()),
    implementedDate: v.optional(v.string()),
    riskAssessment: v.optional(v.string()),
    justification: v.optional(v.string()),
    implementationPlan: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { ...fields };
    if (fields.status === "approved") {
      patch.approvedBy = user._id;
      patch.approvedDate = new Date().toISOString();
    }
    if (fields.status === "implemented" && fields.implementedDate) {
      patch.implementedDate = fields.implementedDate;
    }
    await ctx.db.patch(id, patch);
  },
});

// ═══════════════════════════════════════════════════════════════════
// Quality Summary
// ═══════════════════════════════════════════════════════════════════

export const getQualitySummary = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args): Promise<{
    openOos: number;
    openDeviations: number;
    openCapas: number;
    overdueCapas: number;
    pendingChangeControls: number;
  }> => {
    const [oos, devs, capas, ccs] = await Promise.all([
      ctx.db.query("oosInvestigations").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
      ctx.db.query("deviations").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
      ctx.db.query("capas").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
      ctx.db.query("changeControls").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect(),
    ]);
    const now = new Date();
    return {
      openOos: oos.filter((r) => r.status !== "closed").length,
      openDeviations: devs.filter((r) => r.status !== "closed").length,
      openCapas: capas.filter((r) => r.status !== "closed").length,
      overdueCapas: capas.filter((r) => r.status !== "closed" && r.dueDate && new Date(r.dueDate) < now).length,
      pendingChangeControls: ccs.filter((r) => r.status === "submitted").length,
    };
  },
});
