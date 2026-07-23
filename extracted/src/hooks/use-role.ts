/**
 * useRole — client-side RBAC hook.
 *
 * IMPORTANT: client-side role checks are for UX only.
 * All sensitive operations are also enforced server-side in Convex mutations.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export type LimsRole =
  | "system_admin"
  | "lab_manager"
  | "supervisor"
  | "analyst"
  | "qa_officer"
  | "reception"
  | "customer";

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

export const ALL_ROLES: LimsRole[] = [
  "system_admin",
  "lab_manager",
  "supervisor",
  "analyst",
  "qa_officer",
  "reception",
  "customer",
];

export function useRole() {
  const user = useQuery(api.users.getCurrentUser);

  const role = (user?.role ?? "analyst") as LimsRole;

  function hasRole(allowed: LimsRole[]): boolean {
    if (!user) return false;
    if (role === "system_admin") return true; // superuser bypass
    return allowed.includes(role);
  }

  return {
    user,
    role,
    isLoading: user === undefined,
    // Convenience booleans
    isAdmin:        role === "system_admin",
    isLabManager:   role === "lab_manager",
    isSupervisor:   role === "supervisor",
    isAnalyst:      role === "analyst",
    isQA:           role === "qa_officer",
    isReception:    role === "reception",
    isCustomer:     role === "customer",
    // Role-group helpers
    canManageUsers:       hasRole(["system_admin", "lab_manager"]),
    canManageSamples:     hasRole(["system_admin", "lab_manager", "supervisor", "reception"]),
    canDoTechnicalReview: hasRole(["system_admin", "lab_manager", "supervisor"]),
    canDoQAApproval:      hasRole(["system_admin", "lab_manager", "qa_officer"]),
    canManageBilling:     hasRole(["system_admin", "lab_manager", "reception"]),
    canViewAnalytics:     hasRole(["system_admin", "lab_manager", "supervisor"]),
    canViewAICopilot:     hasRole(["system_admin", "lab_manager", "supervisor"]),
    canViewAdmin:         hasRole(["system_admin", "lab_manager"]),
    hasRole,
  };
}
