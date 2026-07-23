import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getCurrentUserOrThrow } from "./users.ts";

export const listCourses = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    return await ctx.db.query("trainingCourses").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
  },
});

export const createCourse = mutation({
  args: {
    laboratoryId: v.id("laboratories"),
    title: v.string(),
    type: v.union(v.literal("sop"), v.literal("method"), v.literal("safety"), v.literal("instrument"), v.literal("regulatory"), v.literal("other")),
    description: v.optional(v.string()),
    linkedDocumentId: v.optional(v.id("documents")),
    linkedMethodId: v.optional(v.id("testMethods")),
    durationHours: v.optional(v.number()),
    validityMonths: v.optional(v.number()),
    assessmentRequired: v.boolean(),
    passingScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db.query("trainingCourses").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const courseCode = `TRN-${String(existing.length + 1).padStart(4, "0")}`;
    return await ctx.db.insert("trainingCourses", { ...args, courseCode, isActive: true, createdBy: user._id });
  },
});

export const listAssignments = query({
  args: { laboratoryId: v.id("laboratories"), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let assignments = await ctx.db.query("trainingAssignments").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    if (args.userId) assignments = assignments.filter((a) => a.userId === args.userId);
    return await Promise.all(assignments.map(async (a) => {
      const course = await ctx.db.get(a.courseId);
      const user = await ctx.db.get(a.userId);
      return { ...a, courseTitle: course?.title, courseCode: course?.courseCode, courseType: course?.type, userName: user?.name };
    }));
  },
});

export const getMyAssignments = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) return [];
    const assignments = await ctx.db.query("trainingAssignments").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return await Promise.all(assignments.map(async (a) => {
      const course = await ctx.db.get(a.courseId);
      return { ...a, courseTitle: course?.title, courseCode: course?.courseCode, courseType: course?.type };
    }));
  },
});

export const assignTraining = mutation({
  args: {
    courseId: v.id("trainingCourses"),
    userId: v.id("users"),
    laboratoryId: v.id("laboratories"),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new ConvexError({ message: "Course not found", code: "NOT_FOUND" });
    return await ctx.db.insert("trainingAssignments", {
      ...args,
      assignedBy: user._id,
      assignedDate: new Date().toISOString(),
      status: "assigned",
    });
  },
});

export const completeTraining = mutation({
  args: {
    assignmentId: v.id("trainingAssignments"),
    completedDate: v.string(),
    assessmentScore: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const a = await ctx.db.get(args.assignmentId);
    if (!a) throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    const course = await ctx.db.get(a.courseId);
    let expiryDate: string | undefined;
    if (course?.validityMonths) {
      const expiry = new Date(args.completedDate);
      expiry.setMonth(expiry.getMonth() + course.validityMonths);
      expiryDate = expiry.toISOString();
    }
    await ctx.db.patch(args.assignmentId, { status: "completed", completedDate: args.completedDate, assessmentScore: args.assessmentScore, expiryDate, notes: args.notes });
  },
});

export const deleteAssignment = mutation({
  args: { assignmentId: v.id("trainingAssignments") },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    await ctx.db.delete(args.assignmentId);
  },
});

export const getCompetencyMatrix = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const courses = await ctx.db.query("trainingCourses").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    const allAssignments = await ctx.db.query("trainingAssignments").withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId)).collect();
    return { users: users.map((u) => ({ id: u._id, name: u.name ?? u.email ?? "Unknown" })), courses, assignments: allAssignments };
  },
});
