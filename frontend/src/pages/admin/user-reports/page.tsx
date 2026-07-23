import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { RoleBadge } from "@/components/ui/role-badge.tsx";
import { ALL_ROLES, ROLE_LABELS, type LimsRole } from "@/hooks/use-role.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow, format } from "date-fns";
import Papa from "papaparse";
import {
  FileBarChart2, Download, Building2, Users, UserCog,
  ShieldCheck, History, MapPin, Network, BarChart3,
  Table2, Layers, UserX, UserCheck, Archive,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type User = {
  _id: Id<"users">;
  name?: string; firstName?: string; lastName?: string;
  email?: string; role?: string; employeeNumber?: string;
  jobTitle?: string; designation?: string; businessUnit?: string;
  siteLocation?: string; costCenter?: string; employmentType?: string;
  timezone?: string; language?: string; phone?: string;
  departmentId?: string; laboratoriesAccess?: string[];
  managerId?: string; supervisorId?: string;
  isActive?: boolean; isDisabled?: boolean; isArchived?: boolean;
  accountStatus?: string; lastLoginAt?: string;
  _creationTime: number;
  managerName?: string; supervisorName?: string; departmentName?: string;
};

type Lab = { _id: Id<"laboratories">; name: string; code: string };
type Department = { _id: Id<"departments">; name: string; code: string; laboratoryId: Id<"laboratories"> };

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time",
  contract: "Contract", intern: "Intern", temporary: "Temporary",
};

// ─── CSV helpers ───────────────────────────────────────────────────────────────

function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function userToCsvRow(u: User, labs: Lab[]) {
  const assignedLabs = (u.laboratoriesAccess ?? [])
    .map((lid) => labs.find((l) => l._id === lid)?.name ?? lid).join("; ");
  return {
    "Employee #": u.employeeNumber ?? "",
    "Full Name": u.name ?? "",
    "First Name": u.firstName ?? "",
    "Last Name": u.lastName ?? "",
    "Email": u.email ?? "",
    "Role": ROLE_LABELS[u.role as LimsRole] ?? u.role ?? "",
    "Job Title": u.jobTitle ?? "",
    "Designation": u.designation ?? "",
    "Department": u.departmentName ?? "",
    "Business Unit": u.businessUnit ?? "",
    "Site/Location": u.siteLocation ?? "",
    "Cost Center": u.costCenter ?? "",
    "Employment Type": EMPLOYMENT_TYPE_LABELS[u.employmentType ?? ""] ?? u.employmentType ?? "",
    "Phone": u.phone ?? "",
    "Manager": u.managerName ?? "",
    "Supervisor": u.supervisorName ?? "",
    "Timezone": u.timezone ?? "",
    "Language": u.language ?? "",
    "Labs Access": assignedLabs,
    "Status": u.isArchived ? "Archived" : u.isDisabled ? "Suspended" : u.isActive !== false ? "Active" : "Inactive",
    "Last Login": u.lastLoginAt ? format(new Date(u.lastLoginAt), "yyyy-MM-dd HH:mm") : "",
    "Account Created": u._creationTime ? format(new Date(u._creationTime), "yyyy-MM-dd") : "",
  };
}

// ─── Lab Assignment Modal ──────────────────────────────────────────────────────

function LabAssignmentModal({
  user, labs, departments, open, onClose,
}: {
  user: User | null;
  labs: Lab[];
  departments: Department[];
  open: boolean;
  onClose: () => void;
}) {
  const setLabAccess = useMutation(api.users.setUserLabAccess);
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(() =>
    new Set(user?.laboratoriesAccess ?? [])
  );
  const [departmentId, setDepartmentId] = useState<string>(user?.departmentId ?? "");
  const [saving, setSaving] = useState(false);

  // Sync when user changes
  if (user && !open) {
    // reset on close
  }

  function toggleLab(labId: string) {
    setSelectedLabs((prev) => {
      const next = new Set(prev);
      if (next.has(labId)) next.delete(labId); else next.add(labId);
      return next;
    });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await setLabAccess({
        id: user._id,
        laboratoriesAccess: [...selectedLabs] as Id<"laboratories">[],
        departmentId: departmentId ? (departmentId as Id<"departments">) : undefined,
      });
      toast.success(`Lab access updated for ${user.name}`);
      onClose();
    } catch {
      toast.error("Failed to update lab access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={17} />Lab &amp; Department Assignment
          </DialogTitle>
        </DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border rounded-xl p-3 bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                {(user.name ?? user.email ?? "U").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="ml-auto"><RoleBadge role={user.role} /></div>
            </div>

            {/* Lab selection */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Laboratory Access</p>
              <p className="text-xs text-muted-foreground">Select all labs this user can access. Their primary lab is set separately.</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
                {labs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">No labs configured yet</p>
                )}
                {labs.map((lab) => (
                  <label key={lab._id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox
                      checked={selectedLabs.has(lab._id)}
                      onCheckedChange={() => toggleLab(lab._id)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm font-medium">{lab.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{lab.code}</span>
                  </label>
                ))}
              </div>
              {selectedLabs.size > 0 && (
                <p className="text-xs text-green-700 dark:text-green-400">{selectedLabs.size} lab(s) selected</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Primary Department</p>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department assigned</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name} <span className="text-muted-foreground text-xs">({d.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner className="w-4 h-4 mr-1.5" />Saving…</> : "Save Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report card ───────────────────────────────────────────────────────────────

type ReportCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  count?: number;
  onExport: () => void;
  onClick?: () => void;
  active?: boolean;
};

function ReportCard({ title, description, icon, count, onExport, onClick, active }: ReportCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        active && "border-primary ring-1 ring-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary">{icon}</span>
          </div>
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            title="Export to CSV"
          >
            <Download size={12} className="mr-1" />CSV
          </Button>
        </div>
        <div className="mt-2.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {count !== undefined && (
            <p className="text-2xl font-bold mt-2">{count}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Report views ──────────────────────────────────────────────────────────────

function UserTable({ users, labs, onAssign }: { users: User[]; labs: Lab[]; onAssign: (u: User) => void }) {
  if (users.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No users in this report</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-3 py-2.5 font-semibold">Name</th>
            <th className="text-left px-3 py-2.5 font-semibold">Role</th>
            <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Department</th>
            <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Labs Access</th>
            <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Status</th>
            <th className="text-left px-3 py-2.5 font-semibold hidden xl:table-cell">Last Login</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const assignedLabs = (u.laboratoriesAccess ?? []).map((lid) => labs.find((l) => l._id === lid)?.name ?? lid);
            const isActive = !u.isArchived && !u.isDisabled && u.isActive !== false;
            return (
              <tr key={u._id} className={cn("border-b last:border-0", i % 2 !== 0 && "bg-muted/5", u.isArchived && "opacity-60")}>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{u.name ?? u.email ?? "—"}</div>
                  {u.jobTitle && <div className="text-xs text-muted-foreground">{u.jobTitle}</div>}
                </td>
                <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">{u.departmentName ?? "—"}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  {assignedLabs.length > 0
                    ? <div className="flex flex-wrap gap-1">{assignedLabs.slice(0, 3).map((l) => <Badge key={l} variant="outline" className="text-[10px] h-4">{l}</Badge>)}{assignedLabs.length > 3 && <Badge variant="outline" className="text-[10px] h-4">+{assignedLabs.length - 3}</Badge>}</div>
                    : <span className="text-xs text-muted-foreground">None assigned</span>
                  }
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    u.isArchived ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                      isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}>
                    {u.isArchived ? "Archived" : isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                  {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : "Never"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="ghost" size="sm" className="h-7 text-xs cursor-pointer" onClick={() => onAssign(u)}>
                    <Building2 size={12} className="mr-1" />Assign
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ByDeptReport({ users }: { users: User[] }) {
  const depts = [...new Set(users.map((u) => u.departmentName ?? "No Department"))].sort();
  return (
    <div className="space-y-3">
      {depts.map((dept) => {
        const deptUsers = users.filter((u) => (u.departmentName ?? "No Department") === dept);
        return (
          <div key={dept}>
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin size={13} className="text-primary" />
              <span className="text-sm font-semibold">{dept}</span>
              <Badge variant="outline" className="text-xs">{deptUsers.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-5">
              {deptUsers.map((u) => (
                <span key={u._id} className="text-xs border rounded px-2 py-0.5 bg-muted/30">
                  {u.name ?? u.email}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByLabReport({ users, labs }: { users: User[]; labs: Lab[] }) {
  return (
    <div className="space-y-3">
      {labs.map((lab) => {
        const labUsers = users.filter((u) => (u.laboratoriesAccess ?? []).includes(lab._id));
        return (
          <div key={lab._id}>
            <div className="flex items-center gap-2 mb-1.5">
              <Building2 size={13} className="text-primary" />
              <span className="text-sm font-semibold">{lab.name}</span>
              <span className="text-xs text-muted-foreground">({lab.code})</span>
              <Badge variant="outline" className="text-xs">{labUsers.length} users</Badge>
            </div>
            {labUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-5">No users assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-5">
                {labUsers.map((u) => (
                  <span key={u._id} className="text-xs border rounded px-2 py-0.5 bg-muted/30 flex items-center gap-1">
                    {u.name ?? u.email}
                    <span className={cn("w-1.5 h-1.5 rounded-full", u.isActive !== false && !u.isArchived && !u.isDisabled ? "bg-green-500" : "bg-red-400")} />
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Building2 size={13} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground">No Lab Assigned</span>
          <Badge variant="outline" className="text-xs">{users.filter((u) => !u.laboratoriesAccess?.length).length}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-5">
          {users.filter((u) => !u.laboratoriesAccess?.length).map((u) => (
            <span key={u._id} className="text-xs border rounded px-2 py-0.5 bg-muted/30">{u.name ?? u.email}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleMatrixReport({ users }: { users: User[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-3 py-2.5 font-semibold">Role</th>
            <th className="text-right px-3 py-2.5 font-semibold">Total</th>
            <th className="text-right px-3 py-2.5 font-semibold">Active</th>
            <th className="text-right px-3 py-2.5 font-semibold">Suspended</th>
            <th className="text-right px-3 py-2.5 font-semibold">Archived</th>
            <th className="text-right px-3 py-2.5 font-semibold hidden md:table-cell">Avg. Days Since Login</th>
          </tr>
        </thead>
        <tbody>
          {ALL_ROLES.map((role, i) => {
            const roleUsers = users.filter((u) => u.role === role);
            const active = roleUsers.filter((u) => !u.isArchived && !u.isDisabled && u.isActive !== false).length;
            const suspended = roleUsers.filter((u) => u.isDisabled && !u.isArchived).length;
            const archived = roleUsers.filter((u) => u.isArchived).length;
            const loggedIn = roleUsers.filter((u) => u.lastLoginAt);
            const avgDays = loggedIn.length > 0
              ? Math.round(loggedIn.reduce((s, u) => s + (Date.now() - new Date(u.lastLoginAt!).getTime()), 0) / loggedIn.length / 86400000)
              : null;
            return (
              <tr key={role} className={cn("border-b last:border-0", i % 2 !== 0 && "bg-muted/5")}>
                <td className="px-3 py-2.5"><RoleBadge role={role} /></td>
                <td className="px-3 py-2.5 text-right font-bold">{roleUsers.length}</td>
                <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-400">{active}</td>
                <td className="px-3 py-2.5 text-right text-yellow-700 dark:text-yellow-400">{suspended}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{archived}</td>
                <td className="px-3 py-2.5 text-right hidden md:table-cell text-muted-foreground">
                  {avgDays !== null ? `${avgDays}d` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoginHistoryReport({ users }: { users: User[] }) {
  const sorted = [...users].sort((a, b) => {
    if (!a.lastLoginAt) return 1;
    if (!b.lastLoginAt) return -1;
    return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
  });
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-3 py-2.5 font-semibold">Name</th>
            <th className="text-left px-3 py-2.5 font-semibold">Role</th>
            <th className="text-left px-3 py-2.5 font-semibold">Last Login</th>
            <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Login Age</th>
            <th className="text-left px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((u, i) => {
            const daysAgo = u.lastLoginAt ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / 86400000) : null;
            const stale = daysAgo !== null && daysAgo > 30;
            return (
              <tr key={u._id} className={cn("border-b last:border-0", i % 2 !== 0 && "bg-muted/5")}>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{u.name ?? u.email ?? "—"}</div>
                  {u.jobTitle && <div className="text-xs text-muted-foreground">{u.jobTitle}</div>}
                </td>
                <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-2.5 text-xs">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), "yyyy-MM-dd HH:mm") : <span className="text-muted-foreground">Never logged in</span>}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  {daysAgo !== null ? (
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                      stale ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    )}>
                      {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    u.isArchived ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                      (u.isDisabled || u.isActive === false) ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  )}>
                    {u.isArchived ? "Archived" : (u.isDisabled || u.isActive === false) ? "Suspended" : "Active"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type ReportKey = "active" | "inactive" | "archived" | "by_dept" | "by_lab" | "role_matrix" | "login_history" | "all";

export default function UserReportsPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager"]}>
      <UserReportsPageInner />
    </PageGuard>
  );
}

function UserReportsPageInner() {
  const allUsers = useQuery(api.users.listAllUsers, {}) as User[] | undefined;
  const labs = useQuery(api.organization.listLaboratories, {}) as Lab[] | undefined ?? [];
  const { labId } = useActiveLab();
  const departments = useQuery(
    api.organization.listDepartments,
    labId ? { laboratoryId: labId } : "skip"
  ) as Department[] | undefined ?? [];

  const [activeReport, setActiveReport] = useState<ReportKey>("active");
  const [assignUser, setAssignUser] = useState<User | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  function openAssign(u: User) {
    setAssignUser(u);
    setAssignOpen(true);
  }

  // ── Subsets ─────────────────────────────────────────────────────────────────

  const active = (allUsers ?? []).filter((u) => !u.isArchived && !u.isDisabled && u.isActive !== false);
  const inactive = (allUsers ?? []).filter((u) => !u.isArchived && (u.isDisabled || u.isActive === false));
  const archived = (allUsers ?? []).filter((u) => u.isArchived);
  const all = allUsers ?? [];

  function getReportUsers(): User[] {
    switch (activeReport) {
      case "active": return active;
      case "inactive": return inactive;
      case "archived": return archived;
      case "by_dept": return all.filter((u) => !u.isArchived);
      case "by_lab": return all.filter((u) => !u.isArchived);
      case "role_matrix": return all;
      case "login_history": return all.filter((u) => !u.isArchived);
      case "all": return all;
    }
  }

  function exportReport(report: ReportKey) {
    const users = (() => {
      switch (report) {
        case "active": return active;
        case "inactive": return inactive;
        case "archived": return archived;
        case "by_dept": return all.filter((u) => !u.isArchived);
        case "by_lab": return all.filter((u) => !u.isArchived);
        case "role_matrix": return all;
        case "login_history": return all.filter((u) => !u.isArchived);
        case "all": return all;
      }
    })();

    if (report === "role_matrix") {
      const data = ALL_ROLES.map((role) => {
        const ru = users.filter((u) => u.role === role);
        const act = ru.filter((u) => !u.isArchived && !u.isDisabled && u.isActive !== false).length;
        const susp = ru.filter((u) => u.isDisabled && !u.isArchived).length;
        const arch = ru.filter((u) => u.isArchived).length;
        const loggedIn = ru.filter((u) => u.lastLoginAt);
        const avgDays = loggedIn.length > 0
          ? Math.round(loggedIn.reduce((s, u) => s + (Date.now() - new Date(u.lastLoginAt!).getTime()), 0) / loggedIn.length / 86400000)
          : "";
        return { Role: ROLE_LABELS[role], Total: ru.length, Active: act, Suspended: susp, Archived: arch, "Avg Days Since Login": avgDays };
      });
      downloadCsv(Papa.unparse(data), `role-matrix-${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast.success("Exported role matrix");
      return;
    }

    const csv = Papa.unparse(users.map((u) => userToCsvRow(u, labs)), { quotes: true });
    downloadCsv(csv, `users-${report}-${format(new Date(), "yyyy-MM-dd")}.csv`);
    toast.success(`Exported ${users.length} users`);
  }

  const REPORTS: { key: ReportKey; title: string; description: string; icon: React.ReactNode; count?: number }[] = [
    { key: "active",        title: "Active Users",       description: "Currently active accounts",     icon: <UserCheck size={16} />,  count: active.length },
    { key: "inactive",      title: "Inactive / Suspended", description: "Disabled or suspended accounts", icon: <UserX size={16} />,  count: inactive.length },
    { key: "archived",      title: "Archived Users",     description: "Soft-deleted, retain all data", icon: <Archive size={16} />,    count: archived.length },
    { key: "all",           title: "All Users",          description: "Complete user register",        icon: <Users size={16} />,      count: all.length },
    { key: "by_dept",       title: "Users by Dept",      description: "Group users by department",     icon: <MapPin size={16} /> },
    { key: "by_lab",        title: "Users by Lab",       description: "Lab assignments overview",      icon: <Building2 size={16} /> },
    { key: "role_matrix",   title: "Role Summary",       description: "Counts and stats per role",     icon: <BarChart3 size={16} /> },
    { key: "login_history", title: "Login History",      description: "Last login & activity report",  icon: <History size={16} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileBarChart2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Reports</h1>
            <p className="text-sm text-muted-foreground">Multi-lab assignment · User analytics · Exportable reports</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => exportReport(activeReport)}>
          <Download size={13} className="mr-1.5" />Export Current Report
        </Button>
      </div>

      {/* Summary stats */}
      {!allUsers ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: all.length, color: "text-primary" },
            { label: "Active", value: active.length, color: "text-green-600 dark:text-green-400" },
            { label: "Suspended", value: inactive.length, color: "text-yellow-600 dark:text-yellow-400" },
            { label: "Archived", value: archived.length, color: "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-3xl font-bold mt-1", s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REPORTS.map((r) => (
          <ReportCard
            key={r.key}
            title={r.title}
            description={r.description}
            icon={r.icon}
            count={r.count}
            active={activeReport === r.key}
            onClick={() => setActiveReport(r.key)}
            onExport={() => exportReport(r.key)}
          />
        ))}
      </div>

      {/* Report content */}
      {!allUsers ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {REPORTS.find((r) => r.key === activeReport)?.icon}
                {REPORTS.find((r) => r.key === activeReport)?.title}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => exportReport(activeReport)}>
                <Download size={13} className="mr-1.5" />Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(activeReport === "active" || activeReport === "inactive" || activeReport === "archived" || activeReport === "all") && (
              <UserTable users={getReportUsers()} labs={labs} onAssign={openAssign} />
            )}
            {activeReport === "by_dept" && (
              <ByDeptReport users={getReportUsers()} />
            )}
            {activeReport === "by_lab" && (
              <ByLabReport users={getReportUsers()} labs={labs} />
            )}
            {activeReport === "role_matrix" && (
              <RoleMatrixReport users={getReportUsers()} />
            )}
            {activeReport === "login_history" && (
              <LoginHistoryReport users={getReportUsers()} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Lab assignment modal */}
      <LabAssignmentModal
        user={assignUser}
        labs={labs}
        departments={departments}
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setAssignUser(null); }}
      />
    </div>
  );
}
