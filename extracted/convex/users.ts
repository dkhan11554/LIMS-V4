import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireManager } from "./lib/roles.ts";

// ─── Auth sync (called from /auth/callback) ───────────────────────────────────

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    const lastLoginAt = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: identity.name,
        email: identity.email,
        lastLoginAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      role: "system_admin",
      isActive: true,
      accountStatus: "active",
      lastLoginAt,
    });
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

export const listUsers = query({
  args: { laboratoryId: v.optional(v.id("laboratories")) },
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    // Exclude archived users from default listing
    const active = all.filter((u) => !u.isArchived);
    // Resolve manager and supervisor names
    return await Promise.all(active.map(async (u) => {
      const manager = u.managerId ? await ctx.db.get(u.managerId) : null;
      const supervisor = u.supervisorId ? await ctx.db.get(u.supervisorId) : null;
      const department = u.departmentId ? await ctx.db.get(u.departmentId) : null;
      return {
        ...u,
        managerName: manager?.name,
        supervisorName: supervisor?.name,
        departmentName: department?.name,
      };
    }));
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.id);
    if (!u) return null;
    const manager = u.managerId ? await ctx.db.get(u.managerId) : null;
    const supervisor = u.supervisorId ? await ctx.db.get(u.supervisorId) : null;
    const department = u.departmentId ? await ctx.db.get(u.departmentId) : null;
    return { ...u, managerName: manager?.name, supervisorName: supervisor?.name, departmentName: department?.name };
  },
});

// ─── Create user ──────────────────────────────────────────────────────────────

export const createUser = mutation({
  args: {
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    role: v.string(),
    employeeNumber: v.optional(v.string()),
    phone: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    jobTitle: v.optional(v.string()),
    designation: v.optional(v.string()),
    businessUnit: v.optional(v.string()),
    siteLocation: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    supervisorId: v.optional(v.id("users")),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireManager(ctx);
    return await ctx.db.insert("users", {
      tokenIdentifier: `pending:${args.email}`,
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      role: args.role,
      employeeNumber: args.employeeNumber,
      phone: args.phone,
      departmentId: args.departmentId,
      jobTitle: args.jobTitle,
      designation: args.designation,
      businessUnit: args.businessUnit,
      siteLocation: args.siteLocation,
      costCenter: args.costCenter,
      employmentType: args.employmentType,
      managerId: args.managerId,
      supervisorId: args.supervisorId,
      timezone: args.timezone,
      language: args.language,
      isActive: true,
      accountStatus: "active",
      createdBy: (me as { _id: Id<"users"> })._id,
    });
  },
});

// ─── Update user (admin) ──────────────────────────────────────────────────────

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    employeeNumber: v.optional(v.string()),
    phone: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    isActive: v.optional(v.boolean()),
    isDisabled: v.optional(v.boolean()),
    accountStatus: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    designation: v.optional(v.string()),
    businessUnit: v.optional(v.string()),
    siteLocation: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    supervisorId: v.optional(v.id("users")),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    digitalSignatureUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireManager(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedBy: (me as { _id: Id<"users"> })._id });
  },
});

// ─── Soft delete / archive ────────────────────────────────────────────────────

export const archiveUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      isArchived: true,
      isActive: false,
      isDisabled: true,
      accountStatus: "inactive",
    });
  },
});

// Keep hard delete but guard it tightly
export const deleteUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ─── Enable / Disable account ─────────────────────────────────────────────────

export const setUserEnabled = mutation({
  args: { id: v.id("users"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    await ctx.db.patch(args.id, {
      isDisabled: !args.enabled,
      isActive: args.enabled,
      accountStatus: args.enabled ? "active" : "inactive",
    });
  },
});

// ─── Multi-lab assignment ─────────────────────────────────────────────────────

export const setUserLabAccess = mutation({
  args: {
    id: v.id("users"),
    laboratoriesAccess: v.array(v.id("laboratories")),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const me = await requireManager(ctx);
    await ctx.db.patch(args.id, {
      laboratoriesAccess: args.laboratoriesAccess,
      departmentId: args.departmentId,
      updatedBy: (me as { _id: Id<"users"> })._id,
    });
  },
});

// ─── List ALL users (including archived) — for reports only ───────────────────

export const listAllUsers = query({
  args: {},
  handler: async (ctx): Promise<{
    _id: Id<"users">;
    name?: string; firstName?: string; lastName?: string;
    email?: string; role?: string; employeeNumber?: string;
    jobTitle?: string; designation?: string; businessUnit?: string;
    siteLocation?: string; costCenter?: string; employmentType?: string;
    timezone?: string; language?: string; phone?: string; bio?: string;
    departmentId?: Id<"departments">; laboratoriesAccess?: Id<"laboratories">[];
    managerId?: Id<"users">; supervisorId?: Id<"users">;
    isActive?: boolean; isDisabled?: boolean; isArchived?: boolean;
    accountStatus?: string; lastLoginAt?: string;
    _creationTime: number;
    managerName?: string; supervisorName?: string; departmentName?: string;
  }[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const all = await ctx.db.query("users").collect();
    return await Promise.all(all.map(async (u) => {
      const manager = u.managerId ? await ctx.db.get(u.managerId) : null;
      const supervisor = u.supervisorId ? await ctx.db.get(u.supervisorId) : null;
      const department = u.departmentId ? await ctx.db.get(u.departmentId) : null;
      return {
        ...u,
        managerName: manager?.name,
        supervisorName: supervisor?.name,
        departmentName: department?.name,
      };
    }));
  },
});

// ─── Self-service profile update ──────────────────────────────────────────────

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    digitalSignatureUrl: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    designation: v.optional(v.string()),
    businessUnit: v.optional(v.string()),
    siteLocation: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    await ctx.db.patch(user._id, { ...args });
  },
});

/** Generate a one-time upload URL for profile files (avatar / signature) */
export const generateProfileUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.storage.generateUploadUrl();
  },
});

/** Save a just-uploaded file storage ID to the current user's profile */
export const saveProfileFile = mutation({
  args: {
    field: v.union(v.literal("avatarUrl"), v.literal("digitalSignatureUrl")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Delete old stored file if it was a storage reference (not an external URL)
    const oldUrl = user[args.field] as string | undefined;
    if (oldUrl && oldUrl.startsWith("https://") && !oldUrl.includes("://")) {
      // external URL — nothing to delete
    }

    const url = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(user._id, { [args.field]: url });
    return url;
  },
});

/** Admin — update any user's avatar URL */
export const updateUserAvatar = mutation({
  args: { id: v.id("users"), avatarUrl: v.string() },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    await ctx.db.patch(args.id, { avatarUrl: args.avatarUrl });
  },
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

export async function getCurrentUserOrThrow(
  ctx: QueryCtx | MutationCtx,
): Promise<{
  _id: Id<"users">;
  role?: string;
  name?: string;
  email?: string;
  tokenIdentifier: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isArchived?: boolean;
  employeeNumber?: string;
  phone?: string;
  departmentId?: Id<"departments">;
  laboratoriesAccess?: Id<"laboratories">[];
  qualifications?: string[];
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  return user;
}

export { requireRole, requireAdmin, requireManager, requireQA, requireReviewer, requireBilling } from "./lib/roles.ts";
