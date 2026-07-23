/**
 * RBAC helper functions for NextGen AI-LIMS.
 *
 * Role hierarchy (highest → lowest privilege):
 *   system_admin > lab_manager > supervisor > qa_officer > analyst > reception > customer
 *
 * These helpers are used server-side inside Convex queries/mutations.
 */

import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// ─── Role definitions ─────────────────────────────────────────────────────────

export const LIMS_ROLES = [
  "system_admin",
  "lab_manager",
  "supervisor",
  "analyst",
  "qa_officer",
  "reception",
  "customer",
] as const;

export type LimsRole = (typeof LIMS_ROLES)[number];

export const ROLE_LABELS: Record<LimsRole, string> = {
  system_admin: "System Administrator",
  lab_manager:  "Lab Manager",
  supervisor:   "Supervisor / Reviewer",
  analyst:      "Analyst",
  qa_officer:   "QA Officer",
  reception:    "Reception",
  customer:     "Customer Portal",
};

export const ROLE_COLORS: Record<LimsRole, string> = {
  system_admin: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  lab_manager:  "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  supervisor:   "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  analyst:      "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  qa_officer:   "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  reception:    "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  customer:     "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
};

// ─── Backend helpers ──────────────────────────────────────────────────────────

/**
 * Get the current authenticated user, throwing UNAUTHENTICATED if not signed in
 * and NOT_FOUND if no user row exists.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  }
  return user;
}

/**
 * Throw FORBIDDEN unless the current user has one of the allowed roles.
 * system_admin always passes.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: LimsRole[],
) {
  const user = await getCurrentUser(ctx);
  const role = (user.role ?? "analyst") as LimsRole;
  if (role === "system_admin") return user; // superuser bypass
  if (!allowedRoles.includes(role)) {
    throw new ConvexError({
      message: `Insufficient permissions. Required: ${allowedRoles.join(", ")}. Your role: ${role}`,
      code: "FORBIDDEN",
    });
  }
  return user;
}

/** Shorthand for admin-only operations. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin"]);
}

/** Require admin or lab_manager. */
export async function requireManager(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin", "lab_manager"]);
}

/** Require roles that can manage samples (register, assign, etc.). */
export async function requireSampleManager(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin", "lab_manager", "supervisor", "reception"]);
}

/** Require roles that can perform QA approval. */
export async function requireQA(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin", "lab_manager", "qa_officer"]);
}

/** Require roles that can perform technical review. */
export async function requireReviewer(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin", "lab_manager", "supervisor"]);
}

/** Require roles that can manage billing. */
export async function requireBilling(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ["system_admin", "lab_manager", "reception"]);
}
