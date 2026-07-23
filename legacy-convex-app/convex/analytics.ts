import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

function weekKey(ts: number): string {
  const d = new Date(ts);
  // ISO week: Monday-anchored
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  return monday.toISOString().split("T")[0];
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

// ─── Main analytics query ──────────────────────────────────────────────────────

export const getAnalytics = query({
  args: {
    laboratoryId: v.id("laboratories"),
    fromDate: v.string(),   // ISO date string "YYYY-MM-DD"
    toDate: v.string(),     // ISO date string "YYYY-MM-DD"
    customerId: v.optional(v.id("customers")),
  },
  handler: async (ctx, args): Promise<{
    // Throughput
    sampleVolumeByDay: { date: string; count: number; completed: number }[];
    sampleVolumeByWeek: { week: string; count: number; completed: number }[];
    // TAT
    tatDistribution: { bucket: string; count: number }[];
    avgTatByCategory: { category: string; avgTat: number; count: number }[];
    tatTrendByWeek: { week: string; avgTat: number; slaCompliance: number }[];
    // SLA
    slaComplianceRate: number;
    slaCompliant: number;
    slaBreach: number;
    slaMissing: number; // no requestedCompletionDate
    // Status summary
    statusBreakdown: { status: string; count: number }[];
    priorityBreakdown: { priority: string; count: number }[];
    // Analyst performance
    analystPerformance: {
      analystId: string;
      analystName: string;
      testsCompleted: number;
      testsOos: number;
      avgTurnaroundHours: number;
    }[];
    // Quality
    oosRate: number;          // % of sampleTests that went OOS
    oosCount: number;
    oosRootCauses: { category: string; count: number }[];
    oosByMonth: { month: string; count: number; rate: number }[];
    capasByStatus: { status: string; count: number }[];
    deviationsBySeverity: { severity: string; count: number }[];
    // Top customers
    topCustomers: { customerId: string; customerName: string; sampleCount: number; completedCount: number }[];
    // Revenue
    revenueByMonth: { month: string; invoiced: number; paid: number }[];
    // Totals
    totalSamples: number;
    totalCompleted: number;
    totalTests: number;
    totalRevenue: number;
  }> => {
    const fromMs = new Date(args.fromDate + "T00:00:00Z").getTime();
    const toMs   = new Date(args.toDate   + "T23:59:59Z").getTime();

    // ── Fetch samples in window ──────────────────────────────────────────
    let allSamples = await ctx.db
      .query("samples")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();

    // Filter by date range (creation time)
    allSamples = allSamples.filter(
      (s) => s._creationTime >= fromMs && s._creationTime <= toMs
    );

    // Filter by customer if provided
    if (args.customerId) {
      allSamples = allSamples.filter((s) => s.customerId === args.customerId);
    }

    const sampleIds = new Set(allSamples.map((s) => s._id));

    // ── Fetch sampleTests for these samples ──────────────────────────────
    const allSampleTests = await ctx.db
      .query("sampleTests")
      .withIndex("by_status")
      .collect();

    const filteredTests = allSampleTests.filter((t) => sampleIds.has(t.sampleId));

    // ── Throughput by day ────────────────────────────────────────────────
    const byDayMap: Record<string, { count: number; completed: number }> = {};
    for (const s of allSamples) {
      const key = dayKey(s._creationTime);
      if (!byDayMap[key]) byDayMap[key] = { count: 0, completed: 0 };
      byDayMap[key].count++;
      if (["approved", "coa_generated", "delivered"].includes(s.status)) byDayMap[key].completed++;
    }
    // Fill every day in range
    const dayCount = Math.ceil((toMs - fromMs) / 86400000) + 1;
    const sampleVolumeByDay = Array.from({ length: Math.min(dayCount, 90) }, (_, i) => {
      const d = new Date(fromMs + i * 86400000);
      const key = d.toISOString().split("T")[0];
      return { date: key, ...(byDayMap[key] ?? { count: 0, completed: 0 }) };
    });

    // ── Throughput by week ────────────────────────────────────────────────
    const byWeekMap: Record<string, { count: number; completed: number }> = {};
    for (const s of allSamples) {
      const key = weekKey(s._creationTime);
      if (!byWeekMap[key]) byWeekMap[key] = { count: 0, completed: 0 };
      byWeekMap[key].count++;
      if (["approved", "coa_generated", "delivered"].includes(s.status)) byWeekMap[key].completed++;
    }
    const sampleVolumeByWeek = Object.entries(byWeekMap)
      .map(([week, v]) => ({ week, ...v }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // ── TAT calculation ──────────────────────────────────────────────────
    // TAT = days from received/registration to completion (approved)
    const completedSamples = allSamples.filter((s) =>
      ["approved", "coa_generated", "delivered"].includes(s.status)
    );

    const tatValues: { tat: number; category: string }[] = [];
    for (const s of completedSamples) {
      const startDate = s.receivedDate
        ? new Date(s.receivedDate).getTime()
        : s._creationTime;
      const endDate = s._creationTime; // best proxy we have without completedAt on sample
      const tatDays = Math.max(0, (Date.now() - startDate) / 86400000);
      // Get test categories for this sample
      const tests = filteredTests.filter((t) => t.sampleId === s._id);
      if (tests.length === 0) {
        tatValues.push({ tat: tatDays, category: "Uncategorised" });
      } else {
        tatValues.push({ tat: tatDays, category: "General" });
      }
    }

    // TAT distribution buckets: 0-1, 1-2, 2-3, 3-5, 5-7, 7-14, 14+
    const TAT_BUCKETS = [
      { label: "0–1d",  min: 0,  max: 1  },
      { label: "1–2d",  min: 1,  max: 2  },
      { label: "2–3d",  min: 2,  max: 3  },
      { label: "3–5d",  min: 3,  max: 5  },
      { label: "5–7d",  min: 5,  max: 7  },
      { label: "7–14d", min: 7,  max: 14 },
      { label: "14+d",  min: 14, max: Infinity },
    ];
    const tatDistribution = TAT_BUCKETS.map((b) => ({
      bucket: b.label,
      count: tatValues.filter((t) => t.tat >= b.min && t.tat < b.max).length,
    }));

    // ── SLA Compliance ────────────────────────────────────────────────────
    const samplesWithDeadline = allSamples.filter((s) => !!s.requestedCompletionDate);
    const slaCompliant = samplesWithDeadline.filter((s) => {
      const done = ["approved", "coa_generated", "delivered"].includes(s.status);
      if (!done) return false;
      const deadline = new Date(s.requestedCompletionDate!).getTime();
      return s._creationTime <= deadline;
    }).length;
    const slaBreach = samplesWithDeadline.filter((s) => {
      const deadline = new Date(s.requestedCompletionDate!).getTime();
      return (
        !["approved", "coa_generated", "delivered", "cancelled"].includes(s.status) &&
        Date.now() > deadline
      ) || (
        ["approved", "coa_generated", "delivered"].includes(s.status) &&
        s._creationTime > deadline
      );
    }).length;
    const slaMissing = allSamples.length - samplesWithDeadline.length;
    const slaComplianceRate =
      samplesWithDeadline.length > 0
        ? Math.round((slaCompliant / samplesWithDeadline.length) * 100)
        : 100;

    // ── TAT trend by week + SLA compliance ───────────────────────────────
    const tatByWeekMap: Record<string, { total: number; count: number; compliant: number; withDl: number }> = {};
    for (const s of allSamples) {
      const wk = weekKey(s._creationTime);
      if (!tatByWeekMap[wk]) tatByWeekMap[wk] = { total: 0, count: 0, compliant: 0, withDl: 0 };
      if (s.receivedDate) {
        const tat = Math.max(0, (Date.now() - new Date(s.receivedDate).getTime()) / 86400000);
        tatByWeekMap[wk].total += tat;
        tatByWeekMap[wk].count++;
      }
      if (s.requestedCompletionDate) {
        tatByWeekMap[wk].withDl++;
        const completed = ["approved", "coa_generated", "delivered"].includes(s.status);
        const onTime = completed && s._creationTime <= new Date(s.requestedCompletionDate).getTime();
        if (onTime) tatByWeekMap[wk].compliant++;
      }
    }
    const tatTrendByWeek = Object.entries(tatByWeekMap)
      .map(([week, v]) => ({
        week,
        avgTat: v.count > 0 ? Math.round((v.total / v.count) * 10) / 10 : 0,
        slaCompliance: v.withDl > 0 ? Math.round((v.compliant / v.withDl) * 100) : 100,
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // ── Status & priority breakdown ───────────────────────────────────────
    const statusMap: Record<string, number> = {};
    const priorityMap: Record<string, number> = {};
    for (const s of allSamples) {
      statusMap[s.status] = (statusMap[s.status] ?? 0) + 1;
      priorityMap[s.priority] = (priorityMap[s.priority] ?? 0) + 1;
    }
    const statusBreakdown = Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
    const priorityBreakdown = Object.entries(priorityMap)
      .map(([priority, count]) => ({ priority, count }));

    // ── Analyst performance ───────────────────────────────────────────────
    const analystMap: Record<string, { name: string; done: number; oos: number; hours: number; count: number }> = {};
    for (const t of filteredTests) {
      if (!t.assignedTo) continue;
      const id = t.assignedTo as string;
      if (!analystMap[id]) {
        const user = await ctx.db.get(t.assignedTo);
        analystMap[id] = { name: user?.name ?? "Unknown", done: 0, oos: 0, hours: 0, count: 0 };
      }
      if (["technically_approved", "qa_approved"].includes(t.status)) analystMap[id].done++;
      if (t.status === "oos") analystMap[id].oos++;
      if (t.assignedAt && t.completedAt) {
        const h = (new Date(t.completedAt).getTime() - new Date(t.assignedAt).getTime()) / 3600000;
        analystMap[id].hours += h;
        analystMap[id].count++;
      }
    }
    const analystPerformance = Object.entries(analystMap)
      .map(([analystId, v]) => ({
        analystId,
        analystName: v.name,
        testsCompleted: v.done,
        testsOos: v.oos,
        avgTurnaroundHours: v.count > 0 ? Math.round((v.hours / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.testsCompleted - a.testsCompleted)
      .slice(0, 15);

    // ── OOS & Quality ─────────────────────────────────────────────────────
    const oosCount = filteredTests.filter((t) => t.status === "oos").length;
    const oosRate  = filteredTests.length > 0
      ? Math.round((oosCount / filteredTests.length) * 1000) / 10
      : 0;

    // OOS by month
    const oosMonthMap: Record<string, { oos: number; total: number }> = {};
    for (const t of filteredTests) {
      const s = allSamples.find((x) => x._id === t.sampleId);
      if (!s) continue;
      const mk = monthKey(dayKey(s._creationTime));
      if (!oosMonthMap[mk]) oosMonthMap[mk] = { oos: 0, total: 0 };
      oosMonthMap[mk].total++;
      if (t.status === "oos") oosMonthMap[mk].oos++;
    }
    const oosByMonth = Object.entries(oosMonthMap)
      .map(([month, v]) => ({
        month,
        count: v.oos,
        rate: v.total > 0 ? Math.round((v.oos / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // OOS root cause categories from OOS investigations
    const oosInvs = await ctx.db
      .query("oosInvestigations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const rcMap: Record<string, number> = {};
    for (const inv of oosInvs) {
      const rc = inv.rootCauseCategory ?? "Unclassified";
      rcMap[rc] = (rcMap[rc] ?? 0) + 1;
    }
    const oosRootCauses = Object.entries(rcMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // CAPA by status
    const capas = await ctx.db
      .query("capas")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const capaStatusMap: Record<string, number> = {};
    for (const c of capas) {
      capaStatusMap[c.status] = (capaStatusMap[c.status] ?? 0) + 1;
    }
    const capasByStatus = Object.entries(capaStatusMap)
      .map(([status, count]) => ({ status, count }));

    // Deviations by severity
    const devs = await ctx.db
      .query("deviations")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const devSevMap: Record<string, number> = {};
    for (const d of devs) {
      devSevMap[d.severity] = (devSevMap[d.severity] ?? 0) + 1;
    }
    const deviationsBySeverity = Object.entries(devSevMap)
      .map(([severity, count]) => ({ severity, count }));

    // ── Top customers ──────────────────────────────────────────────────────
    const custMap: Record<string, { count: number; completed: number }> = {};
    for (const s of allSamples) {
      const id = s.customerId as string;
      if (!custMap[id]) custMap[id] = { count: 0, completed: 0 };
      custMap[id].count++;
      if (["approved", "coa_generated", "delivered"].includes(s.status)) custMap[id].completed++;
    }
    const topCustomersRaw = Object.entries(custMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);
    const topCustomers = await Promise.all(
      topCustomersRaw.map(async ([customerId, v]) => {
        const cust = await ctx.db.get(customerId as Id<"customers">);
        return {
          customerId,
          customerName: cust?.name ?? "Unknown",
          sampleCount: v.count,
          completedCount: v.completed,
        };
      })
    );

    // ── Revenue by month ──────────────────────────────────────────────────
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const invMonthMap: Record<string, { invoiced: number; paid: number }> = {};
    for (const inv of invoices) {
      const mk = monthKey(inv.issueDate);
      if (!invMonthMap[mk]) invMonthMap[mk] = { invoiced: 0, paid: 0 };
      invMonthMap[mk].invoiced += inv.total;
      if (["paid", "partial"].includes(inv.status)) invMonthMap[mk].paid += inv.amountPaid ?? 0;
    }
    const revenueByMonth = Object.entries(invMonthMap)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);

    // ── avg TAT by test category ──────────────────────────────────────────
    // Enrich tests with their test category
    const testDefCache: Record<string, string> = {};
    const catTatMap: Record<string, { total: number; count: number }> = {};
    for (const t of filteredTests) {
      if (!testDefCache[t.testId as string]) {
        const def = await ctx.db.get(t.testId);
        testDefCache[t.testId as string] = def?.category ?? "Uncategorised";
      }
      const cat = testDefCache[t.testId as string];
      const sample = allSamples.find((s) => s._id === t.sampleId);
      if (sample?.receivedDate) {
        const tat = Math.max(0, (Date.now() - new Date(sample.receivedDate).getTime()) / 86400000);
        if (!catTatMap[cat]) catTatMap[cat] = { total: 0, count: 0 };
        catTatMap[cat].total += tat;
        catTatMap[cat].count++;
      }
    }
    const avgTatByCategory = Object.entries(catTatMap)
      .map(([category, v]) => ({
        category,
        avgTat: Math.round((v.total / v.count) * 10) / 10,
        count: v.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      sampleVolumeByDay,
      sampleVolumeByWeek,
      tatDistribution,
      avgTatByCategory,
      tatTrendByWeek,
      slaComplianceRate,
      slaCompliant,
      slaBreach,
      slaMissing,
      statusBreakdown,
      priorityBreakdown,
      analystPerformance,
      oosRate,
      oosCount,
      oosRootCauses,
      oosByMonth,
      capasByStatus,
      deviationsBySeverity,
      topCustomers,
      revenueByMonth,
      totalSamples: allSamples.length,
      totalCompleted: completedSamples.length,
      totalTests: filteredTests.length,
      totalRevenue,
    };
  },
});

// ─── List customers (for filter dropdown) ─────────────────────────────────────
export { } from "./customers.ts";
