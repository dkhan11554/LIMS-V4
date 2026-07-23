import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { RoleBadge } from "@/components/ui/role-badge.tsx";
import { ALL_ROLES, ROLE_LABELS, ROLE_COLORS, type LimsRole } from "@/hooks/use-role.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { ShieldCheck, Save, RotateCcw, Table2, Settings2, Info } from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

type Action = "view" | "create" | "edit" | "delete" | "approve" | "reject" | "export" | "import" | "print";

const ACTIONS: { key: Action; label: string; short: string }[] = [
  { key: "view",    label: "View",    short: "View" },
  { key: "create",  label: "Create",  short: "Add" },
  { key: "edit",    label: "Edit",    short: "Edit" },
  { key: "delete",  label: "Delete",  short: "Del" },
  { key: "approve", label: "Approve", short: "Appr" },
  { key: "reject",  label: "Reject",  short: "Rej" },
  { key: "export",  label: "Export",  short: "Exp" },
  { key: "import",  label: "Import",  short: "Imp" },
  { key: "print",   label: "Print",   short: "Prt" },
];

const MODULES: { key: string; label: string; group: string }[] = [
  // Core lab workflow
  { key: "sample_registration",  label: "Sample Registration",  group: "Core Workflow" },
  { key: "chain_of_custody",     label: "Chain of Custody",     group: "Core Workflow" },
  { key: "test_assignment",      label: "Test Assignment",       group: "Core Workflow" },
  { key: "result_entry",         label: "Result Entry",          group: "Core Workflow" },
  { key: "technical_review",     label: "Technical Review",      group: "Core Workflow" },
  { key: "qa_approval",          label: "QA Approval",           group: "Core Workflow" },
  { key: "coa_generation",       label: "COA Generation",        group: "Core Workflow" },
  // Finance
  { key: "billing",              label: "Billing",               group: "Finance" },
  { key: "revenue",              label: "Revenue / Finance",     group: "Finance" },
  // Customer
  { key: "customer_portal",      label: "Customer Portal",       group: "Customer" },
  // Lab operations
  { key: "inventory",            label: "Inventory",             group: "Lab Operations" },
  { key: "instruments",          label: "Instruments",           group: "Lab Operations" },
  { key: "storage",              label: "Storage",               group: "Lab Operations" },
  { key: "suppliers",            label: "Suppliers",             group: "Lab Operations" },
  { key: "scheduling",           label: "Scheduling",            group: "Lab Operations" },
  // Quality
  { key: "quality_management",   label: "Quality Management",    group: "Quality" },
  { key: "documents",            label: "Documents",             group: "Quality" },
  { key: "audits",               label: "Audits",                group: "Quality" },
  // People
  { key: "training",             label: "Training",              group: "People" },
  // Analytics & AI
  { key: "analytics",            label: "Analytics",             group: "Analytics & AI" },
  { key: "ai_copilot",           label: "AI Copilot",            group: "Analytics & AI" },
];

// Default permission sets per role
const DEFAULT_PERMISSIONS: Record<LimsRole, Record<string, Action[]>> = {
  system_admin: Object.fromEntries(MODULES.map((m) => [m.key, ACTIONS.map((a) => a.key)])),
  lab_manager: Object.fromEntries(MODULES.map((m) => [m.key, ["view","create","edit","delete","approve","reject","export","import","print"] as Action[]])),
  supervisor: Object.fromEntries(MODULES.map((m) => [m.key, ["view","create","edit","approve","reject","export","print"] as Action[]])),
  analyst: {
    sample_registration: ["view","create","edit","print"],
    chain_of_custody: ["view"],
    test_assignment: ["view"],
    result_entry: ["view","create","edit","print"],
    technical_review: ["view"],
    qa_approval: ["view"],
    coa_generation: ["view","print"],
    billing: [],
    revenue: [],
    customer_portal: [],
    inventory: ["view","create","edit"],
    instruments: ["view","create","edit","print"],
    storage: ["view","create","edit"],
    suppliers: ["view"],
    scheduling: ["view","create","edit"],
    quality_management: ["view"],
    documents: ["view"],
    audits: ["view"],
    training: ["view","create"],
    analytics: ["view"],
    ai_copilot: ["view","create"],
  },
  qa_officer: {
    sample_registration: ["view"],
    chain_of_custody: ["view"],
    test_assignment: ["view"],
    result_entry: ["view","edit"],
    technical_review: ["view","edit","approve","reject"],
    qa_approval: ["view","create","edit","approve","reject","print"],
    coa_generation: ["view","create","edit","approve","print"],
    billing: ["view"],
    revenue: ["view"],
    customer_portal: ["view"],
    inventory: ["view","create","edit"],
    instruments: ["view","create","edit"],
    storage: ["view"],
    suppliers: ["view"],
    scheduling: ["view"],
    quality_management: ["view","create","edit","approve","print"],
    documents: ["view","create","edit","approve","print"],
    audits: ["view","create","edit","approve","print"],
    training: ["view","create"],
    analytics: ["view"],
    ai_copilot: ["view"],
  },
  reception: {
    sample_registration: ["view","create","edit","print"],
    chain_of_custody: ["view","create","edit","print"],
    test_assignment: ["view"],
    result_entry: ["view"],
    technical_review: [],
    qa_approval: [],
    coa_generation: ["view","print"],
    billing: ["view","create","edit","print","export"],
    revenue: ["view"],
    customer_portal: ["view","create","edit"],
    inventory: ["view"],
    instruments: ["view"],
    storage: ["view"],
    suppliers: [],
    scheduling: ["view","create","edit"],
    quality_management: ["view"],
    documents: ["view"],
    audits: [],
    training: ["view"],
    analytics: [],
    ai_copilot: [],
  },
  customer: {
    sample_registration: ["view"],
    chain_of_custody: ["view"],
    test_assignment: [],
    result_entry: [],
    technical_review: [],
    qa_approval: [],
    coa_generation: ["view","print"],
    billing: ["view","print"],
    revenue: [],
    customer_portal: ["view","create","print"],
    inventory: [],
    instruments: [],
    storage: [],
    suppliers: [],
    scheduling: [],
    quality_management: [],
    documents: ["view"],
    audits: [],
    training: [],
    analytics: [],
    ai_copilot: [],
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type PermMatrix = Record<string, Action[]>; // moduleKey → actions[]
type AllPerms = Record<LimsRole, PermMatrix>;

// ─── Permission matrix helpers ─────────────────────────────────────────────────

function configKeyForRole(role: LimsRole): string {
  return `perm_${role}`;
}

function parsePerms(jsonStr: string | undefined): PermMatrix {
  if (!jsonStr) return {};
  try { return JSON.parse(jsonStr) as PermMatrix; }
  catch { return {}; }
}

function mergeWithDefaults(saved: PermMatrix, role: LimsRole): PermMatrix {
  const defaults = DEFAULT_PERMISSIONS[role];
  const merged: PermMatrix = {};
  for (const m of MODULES) {
    merged[m.key] = saved[m.key] ?? defaults[m.key] ?? [];
  }
  return merged;
}

// ─── Permission editor (one role) ─────────────────────────────────────────────

function RoleEditor({
  role, perms, onChange,
}: {
  role: LimsRole;
  perms: PermMatrix;
  onChange: (p: PermMatrix) => void;
}) {
  const isAdmin = role === "system_admin";

  function toggle(moduleKey: string, action: Action) {
    if (isAdmin) return; // system_admin always has all
    const current = perms[moduleKey] ?? [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    onChange({ ...perms, [moduleKey]: next });
  }

  function toggleAllActions(moduleKey: string) {
    if (isAdmin) return;
    const current = perms[moduleKey] ?? [];
    const all = ACTIONS.map((a) => a.key);
    const hasAll = all.every((a) => current.includes(a));
    onChange({ ...perms, [moduleKey]: hasAll ? [] : all });
  }

  function toggleAllModules(action: Action) {
    if (isAdmin) return;
    const allHave = MODULES.every((m) => (perms[m.key] ?? []).includes(action));
    const next = { ...perms };
    for (const m of MODULES) {
      const cur = next[m.key] ?? [];
      next[m.key] = allHave ? cur.filter((a) => a !== action) : [...new Set([...cur, action])];
    }
    onChange(next);
  }

  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-400">
          <Info size={14} className="shrink-0" />
          System Administrator has all permissions on all modules and cannot be restricted.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold text-foreground w-48">Module</th>
              {ACTIONS.map((a) => (
                <th key={a.key} className="text-center px-1.5 py-2.5 font-semibold text-foreground min-w-[44px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{a.short}</span>
                    {!isAdmin && (
                      <Checkbox
                        checked={MODULES.every((m) => (perms[m.key] ?? []).includes(a.key))}
                        onCheckedChange={() => toggleAllModules(a.key)}
                        title={`Toggle all modules: ${a.label}`}
                        className="cursor-pointer"
                      />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2.5 text-center font-semibold text-foreground">All</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupModules = MODULES.filter((m) => m.group === group);
              return (
                <>
                  <tr key={`grp-${group}`} className="bg-muted/20">
                    <td colSpan={ACTIONS.length + 2} className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</td>
                  </tr>
                  {groupModules.map((m, idx) => {
                    const modPerms = isAdmin ? ACTIONS.map((a) => a.key) : (perms[m.key] ?? []);
                    const allChecked = ACTIONS.every((a) => modPerms.includes(a.key));
                    return (
                      <tr key={m.key} className={cn("border-b last:border-0", idx % 2 === 0 ? "" : "bg-muted/10")}>
                        <td className="px-3 py-2 font-medium">{m.label}</td>
                        {ACTIONS.map((a) => (
                          <td key={a.key} className="text-center px-1">
                            <Checkbox
                              checked={modPerms.includes(a.key)}
                              onCheckedChange={() => toggle(m.key, a.key)}
                              disabled={isAdmin}
                              className={cn("cursor-pointer", isAdmin && "opacity-50")}
                            />
                          </td>
                        ))}
                        <td className="text-center px-2">
                          {!isAdmin && (
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={() => toggleAllActions(m.key)}
                              className="cursor-pointer"
                              title="Toggle all actions for this module"
                            />
                          )}
                          {isAdmin && <Checkbox checked disabled className="opacity-50" />}
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Role Matrix (overview) ────────────────────────────────────────────────────

function RoleMatrix({ allPerms }: { allPerms: AllPerms }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Overview of which roles have View access across all modules. Green = has View permission.</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold w-48">Module</th>
              {ALL_ROLES.map((r) => (
                <th key={r} className="text-center px-2 py-2.5 font-semibold min-w-[90px]">
                  <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold", ROLE_COLORS[r])}>
                    {ROLE_LABELS[r].replace(" Administrator", " Admin").replace(" / Reviewer", "").replace(" Portal", "")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m, idx) => (
              <tr key={m.key} className={cn("border-b last:border-0", idx % 2 === 0 ? "" : "bg-muted/10")}>
                <td className="px-3 py-2 font-medium">{m.label}</td>
                {ALL_ROLES.map((r) => {
                  const hasView = r === "system_admin" || (allPerms[r]?.[m.key] ?? []).includes("view");
                  const actions = r === "system_admin" ? ACTIONS.map((a) => a.key) : (allPerms[r]?.[m.key] ?? []);
                  return (
                    <td key={r} className="text-center px-2 py-1">
                      {hasView ? (
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Has View" />
                          <span className="text-muted-foreground">{actions.length}/{ACTIONS.length}</span>
                        </div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto" title="No access" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" />Has View — number shows total granted actions (e.g. 3/9)</span>
        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />No access</span>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  return (
    <PageGuard allowed={["system_admin"]}>
      <RolesPageInner />
    </PageGuard>
  );
}

function RolesPageInner() {
  const { labId } = useActiveLab();
  const configMap = useQuery(api.config.getAllConfig, labId ? { laboratoryId: labId } : "skip");
  const setBulkConfig = useMutation(api.config.setBulkConfig);

  const [view, setView] = useState<"editor" | "matrix">("editor");
  const [activeRole, setActiveRole] = useState<LimsRole>("lab_manager");
  const [allPerms, setAllPerms] = useState<AllPerms | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load saved permissions from systemConfig
  useEffect(() => {
    if (!configMap) return;
    const loaded: AllPerms = {} as AllPerms;
    for (const role of ALL_ROLES) {
      const raw = configMap[configKeyForRole(role)];
      loaded[role] = mergeWithDefaults(parsePerms(raw), role);
    }
    setAllPerms(loaded);
    setDirty(false);
  }, [configMap]);

  function handleChange(role: LimsRole, perms: PermMatrix) {
    setAllPerms((prev) => prev ? { ...prev, [role]: perms } : prev);
    setDirty(true);
  }

  function handleReset() {
    if (!configMap) return;
    const reset: AllPerms = {} as AllPerms;
    for (const role of ALL_ROLES) {
      const raw = configMap[configKeyForRole(role)];
      reset[role] = mergeWithDefaults(parsePerms(raw), role);
    }
    setAllPerms(reset);
    setDirty(false);
    toast.info("Changes discarded");
  }

  async function handleSave() {
    if (!allPerms || !labId) return;
    setSaving(true);
    try {
      const configs = ALL_ROLES.filter((r) => r !== "system_admin").map((r) => ({
        key: configKeyForRole(r),
        value: JSON.stringify(allPerms[r]),
      }));
      await setBulkConfig({ laboratoryId: labId, configs });
      setDirty(false);
      toast.success("Role permissions saved");
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  const isLoading = !configMap || !allPerms;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Role &amp; Permission Management</h1>
            <p className="text-sm text-muted-foreground">Granular access control across all 21 modules · {ACTIONS.length} actions per module</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw size={13} className="mr-1.5" />Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={!dirty || saving || isLoading}>
            {saving ? <><Spinner className="w-4 h-4 mr-1.5" />Saving…</> : <><Save size={13} className="mr-1.5" />Save Permissions</>}
          </Button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 border rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("editor")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all cursor-pointer",
            view === "editor" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 size={13} />Permission Editor
        </button>
        <button
          onClick={() => setView("matrix")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all cursor-pointer",
            view === "matrix" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Table2 size={13} />Matrix Report
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : view === "matrix" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Table2 size={15} className="text-primary" />Role Matrix Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleMatrix allPerms={allPerms!} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Role tabs */}
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => {
              const activeCount = r === "system_admin"
                ? MODULES.length * ACTIONS.length
                : MODULES.reduce((sum, m) => sum + (allPerms![r]?.[m.key]?.length ?? 0), 0);
              const totalPossible = MODULES.length * ACTIONS.length;
              return (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer",
                    activeRole === r
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <span className={cn("inline-block w-2 h-2 rounded-full", ROLE_COLORS[r].split(" ")[0].replace("bg-", "bg-").replace("100", "500").replace("950", "500"))} />
                  <span>{ROLE_LABELS[r]}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    {activeCount}/{totalPossible}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground px-1">
            {ACTIONS.map((a) => (
              <span key={a.key} className="flex items-center gap-1">
                <span className="font-medium text-foreground">{a.short}</span> = {a.label}
              </span>
            ))}
            <span className="flex items-center gap-1 ml-auto font-medium text-foreground">All = Toggle all actions for that row/column</span>
          </div>

          {/* Editor card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 size={15} className="text-primary" />
                  <RoleBadge role={activeRole} />
                  <span className="font-normal text-muted-foreground text-sm">permissions</span>
                </CardTitle>
                {activeRole !== "system_admin" && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => {
                      handleChange(activeRole, DEFAULT_PERMISSIONS[activeRole]);
                      toast.info(`Reset ${ROLE_LABELS[activeRole]} to defaults`);
                    }}
                  >
                    <RotateCcw size={12} className="mr-1.5" />Reset to defaults
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <RoleEditor
                key={activeRole}
                role={activeRole}
                perms={allPerms![activeRole] ?? {}}
                onChange={(p) => handleChange(activeRole, p)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dirty banner */}
      {dirty && (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 shadow-lg backdrop-blur-sm z-20">
          <span className="text-sm font-medium">Unsaved permission changes</span>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner className="w-3 h-3 mr-1.5" />Saving…</> : <><Save size={12} className="mr-1.5" />Save</>}
          </Button>
        </div>
      )}
    </div>
  );
}
