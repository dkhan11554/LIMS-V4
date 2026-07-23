/**
 * Scheduling & Capacity Planning backend queries.
 * Aggregates sample tests, calibrations, and maintenance into a
 * unified timeline, plus analyst workload metrics.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSampleManager } from "./lib/roles.ts";
import type { Id } from "./_generated/dataModel";

// ─── Calendar events query ────────────────────────────────────────────────────
// Returns all "events" in a date window: sample deadlines, calibrations, maintenance.

export const getCalendarEvents = query({
  args: {
    laboratoryId: v.id("laboratories"),
    fromDate: v.string(), // ISO date string YYYY-MM-DD
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { laboratoryId, fromDate, toDate } = args;

    // ── Sample deadlines ──────────────────────────────────────
    const allSamples = await ctx.db
      .query("samples")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", laboratoryId))
      .collect();

    const sampleEvents = allSamples
      .filter((s) => {
        if (!s.requestedCompletionDate) return false;
        const d = s.requestedCompletionDate.slice(0, 10);
        return d >= fromDate && d <= toDate &&
          !["delivered", "coa_generated", "cancelled", "rejected", "disposed"].includes(s.status);
      })
      .map((s) => ({
        id: `sample-${s._id}`,
        type: "sample_deadline" as const,
        date: s.requestedCompletionDate!.slice(0, 10),
        title: s.limsNumber,
        subtitle: s.sampleName,
        status: s.status,
        priority: s.priority,
        refId: s._id as string,
        href: `/samples/${s._id}`,
      }));

    // ── Instrument calibrations ───────────────────────────────
    const allInstruments = await ctx.db
      .query("instruments")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", laboratoryId))
      .collect();

    const instIds = allInstruments.map((i) => i._id);

    // Calibration events
    const calEvents: Array<{
      id: string; type: "calibration"; date: string; title: string;
      subtitle: string; status: string; priority: "routine"; refId: string; href: string;
    }> = [];

    for (const instId of instIds) {
      const cals = await ctx.db
        .query("instrumentCalibrations")
        .withIndex("by_instrument", (q) => q.eq("instrumentId", instId))
        .collect();
      const inst = allInstruments.find((i) => i._id === instId);
      for (const cal of cals) {
        const d = cal.scheduledDate.slice(0, 10);
        if (d < fromDate || d > toDate) continue;
        calEvents.push({
          id: `cal-${cal._id}`,
          type: "calibration" as const,
          date: d,
          title: inst?.name ?? "Instrument",
          subtitle: `Calibration${cal.completedDate ? " ✓" : ""}`,
          status: cal.completedDate ? "completed" : "scheduled",
          priority: "routine" as const,
          refId: instId as string,
          href: `/instruments/${instId}`,
        });
      }
    }

    // Maintenance events
    const maintEvents: Array<{
      id: string; type: "maintenance"; date: string; title: string;
      subtitle: string; status: string; priority: "routine"; refId: string; href: string;
    }> = [];

    for (const instId of instIds) {
      const maints = await ctx.db
        .query("instrumentMaintenance")
        .withIndex("by_instrument", (q) => q.eq("instrumentId", instId))
        .collect();
      const inst = allInstruments.find((i) => i._id === instId);
      for (const m of maints) {
        const d = m.maintenanceDate.slice(0, 10);
        if (d < fromDate || d > toDate) continue;
        maintEvents.push({
          id: `maint-${m._id}`,
          type: "maintenance" as const,
          date: d,
          title: inst?.name ?? "Instrument",
          subtitle: `${m.maintenanceType} maintenance`,
          status: m.completedDate ? "completed" : "pending",
          priority: "routine" as const,
          refId: instId as string,
          href: `/instruments/${instId}`,
        });
      }
    }

    return [...sampleEvents, ...calEvents, ...maintEvents];
  },
});

// ─── Analyst workload query ───────────────────────────────────────────────────
// For each analyst: tests assigned, by-date breakdown, over-capacity flag.

export const getAnalystWorkload = query({
  args: {
    laboratoryId: v.id("laboratories"),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    // All analyst users
    const users = await ctx.db.query("users").collect();
    const analysts = users.filter((u) =>
      ["analyst", "supervisor", "lab_manager", "system_admin"].includes(u.role ?? "")
    );

    // All active sample tests in the lab
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    const sampleIds = new Set(samples.map((s) => s._id as string));

    // All sampleTests assigned to these analysts
    const allTests: Array<{
      _id: string;
      sampleId: string;
      assignedTo?: string;
      status: string;
      assignedAt?: string;
      completedAt?: string;
      testName: string;
      sampleLimsNumber: string;
      sampleDeadline?: string;
      samplePriority: string;
    }> = [];

    for (const analyst of analysts) {
      const sts = await ctx.db
        .query("sampleTests")
        .withIndex("by_assigned_to", (q) => q.eq("assignedTo", analyst._id))
        .collect();

      for (const st of sts) {
        if (!sampleIds.has(st.sampleId as string)) continue;
        const sample = samples.find((s) => s._id === st.sampleId);
        const test = await ctx.db.get(st.testId);
        allTests.push({
          _id: st._id as string,
          sampleId: st.sampleId as string,
          assignedTo: st.assignedTo as string | undefined,
          status: st.status,
          assignedAt: st.assignedAt,
          completedAt: st.completedAt,
          testName: test?.name ?? "Unknown test",
          sampleLimsNumber: sample?.limsNumber ?? "",
          sampleDeadline: sample?.requestedCompletionDate?.slice(0, 10),
          samplePriority: sample?.priority ?? "routine",
        });
      }
    }

    // Build per-analyst summaries
    const DAILY_CAPACITY = 8; // tests/day default capacity
    const workload = analysts.map((analyst) => {
      const myTests = allTests.filter((t) => t.assignedTo === (analyst._id as string));
      const pending = myTests.filter((t) =>
        ["assigned", "in_progress"].includes(t.status)
      );
      const completed = myTests.filter((t) =>
        ["result_entered", "submitted", "technically_approved", "qa_approved"].includes(t.status)
      );

      // Group pending by due date (sample deadline or "no deadline")
      const byDate: Record<string, number> = {};
      for (const t of pending) {
        const key = t.sampleDeadline ?? "no_deadline";
        byDate[key] = (byDate[key] ?? 0) + 1;
      }

      // Overload: pending count > DAILY_CAPACITY * days remaining this week
      const daysThisWeek = 5;
      const isOverloaded = pending.length > DAILY_CAPACITY * daysThisWeek;

      return {
        analystId: analyst._id as string,
        analystName: analyst.name ?? "Unknown",
        role: analyst.role ?? "analyst",
        totalAssigned: myTests.length,
        pendingCount: pending.length,
        completedCount: completed.length,
        isOverloaded,
        dailyCapacity: DAILY_CAPACITY,
        utilizationPct: Math.min(100, Math.round((pending.length / (DAILY_CAPACITY * daysThisWeek)) * 100)),
        byDate,
        pendingTests: pending.slice(0, 20), // cap at 20 for UI
      };
    });

    // Sort: overloaded first, then by utilization desc
    workload.sort((a, b) => {
      if (a.isOverloaded && !b.isOverloaded) return -1;
      if (!a.isOverloaded && b.isOverloaded) return 1;
      return b.utilizationPct - a.utilizationPct;
    });

    return workload;
  },
});

// ─── Reassign test mutation ───────────────────────────────────────────────────
// Used for drag-to-reassign on the workload board.

export const reassignTest = mutation({
  args: {
    sampleTestId: v.id("sampleTests"),
    newAnalystId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireSampleManager(ctx);
    const st = await ctx.db.get(args.sampleTestId);
    if (!st) throw new Error("Test not found");
    // Only allow reassigning active tests
    if (!["assigned", "in_progress", "not_assigned"].includes(st.status)) {
      throw new Error("Cannot reassign a test in its current status");
    }
    await ctx.db.patch(args.sampleTestId, {
      assignedTo: args.newAnalystId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    });
  },
});
