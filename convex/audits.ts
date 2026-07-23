import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

export const listAudits = query({
  args: { laboratoryId: v.id("laboratories"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let audits = await ctx.db.query("audits").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    if (args.status) audits = audits.filter((a) => a.status === args.status);
    return await Promise.all(audits.map(async (a) => {
      const auditor = a.leadAuditor ? await ctx.db.get(a.leadAuditor) : null;
      const findings = await ctx.db.query("auditFindings").withIndex("by_audit", (q) => q.eq("auditId", a._id)).collect();
      return { ...a, leadAuditorName: auditor?.name, findingsCount: findings.length, openFindings: findings.filter((f) => f.status !== "closed").length };
    }));
  },
});

export const getAudit = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId);
    if (!audit) return null;
    const auditor = audit.leadAuditor ? await ctx.db.get(audit.leadAuditor) : null;
    const findings = await ctx.db.query("auditFindings").withIndex("by_audit", (q) => q.eq("auditId", args.auditId)).collect();
    const enrichedFindings = await Promise.all(findings.map(async (f) => {
      const responsible = f.responsibleId ? await ctx.db.get(f.responsibleId) : null;
      return { ...f, responsibleName: responsible?.name };
    }));
    return { ...audit, leadAuditorName: auditor?.name, findings: enrichedFindings };
  },
});

export const createAudit = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    auditType: v.union(v.literal("internal"), v.literal("external"), v.literal("regulatory"), v.literal("supplier"), v.literal("customer")),
    plannedDate: v.string(),
    leadAuditor: v.optional(v.id("users")),
    scope: v.optional(v.string()),
    objectives: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db.query("audits").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const auditNumber = `AUD-${new Date().getFullYear()}-${String(existing.length + 1).padStart(3, "0")}`;
    return await ctx.db.insert("audits", { ...args, auditNumber, status: "planned", createdBy: user._id });
  },
});

export const updateAudit = mutation({
  args: {
    auditId: v.id("audits"),
    title: v.optional(v.string()),
    status: v.optional(v.union(v.literal("planned"), v.literal("in_progress"), v.literal("report_pending"), v.literal("closed"))),
    conductedDate: v.optional(v.string()),
    closedDate: v.optional(v.string()),
    leadAuditor: v.optional(v.id("users")),
    scope: v.optional(v.string()),
    objectives: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { auditId, ...fields } = args;
    const audit = await ctx.db.get(auditId);
    if (!audit) throw new ConvexError({ message: "Audit not found", code: "NOT_FOUND" });
    await ctx.db.patch(auditId, fields);
  },
});

export const addFinding = mutation({
  args: {
    auditId: v.id("audits"),
    laboratoryId: v.id("laboratories"),
    type: v.union(v.literal("major"), v.literal("minor"), v.literal("observation"), v.literal("opportunity")),
    description: v.string(),
    requirement: v.optional(v.string()),
    evidence: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    responsibleId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db.query("auditFindings").withIndex("by_audit", (q) => q.eq("auditId", args.auditId)).collect();
    const findingNumber = `F-${String(existing.length + 1).padStart(3, "0")}`;
    return await ctx.db.insert("auditFindings", { ...args, findingNumber, status: "open", createdBy: user._id });
  },
});

export const updateFinding = mutation({
  args: {
    findingId: v.id("auditFindings"),
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    responsibleId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    linkedCapaId: v.optional(v.id("capas")),
    closedDate: v.optional(v.string()),
    closureEvidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const { findingId, ...fields } = args;
    await ctx.db.patch(findingId, fields);
  },
});
