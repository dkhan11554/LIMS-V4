import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { RoleBadge } from "@/components/ui/role-badge.tsx";
import { useRole } from "@/hooks/use-role.ts";
import {
  LayoutDashboard, Users, FlaskConical, ClipboardList,
  Settings, ChevronDown, ChevronRight, Bell, Menu, X,
  Building2, BookOpen, UserCheck, Microscope, ShieldCheck,
  FileText, LogOut, Search, FileBarChart2, Package, Gauge, Receipt, Globe, Brain, BarChart2,
  Archive, Truck, GraduationCap, ClipboardCheck, FileCheck, Cable, Wrench, DollarSign, Zap
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import AiHelpWidget from "@/components/ai-help-widget.tsx";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: { label: string; href: string }[];
  /** Roles allowed to see this item (undefined = everyone) */
  allowedRoles?: string[];
  /** Module key in systemConfig — if set to "false", hide from non-admins */
  moduleKey?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   icon: <LayoutDashboard size={16} />, href: "/dashboard" },
  {
    label: "Customers",
    icon: <Users size={16} />,
    children: [{ label: "Customer List", href: "/customers" }],
  },
  {
    label: "Samples",
    icon: <FlaskConical size={16} />,
    children: [
      { label: "Register Sample", href: "/samples/register" },
      { label: "All Samples",     href: "/samples" },
    ],
  },
  {
    label: "Laboratory",
    icon: <Microscope size={16} />,
    children: [
      { label: "Work Assignment",   href: "/laboratory/work-assignment" },
      { label: "My Tests",          href: "/laboratory/my-tests" },
      { label: "Scheduling",        href: "/scheduling" },
      { label: "Calculations",      href: "/laboratory/calculations" },
      { label: "Specifications",    href: "/laboratory/specifications" },
      { label: "Retest & Repeat",   href: "/laboratory/retest" },
    ],
  },
  {
    label: "Quality",
    icon: <ShieldCheck size={16} />,
    children: [
      { label: "Technical Review",  href: "/quality/technical-review",  },
      { label: "QA Approval",       href: "/quality/qa-approval" },
      { label: "Result Validation", href: "/quality/validation" },
      { label: "Quality Management",href: "/quality-management" },
    ],
  },
  { label: "Reports",    icon: <FileBarChart2 size={16} />, href: "/reports" },
  {
    label: "Analytics",
    icon: <BarChart2 size={16} />,
    href: "/analytics",
    allowedRoles: ["system_admin", "lab_manager", "supervisor"],
    moduleKey: "mod_analytics",
  },
  {
    label: "AI Copilot",
    icon: <Brain size={16} />,
    href: "/ai-copilot",
    allowedRoles: ["system_admin", "lab_manager", "supervisor"],
    moduleKey: "mod_ai_copilot",
  },
  {
    label: "AI Intelligence",
    icon: <Zap size={16} />,
    href: "/ai/intelligence",
    allowedRoles: ["system_admin", "lab_manager", "supervisor", "qa_officer"],
    moduleKey: "mod_ai_copilot",
  },
  {
    label: "Revenue",
    icon: <DollarSign size={16} />,
    href: "/revenue",
    allowedRoles: ["system_admin", "lab_manager"],
    moduleKey: "mod_revenue",
  },
  {
    label: "Billing",
    icon: <Receipt size={16} />,
    href: "/billing",
    allowedRoles: ["system_admin", "lab_manager", "reception"],
    moduleKey: "mod_billing",
  },
  {
    label: "Portal",
    icon: <Globe size={16} />,
    href: "/portal",
    allowedRoles: ["system_admin", "lab_manager", "reception", "customer"],
    moduleKey: "mod_customer_portal",
  },
  {
    label: "Instruments",
    icon: <Gauge size={16} />,
    moduleKey: "mod_instruments",
    children: [
      { label: "Instrument List",    href: "/instruments" },
      { label: "Integration",        href: "/instruments/integration" },
      { label: "QC Dashboard",       href: "/instruments/qc" },
    ],
  },
  { label: "Inventory", icon: <Package size={16} />, href: "/inventory", moduleKey: "mod_inventory" },
  { label: "Storage",   icon: <Archive size={16} />, href: "/storage",   moduleKey: "mod_storage" },
  {
    label: "Suppliers",
    icon: <Truck size={16} />,
    href: "/suppliers",
    allowedRoles: ["system_admin", "lab_manager"],
    moduleKey: "mod_suppliers",
  },
  {
    label: "Documents",
    icon: <FileCheck size={16} />,
    href: "/documents",
    allowedRoles: ["system_admin", "lab_manager", "supervisor", "qa_officer"],
    moduleKey: "mod_documents",
  },
  {
    label: "Training",
    icon: <GraduationCap size={16} />,
    href: "/training",
    moduleKey: "mod_training",
  },
  {
    label: "Audits",
    icon: <ClipboardCheck size={16} />,
    href: "/audits",
    allowedRoles: ["system_admin", "lab_manager", "qa_officer"],
    moduleKey: "mod_audits",
  },
  {
    label: "Administration",
    icon: <Settings size={16} />,
    allowedRoles: ["system_admin", "lab_manager"],
    children: [
      { label: "Users",            href: "/admin/users" },
      { label: "Roles & Permissions", href: "/admin/roles" },
      { label: "User Reports",         href: "/admin/user-reports" },
      { label: "Laboratories",     href: "/admin/laboratories" },
      { label: "Departments",      href: "/admin/departments" },
      { label: "Test Methods",     href: "/admin/methods" },
      { label: "Test Catalogue",   href: "/admin/tests" },
      { label: "System Config",    href: "/admin/config" },
      { label: "Error Logs",       href: "/admin/error-logs" },
    ],
  },
];

function NavSection({ item, collapsed, role, moduleConfig }: { item: NavItem; collapsed: boolean; role: string; moduleConfig: Record<string, string> | undefined }) {
  const [open, setOpen] = useState(false);

  // Role-gating: if allowedRoles specified, check current role (system_admin always passes)
  if (item.allowedRoles && role !== "system_admin" && !item.allowedRoles.includes(role)) {
    return null;
  }
  // Module gating: if moduleKey is "false" in config, hide from non-admins
  if (item.moduleKey && role !== "system_admin" && moduleConfig?.[item.moduleKey] === "false") {
    return null;
  }

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )
        }
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
          "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
          {item.children?.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              className={({ isActive }) =>
                cn(
                  "block px-2 py-1.5 rounded text-xs transition-colors cursor-pointer",
                  isActive
                    ? "text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const { user, role } = useRole();
  const { labId } = useActiveLab();
  const moduleConfig = useQuery(api.config.getAllConfig, labId ? { laboratoryId: labId } : "skip");

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-3 py-3 border-b border-sidebar-border", collapsed && "justify-center")}>
        {/* AI-DATA logo */}
        <img
          src="https://hercules-cdn.com/file_ufv3tHxtGCOHOupKSBftfiVK"
          alt="AI-DATA logo"
          className={cn("shrink-0 rounded-md object-cover", collapsed ? "w-8 h-8" : "w-9 h-9")}
        />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sidebar-foreground font-bold text-sm leading-tight tracking-wide">LIMS</span>
            <span className="text-sidebar-foreground/55 text-[10px] leading-tight truncate">AI Data Software Solutions LLC</span>
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto text-sidebar-foreground/60 hover:text-sidebar-foreground cursor-pointer shrink-0">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavSection key={item.label} item={item} collapsed={collapsed} role={role} moduleConfig={moduleConfig ?? undefined} />
        ))}
      </nav>

      {/* User footer with role badge */}
      <div className={cn("px-3 py-3 border-t border-sidebar-border", collapsed && "flex justify-center")}>
        {user && !collapsed && (
          <NavLink to="/profile" className="flex items-start gap-2 rounded-lg p-1 hover:bg-sidebar-accent transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-semibold shrink-0 mt-0.5 overflow-hidden">
              {(user as { avatarUrl?: string }).avatarUrl ? (
                <img src={(user as { avatarUrl?: string }).avatarUrl} alt={user.name ?? "User"} className="w-full h-full object-cover" />
              ) : (
                <span>{user.name?.[0] ?? "U"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-xs font-medium truncate">{user.name ?? "User"}</p>
              <div className="mt-0.5">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </NavLink>
        )}
        {collapsed && user && (
          <NavLink to="/profile" title={user.name ?? "Profile"} className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-semibold overflow-hidden cursor-pointer">
            {(user as { avatarUrl?: string }).avatarUrl ? (
              <img src={(user as { avatarUrl?: string }).avatarUrl} alt={user.name ?? "User"} className="w-full h-full object-cover" />
            ) : (
              <span>{user.name?.[0] ?? "U"}</span>
            )}
          </NavLink>
        )}
      </div>
    </aside>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const notifications = useQuery(api.notifications.getMyNotifications);
  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;
  const { signout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center gap-3 px-4 shrink-0">
      <button onClick={onMenuClick} className="text-muted-foreground hover:text-foreground cursor-pointer">
        <Menu size={18} />
      </button>
      <div className="flex-1" />
      <button className="relative text-muted-foreground hover:text-foreground cursor-pointer">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[10px] rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      <button
        onClick={() => { void signout(); navigate("/"); }}
        className="text-muted-foreground hover:text-foreground cursor-pointer"
        title="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <Skeleton className="w-48 h-8" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <img
            src="https://hercules-cdn.com/file_ufv3tHxtGCOHOupKSBftfiVK"
            alt="AI-DATA"
            className="w-20 h-20 rounded-xl object-cover"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold leading-snug">Laboratory Information Management System</h1>
            <p className="text-sm text-muted-foreground mt-1">Powered by AI Data Software Solutions LLC</p>
          </div>
          <p className="text-muted-foreground text-sm">Please sign in to access the system</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Mobile sidebar overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
          {/* Mobile sidebar */}
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200",
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <Sidebar collapsed={false} onClose={() => setMobileSidebarOpen(false)} />
          </div>

          {/* Desktop sidebar */}
          <div className="hidden md:flex shrink-0">
            <Sidebar collapsed={sidebarCollapsed} />
          </div>

          {/* Main */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <TopBar onMenuClick={() => {
              setSidebarCollapsed(!sidebarCollapsed);
              setMobileSidebarOpen(true);
            }} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              <Outlet />
            </main>
          </div>

          {/* AI Help Widget — floats over every page */}
          <AiHelpWidget />
        </div>
      </Authenticated>
    </>
  );
}
