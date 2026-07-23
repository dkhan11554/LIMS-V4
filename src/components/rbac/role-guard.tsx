/**
 * RoleGuard — wraps page sections or actions that require specific roles.
 *
 * Usage:
 *   <RoleGuard allowed={["system_admin", "lab_manager"]}>
 *     <DeleteButton />
 *   </RoleGuard>
 *
 *   <RoleGuard allowed={["system_admin"]} fallback={<p>No access</p>}>
 *     <AdminPanel />
 *   </RoleGuard>
 */

import { useRole, type LimsRole } from "@/hooks/use-role.ts";

interface RoleGuardProps {
  allowed: LimsRole[];
  children: React.ReactNode;
  /** Optional element to render when access is denied. Defaults to null. */
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowed, children, fallback = null }: RoleGuardProps) {
  const { hasRole, isLoading } = useRole();
  if (isLoading) return null;
  if (!hasRole(allowed)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * PageGuard — shows a full-page "Access Denied" message for protected pages.
 */
export function PageGuard({ allowed, children }: { allowed: LimsRole[]; children: React.ReactNode }) {
  const { hasRole, isLoading } = useRole();

  if (isLoading) return null;

  if (!hasRole(allowed)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-lg">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
