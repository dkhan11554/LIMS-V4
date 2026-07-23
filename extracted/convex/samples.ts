import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { requireReviewer, requireQA, requireSampleManager } from "./lib/roles.ts";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type SampleStatus =
  | "draft" | "registered" | "awaiting_receipt" | "received" | "accepted"
  | "rejected" | "assigned" | "preparation" | "testing" | "result_entered"
  | "pending_review" | "returned" | "pending_qa" | "oos_investigation"
  | "approved" | "coa_generated" | "delivered" | "stored" | "disposed" | "cancelled";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function addCustodyEntry(
  ctx: MutationCtx,
  sampleId: Id<"samples">,
  userId: Id<"users">,
  action: string,
  opts: { fromName?: string; toName?: string; location?: string; notes?: string } = {}
) {
  await ctx.db.insert("chainOfCustody", {
    sampleId,
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...opts,
  });
}

async function getNextLimsNumber(
  ctx: MutationCtx,
  laboratoryId: Id<"laboratories">
): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await ctx.db
    .query("limsCounters")
    .withIndex("by_lab_year", (q) => q.eq("laboratoryId", laboratoryId).eq("year", year))
    .unique();

  let seq: number;
  if (counter) {
    seq = counter.lastSequence + 1;
    await ctx.db.patch(counter._id, { lastSequence: seq });
  } else {
    seq = 1;
    await ctx.db.insert("limsCounters", { laboratoryId, year, lastSequence: 1 });
  }
  return `LAB-${year}-${String(seq).padStart(6, "0")}`;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getMyAssignedTests = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const sampleTests = await ctx.db
      .query("sampleTests")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", user._id))
      .collect();

    const active = sampleTests.filter((st) =>
      ["assigned", "in_progress"].includes(st.status)
    );

    const enriched = await Promise.all(
      active.map(async (st) => {
        const test = await ctx.db.get(st.testId);
        const sample = await ctx.db.get(st.sampleId);
        if (!sample || sample.laboratoryId !== args.laboratoryId) return null;
        const customer = await ctx.db.get(sample.customerId);
        return {
          ...st,
          testName: test?.name ?? "",
          testCode: test?.testCode ?? "",
          unit: test?.unit,
          resultType: test?.resultType,
          lowerLimit: test?.lowerLimit,
          upperLimit: test?.upperLimit,
          sampleLimsNumber: sample.limsNumber,
          sampleName: sample.sampleName,
          samplePriority: sample.priority,
          customerName: customer?.name ?? "",
        };
      })
    );
    return enriched.filter((e): e is NonNullable<typeof e> => e !== null);
  },
});

export const listSamples = query({
  args: {
    laboratoryId: v.id("laboratories"),
    status: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
  },
  handler: async (ctx, args) => {
    let samples;
    if (args.customerId) {
      samples = await ctx.db
        .query("samples")
        .withIndex("by_customer", (q) => q.eq("customerId", args.customerId!))
        .collect();
      samples = samples.filter((s) => s.laboratoryId === args.laboratoryId);
    } else if (args.status) {
      const all = await ctx.db
        .query("samples")
        .withIndex("by_status", (q) =>
          q.eq("status", args.status as SampleStatus)
        )
        .collect();
      samples = all.filter((s) => s.laboratoryId === args.laboratoryId);
    } else {
      samples = await ctx.db
        .query("samples")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
        .order("desc")
        .collect();
    }

    // Enrich with customer name
    const enriched = await Promise.all(
      samples.map(async (s) => {
        const customer = await ctx.db.get(s.customerId);
        return { ...s, customerName: customer?.name ?? "Unknown" };
      })
    );
    return enriched;
  },
});

export const getSample = query({
  args: { id: v.id("samples") },
  handler: async (ctx, args) => {
    const sample = await ctx.db.get(args.id);
    if (!sample) return null;
    const sampleTests = await ctx.db
      .query("sampleTests")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.id))
      .collect();

    // Enrich tests with test details
    const enrichedTests = await Promise.all(
      sampleTests.map(async (st) => {
        const test = await ctx.db.get(st.testId);
        const assignedUser = st.assignedTo ? await ctx.db.get(st.assignedTo) : null;
        return { ...st, testName: test?.name ?? "", testCode: test?.testCode ?? "", unit: test?.unit, resultType: test?.resultType, lowerLimit: test?.lowerLimit, upperLimit: test?.upperLimit, assignedUserName: assignedUser?.name };
      })
    );

    const customer = await ctx.db.get(sample.customerId);
    const project = sample.projectId ? await ctx.db.get(sample.projectId) : null;
    const receivedByUser = sample.receivedBy ? await ctx.db.get(sample.receivedBy) : null;

    return { ...sample, enrichedTests, customer, project, receivedByUserName: receivedByUser?.name };
  },
});

export const getChainOfCustody = query({
  args: { sampleId: v.id("samples") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("chainOfCustody")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .order("asc")
      .collect();
    const enriched = await Promise.all(
      entries.map(async (e) => {
        const user = await ctx.db.get(e.userId);
        return { ...e, userName: user?.name ?? "System" };
      })
    );
    return enriched;
  },
});

export const getAuditTrail = query({
  args: { module: v.string(), recordId: v.string() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("auditTrail")
      .withIndex("by_record", (q) =>
        q.eq("module", args.module).eq("recordId", args.recordId)
      )
      .collect();
    const enriched = await Promise.all(
      entries.map(async (e) => {
        const user = await ctx.db.get(e.userId);
        return { ...e, userName: user?.name ?? "System" };
      })
    );
    return enriched;
  },
});

export const getDashboardStats = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    const total = samples.length;
    const inProgress = samples.filter((s) =>
      ["testing", "preparation", "assigned"].includes(s.status)
    ).length;
    const pendingReview = samples.filter((s) =>
      ["pending_review", "pending_qa"].includes(s.status)
    ).length;
    const completed = samples.filter((s) =>
      ["approved", "coa_generated", "delivered"].includes(s.status)
    ).length;
    const overdue = samples.filter((s) => {
      if (!s.requestedCompletionDate) return false;
      return (
        new Date(s.requestedCompletionDate) < new Date() &&
        !["approved", "cancelled", "disposed", "coa_generated", "delivered"].includes(s.status)
      );
    }).length;

    // Status distribution for pie/bar chart
    const statusCounts: Record<string, number> = {};
    for (const s of samples) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    // Samples registered per day for the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSamples = samples.filter((s) => s._creationTime >= thirtyDaysAgo);
    const byDay: Record<string, number> = {};
    for (const s of recentSamples) {
      const day = new Date(s._creationTime).toISOString().split("T")[0];
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    // Fill in missing days with 0
    const volumeByDay = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(thirtyDaysAgo + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      return { date: key, count: byDay[key] ?? 0 };
    });

    // Priority breakdown
    const byPriority = {
      routine: samples.filter((s) => s.priority === "routine").length,
      urgent: samples.filter((s) => s.priority === "urgent").length,
      stat: samples.filter((s) => s.priority === "stat").length,
    };

    // TAT: average days from registration to approval for completed samples
    const completedWithDates = samples.filter(
      (s) =>
        ["approved", "coa_generated", "delivered"].includes(s.status) &&
        s.receivedDate
    );
    const avgTatDays =
      completedWithDates.length > 0
        ? completedWithDates.reduce((acc, s) => {
            const received = new Date(s.receivedDate!).getTime();
            const completed = s._creationTime; // approximation — use creation as proxy for now
            return acc + Math.max(0, (Date.now() - received) / (1000 * 60 * 60 * 24));
          }, 0) / completedWithDates.length
        : 0;

    // Recent 10 samples enriched for activity feed
    const sortedRecent = [...samples]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10);
    const recentEnriched = await Promise.all(
      sortedRecent.map(async (s) => {
        const customer = await ctx.db.get(s.customerId);
        return { ...s, customerName: customer?.name ?? "Unknown" };
      })
    );

    return {
      total,
      inProgress,
      pendingReview,
      completed,
      overdue,
      statusCounts,
      volumeByDay,
      byPriority,
      avgTatDays: Math.round(avgTatDays * 10) / 10,
      recentSamples: recentEnriched,
    };
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const registerSample = mutation({
  args: {
    customerId: v.id("customers"),
    projectId: v.optional(v.id("customerProjects")),
    laboratoryId: v.id("laboratories"),
    sampleName: v.string(),
    sampleType: v.optional(v.string()),
    product: v.optional(v.string()),
    batchNumber: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    manufacturingDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    collectionDate: v.optional(v.string()),
    collectionLocation: v.optional(v.string()),
    priority: v.union(v.literal("routine"), v.literal("urgent"), v.literal("stat")),
    containerType: v.optional(v.string()),
    containerCount: v.optional(v.number()),
    sampleVolume: v.optional(v.string()),
    storageCondition: v.optional(v.string()),
    requestedCompletionDate: v.optional(v.string()),
    customerInstructions: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    customerSampleNumber: v.optional(v.string()),
    testIds: v.array(v.id("tests")),
  },
  handler: async (ctx, args): Promise<{ sampleId: Id<"samples">; limsNumber: string }> => {
    const me = await getCurrentUserOrThrow(ctx);
    const { testIds, ...sampleData } = args;

    const limsNumber = await getNextLimsNumber(ctx, args.laboratoryId);

    const sampleId = await ctx.db.insert("samples", {
      ...sampleData,
      limsNumber,
      status: "registered",
      createdBy: me._id,
    });

    for (const testId of testIds) {
      await ctx.db.insert("sampleTests", {
        sampleId,
        testId,
        status: "not_assigned",
        createdBy: me._id,
      });
    }

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: sampleId,
      action: "registered",
      newValue: limsNumber,
      timestamp: new Date().toISOString(),
    });

    const customer = await ctx.db.get(args.customerId);
    await addCustodyEntry(ctx, sampleId, me._id, "registered", {
      toName: "Laboratory",
      notes: `Registered as ${limsNumber} by ${me.name ?? "user"}. Customer: ${customer?.name ?? ""}`,
    });

    return { sampleId, limsNumber };
  },
});

export const receiveSample = mutation({
  args: {
    id: v.id("samples"),
    packageCondition: v.string(),
    containerCondition: v.string(),
    sealCondition: v.string(),
    temperature: v.optional(v.string()),
    temperatureAdequate: v.optional(v.boolean()),
    sampleConditionNotes: v.optional(v.string()),
    receivedDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const { id, ...rest } = args;
    const sample = await ctx.db.get(id);
    if (!sample) throw new ConvexError({ message: "Sample not found", code: "NOT_FOUND" });

    await ctx.db.patch(id, {
      ...rest,
      receivedBy: me._id,
      receivedDate: rest.receivedDate ?? new Date().toISOString(),
      status: "received",
    });

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: id,
      action: "received",
      oldValue: sample.status,
      newValue: "received",
      timestamp: new Date().toISOString(),
    });

    await addCustodyEntry(ctx, id, me._id, "received", {
      toName: me.name ?? "Lab Reception",
      notes: `Package: ${args.packageCondition}, Container: ${args.containerCondition}, Seal: ${args.sealCondition}`,
    });
  },
});

export const acceptSample = mutation({
  args: {
    id: v.id("samples"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const sample = await ctx.db.get(args.id);
    if (!sample) throw new ConvexError({ message: "Sample not found", code: "NOT_FOUND" });

    await ctx.db.patch(args.id, { status: "accepted" });

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: args.id,
      action: "accepted",
      oldValue: sample.status,
      newValue: "accepted",
      reason: args.notes,
      timestamp: new Date().toISOString(),
    });

    await addCustodyEntry(ctx, args.id, me._id, "accepted", {
      toName: "Laboratory",
      notes: args.notes,
    });
  },
});

export const rejectSample = mutation({
  args: {
    id: v.id("samples"),
    rejectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const sample = await ctx.db.get(args.id);
    if (!sample) throw new ConvexError({ message: "Sample not found", code: "NOT_FOUND" });

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.rejectionReason,
    });

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: args.id,
      action: "rejected",
      oldValue: sample.status,
      newValue: "rejected",
      reason: args.rejectionReason,
      timestamp: new Date().toISOString(),
    });

    await addCustodyEntry(ctx, args.id, me._id, "rejected", {
      notes: `Rejection reason: ${args.rejectionReason}`,
    });
  },
});

export const updateSampleStatus = mutation({
  args: {
    id: v.id("samples"),
    status: v.string(),
    reason: v.optional(v.string()),
    receivedBy: v.optional(v.id("users")),
    packageCondition: v.optional(v.string()),
    containerCondition: v.optional(v.string()),
    sealCondition: v.optional(v.string()),
    temperature: v.optional(v.string()),
    temperatureAdequate: v.optional(v.boolean()),
    sampleConditionNotes: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    receivedDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const { id, status, reason, ...rest } = args;
    const sample = await ctx.db.get(id);
    if (!sample) throw new Error("Sample not found");

    await ctx.db.patch(id, {
      status: status as SampleStatus,
      ...rest,
    });

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: id,
      action: `status_changed_to_${status}`,
      oldValue: sample.status,
      newValue: status,
      reason,
      timestamp: new Date().toISOString(),
    });
  },
});

export const assignTest = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    analystId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.sampleTestId, {
      assignedTo: args.analystId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    });
    await ctx.db.insert("notifications", {
      userId: args.analystId,
      title: "New Test Assigned",
      message: "A new test has been assigned to you.",
      type: "assignment",
      relatedModule: "sampleTests",
      relatedId: args.sampleTestId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  },
});

export const enterResult = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    result: v.string(),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const st = await ctx.db.get(args.sampleTestId);
    if (!st) throw new Error("Sample test not found");
    const test = await ctx.db.get(st.testId);

    let passFailStatus: "pass" | "fail" | undefined;
    if (test && test.resultType === "numeric") {
      const val = parseFloat(args.result);
      if (!isNaN(val)) {
        const belowUpper = test.upperLimit == null || val <= test.upperLimit;
        const aboveLower = test.lowerLimit == null || val >= test.lowerLimit;
        passFailStatus = belowUpper && aboveLower ? "pass" : "fail";
      }
    }

    await ctx.db.patch(args.sampleTestId, {
      result: args.result,
      passFailStatus,
      comments: args.comments,
      status: passFailStatus === "fail" ? "oos" : "result_entered",
      completedAt: new Date().toISOString(),
    });

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "sampleTests",
      recordId: args.sampleTestId,
      action: "result_entered",
      newValue: args.result,
      timestamp: new Date().toISOString(),
    });
  },
});

export const startTest = mutation({
  args: { sampleTestId: v.id("sampleTests") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const st = await ctx.db.get(args.sampleTestId);
    if (!st) throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.sampleTestId, {
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "sampleTests",
      recordId: args.sampleTestId,
      action: "test_started",
      timestamp: new Date().toISOString(),
    });
  },
});

export const submitForReview = mutation({
  args: { sampleTestId: v.id("sampleTests") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const st = await ctx.db.get(args.sampleTestId);
    if (!st) throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.sampleTestId, { status: "submitted" });
    // Check if all tests on the sample are submitted/approved, update sample status
    const allTests = await ctx.db
      .query("sampleTests")
      .withIndex("by_sample", (q) => q.eq("sampleId", st.sampleId))
      .collect();
    const allDone = allTests.every((t) =>
      ["submitted", "technically_approved", "qa_approved", "oos"].includes(t.status)
    );
    if (allDone) {
      const hasOos = allTests.some((t) => t.status === "oos");
      await ctx.db.patch(st.sampleId, {
        status: hasOos ? "oos_investigation" : "pending_review",
      });
      await ctx.db.insert("auditTrail", {
        userId: me._id,
        module: "samples",
        recordId: st.sampleId,
        action: hasOos ? "status_changed_to_oos_investigation" : "status_changed_to_pending_review",
        newValue: hasOos ? "oos_investigation" : "pending_review",
        timestamp: new Date().toISOString(),
      });
    }
  },
});

export const batchAssignTests = mutation({
  args: {
    assignments: v.array(v.object({
      sampleTestId: v.id("sampleTests"),
      analystId: v.id("users"),
    })),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const now = new Date().toISOString();
    for (const { sampleTestId, analystId } of args.assignments) {
      await ctx.db.patch(sampleTestId, {
        assignedTo: analystId,
        assignedAt: now,
        status: "assigned",
      });
      await ctx.db.insert("notifications", {
        userId: analystId,
        title: "New Test Assigned",
        message: "A test has been assigned to you.",
        type: "assignment",
        relatedModule: "sampleTests",
        relatedId: sampleTestId,
        isRead: false,
        createdAt: now,
      });
    }
    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "sampleTests",
      recordId: "batch",
      action: `batch_assigned_${args.assignments.length}_tests`,
      timestamp: now,
    });
  },
});

export const reviewResult = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    approved: v.boolean(),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const st = await ctx.db.get(args.sampleTestId);
    if (!st) throw new Error("Not found");
    if (st.assignedTo === me._id) throw new Error("Cannot review own work");

    await ctx.db.patch(args.sampleTestId, {
      reviewedBy: me._id,
      reviewedAt: new Date().toISOString(),
      reviewComments: args.comments,
      status: args.approved ? "technically_approved" : "returned",
    });
  },
});

export const qaApprove = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    approved: v.boolean(),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await ctx.db.patch(args.sampleTestId, {
      qaApprovedBy: me._id,
      qaApprovedAt: new Date().toISOString(),
      reviewComments: args.comments,
      status: args.approved ? "qa_approved" : "returned",
    });
  },
});

// ─── Sample-level Technical Review ──────────────────────────────────────────

export const technicalReviewSample = mutation({
  args: {
    sampleId: v.id("samples"),
    approved: v.boolean(),
    comments: v.optional(v.string()),
    reviewerSignature: v.optional(v.string()), // typed name used as e-sig
  },
  handler: async (ctx, args) => {
    const me = await requireReviewer(ctx);
    const sample = await ctx.db.get(args.sampleId);
    if (!sample) throw new ConvexError({ message: "Sample not found", code: "NOT_FOUND" });

    const tests = await ctx.db
      .query("sampleTests")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .collect();

    const now = new Date().toISOString();

    if (args.approved) {
      // Approve all submitted tests
      for (const t of tests) {
        if (t.status === "submitted") {
          await ctx.db.patch(t._id, {
            reviewedBy: me._id,
            reviewedAt: now,
            reviewComments: args.comments,
            status: "technically_approved",
          });
        }
      }
      await ctx.db.patch(args.sampleId, { status: "pending_qa" });
    } else {
      // Return all submitted tests for correction
      for (const t of tests) {
        if (t.status === "submitted") {
          await ctx.db.patch(t._id, {
            reviewedBy: me._id,
            reviewedAt: now,
            reviewComments: args.comments,
            status: "returned",
          });
        }
      }
      await ctx.db.patch(args.sampleId, { status: "returned" });
    }

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: args.sampleId,
      action: args.approved ? "technically_approved" : "returned_for_correction",
      oldValue: sample.status,
      newValue: args.approved ? "pending_qa" : "returned",
      reason: args.comments,
      timestamp: now,
    });

    if (args.approved) {
      // Notify QA officers — simplified: notify all lab members with qa_officer role
      const labUsers = await ctx.db.query("users").collect();
      const qaOfficers = labUsers.filter((u) => u.role === "qa_officer" && u._id !== me._id);
      for (const officer of qaOfficers) {
        await ctx.db.insert("notifications", {
          userId: officer._id,
          title: "Sample Ready for QA Approval",
          message: `${sample.limsNumber} has passed technical review and is awaiting QA sign-off.`,
          type: "review",
          relatedModule: "samples",
          relatedId: args.sampleId,
          isRead: false,
          createdAt: now,
        });
      }
    }
  },
});

// ─── Sample-level QA Approval ────────────────────────────────────────────────

export const qaApproveSample = mutation({
  args: {
    sampleId: v.id("samples"),
    approved: v.boolean(),
    comments: v.optional(v.string()),
    qaSignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireQA(ctx);
    const sample = await ctx.db.get(args.sampleId);
    if (!sample) throw new ConvexError({ message: "Sample not found", code: "NOT_FOUND" });

    const tests = await ctx.db
      .query("sampleTests")
      .withIndex("by_sample", (q) => q.eq("sampleId", args.sampleId))
      .collect();

    const now = new Date().toISOString();

    if (args.approved) {
      for (const t of tests) {
        if (t.status === "technically_approved") {
          await ctx.db.patch(t._id, {
            qaApprovedBy: me._id,
            qaApprovedAt: now,
            reviewComments: args.comments,
            status: "qa_approved",
          });
        }
      }
      await ctx.db.patch(args.sampleId, { status: "approved" });
    } else {
      for (const t of tests) {
        if (t.status === "technically_approved") {
          await ctx.db.patch(t._id, {
            qaApprovedBy: me._id,
            qaApprovedAt: now,
            reviewComments: args.comments,
            status: "returned",
          });
        }
      }
      await ctx.db.patch(args.sampleId, { status: "returned" });
    }

    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: args.sampleId,
      action: args.approved ? "qa_approved" : "qa_returned",
      oldValue: sample.status,
      newValue: args.approved ? "approved" : "returned",
      reason: args.comments,
      timestamp: now,
    });
  },
});

// ─── Mark COA Generated ──────────────────────────────────────────────────────

export const markCoaGenerated = mutation({
  args: { sampleId: v.id("samples") },
  handler: async (ctx, args): Promise<void> => {
    const me = await getCurrentUserOrThrow(ctx);
    const sample = await ctx.db.get(args.sampleId);
    if (!sample) throw new ConvexError({ message: "Not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.sampleId, { status: "coa_generated" });
    await ctx.db.insert("auditTrail", {
      userId: me._id,
      module: "samples",
      recordId: args.sampleId,
      action: "coa_generated",
      oldValue: sample.status,
      newValue: "coa_generated",
      timestamp: new Date().toISOString(),
    });
    await addCustodyEntry(ctx, args.sampleId, me._id, "coa_generated", {
      notes: "Certificate of Analysis generated and issued.",
    });
  },
});
