import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";

// ─── Test Methods ─────────────────────────────────────────

export const listMethods = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const methods = await ctx.db
      .query("testMethods")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    // Enrich with department name
    const deptIds = [...new Set(methods.map((m) => m.departmentId).filter(Boolean))];
    const depts = await Promise.all(deptIds.map((id) => ctx.db.get(id!)));
    const deptMap = Object.fromEntries(depts.filter(Boolean).map((d) => [d!._id, d!.name]));
    return methods.map((m) => ({
      ...m,
      departmentName: m.departmentId ? deptMap[m.departmentId] : undefined,
    }));
  },
});

export const getMethod = query({
  args: { id: v.id("testMethods") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createMethod = mutation({
  args: {
    methodCode: v.string(),
    name: v.string(),
    version: v.string(),
    description: v.optional(v.string()),
    documentReference: v.optional(v.string()),
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    isAccredited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("testMethods", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateMethod = mutation({
  args: {
    id: v.id("testMethods"),
    name: v.optional(v.string()),
    version: v.optional(v.string()),
    description: v.optional(v.string()),
    documentReference: v.optional(v.string()),
    isAccredited: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// ─── Tests ────────────────────────────────────────────────

export const listTests = query({
  args: {
    laboratoryId: v.id("laboratories"),
    departmentId: v.optional(v.id("departments")),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tests;
    if (args.departmentId) {
      tests = await ctx.db
        .query("tests")
        .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
        .collect();
    } else {
      tests = await ctx.db
        .query("tests")
        .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
        .collect();
    }
    if (args.category) {
      tests = tests.filter((t) => t.category === args.category);
    }
    // Enrich with department and method names
    const deptIds = [...new Set(tests.map((t) => t.departmentId).filter(Boolean))];
    const methodIds = [...new Set(tests.map((t) => t.methodId).filter(Boolean))];
    const [depts, methods] = await Promise.all([
      Promise.all(deptIds.map((id) => ctx.db.get(id!))),
      Promise.all(methodIds.map((id) => ctx.db.get(id!))),
    ]);
    const deptMap = Object.fromEntries(depts.filter(Boolean).map((d) => [d!._id, d!.name]));
    const methodMap = Object.fromEntries(methods.filter(Boolean).map((m) => [m!._id, m!.name]));
    return tests.map((t) => ({
      ...t,
      departmentName: t.departmentId ? deptMap[t.departmentId] : undefined,
      methodName: t.methodId ? methodMap[t.methodId] : undefined,
    }));
  },
});

export const getTest = query({
  args: { id: v.id("tests") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.id);
    if (!test) return null;
    const [method, department] = await Promise.all([
      test.methodId ? ctx.db.get(test.methodId) : null,
      test.departmentId ? ctx.db.get(test.departmentId) : null,
    ]);
    return { ...test, method, department };
  },
});

export const listCategories = query({
  args: { laboratoryId: v.id("laboratories") },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_laboratory", (q) => q.eq("laboratoryId", args.laboratoryId))
      .collect();
    const cats = [...new Set(tests.map((t) => t.category).filter(Boolean))] as string[];
    return cats.sort();
  },
});

export const createTest = mutation({
  args: {
    testCode: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    methodId: v.optional(v.id("testMethods")),
    departmentId: v.optional(v.id("departments")),
    laboratoryId: v.id("laboratories"),
    unit: v.optional(v.string()),
    resultType: v.union(
      v.literal("numeric"),
      v.literal("text"),
      v.literal("pass_fail"),
      v.literal("pos_neg"),
      v.literal("selection"),
    ),
    decimalPlaces: v.optional(v.number()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    detectionLimit: v.optional(v.number()),
    standardTAT: v.optional(v.number()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("tests", {
      ...args,
      isActive: true,
      createdBy: me._id,
    });
  },
});

export const updateTest = mutation({
  args: {
    id: v.id("tests"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    detectionLimit: v.optional(v.number()),
    standardTAT: v.optional(v.number()),
    price: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    decimalPlaces: v.optional(v.number()),
    methodId: v.optional(v.id("testMethods")),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
