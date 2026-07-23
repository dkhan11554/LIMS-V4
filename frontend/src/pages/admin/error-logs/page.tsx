/**
 * Error Logs Admin Page — Diagnostic & Audit Console
 * Admins see full technical logs; end users never see raw errors.
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Authenticated } from "convex/react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle, Info, ShieldAlert, KeyRound, Zap, AlertCircle,
  Search, Trash2, RefreshCw, Activity, FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { ErrorSeverity } from "@/lib/errors.ts";
import { SEVERITY_META } from "@/lib/errors.ts";
import type { Id } from "@/convex/_generated/dataModel";

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  info:       <Info size={14} />,
  warning:    <AlertTriangle size={14} />,
  validation: <AlertCircle size={14} />,
  business:   <AlertTriangle size={14} />,
  permission: <KeyRound size={14} />,
  security:   <ShieldAlert size={14} />,
  critical:   <Zap size={14} />,
};

function LogRow({ log }: { log: {
  _id: string; errorId: string; timestamp: string; userName?: string;
  module: string; screen: string; action: string; fieldId?: string;
  category: string; title: string; detail: string; rawMessage: string;
  url?: string; userAgent?: string;
}}) {
  const [expanded, setExpanded] = useState(false);
  const meta = SEVERITY_META[log.category as ErrorSeverity] ?? SEVERITY_META.info;

  return (
    <div className={cn("border rounded-lg overflow-hidden transition-all", meta.borderClass)}>
      <button
        type="button"
        className={cn("w-full text-left p-3 flex items-start gap-3 hover:opacity-90 transition-opacity cursor-pointer", meta.bgClass)}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={cn("shrink-0 mt-0.5", meta.iconColor)}>
          {SEVERITY_ICONS[log.category] ?? <Info size={14} />}
        </span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-bold", meta.textClass)}>{log.title}</span>
            <Badge variant="outline" className="text-xs">{log.module}</Badge>
            <Badge variant="outline" className="text-xs">{log.screen}</Badge>
            {log.fieldId && <Badge variant="secondary" className="text-xs">Field: {log.fieldId}</Badge>}
          </div>
          <p className="text-xs text-foreground/80 truncate">{log.detail}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {log.errorId} · {format(parseISO(log.timestamp), "dd MMM yyyy HH:mm:ss")}
            {log.userName && ` · ${log.userName}`}
          </p>
        </div>
        {expanded ? <ChevronUp size={14} className="shrink-0 mt-0.5" /> : <ChevronDown size={14} className="shrink-0 mt-0.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 bg-background border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: "Error ID", value: log.errorId },
              { label: "Category", value: log.category },
              { label: "Module", value: log.module },
              { label: "Screen", value: log.screen },
              { label: "Action", value: log.action },
              { label: "Field", value: log.fieldId ?? "—" },
              { label: "User", value: log.userName ?? "Unknown" },
              { label: "Timestamp", value: format(parseISO(log.timestamp), "dd MMM yyyy HH:mm:ss z") },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">{label}</div>
                <div className="font-mono break-all">{value}</div>
              </div>
            ))}
          </div>

          {log.rawMessage && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Raw Error Message</div>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-32 text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                {log.rawMessage}
              </pre>
            </div>
          )}

          {log.url && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">URL</div>
              <p className="text-xs font-mono text-muted-foreground break-all">{log.url}</p>
            </div>
          )}

          {log.userAgent && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Browser / Device</div>
              <p className="text-xs font-mono text-muted-foreground break-all">{log.userAgent}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorLogsInner() {
  const { labId } = useActiveLab();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const logs = useQuery(api.errorLogs.listErrorLogs, {
    laboratoryId: labId as Id<"laboratories"> | undefined,
    category: category !== "all" ? category : undefined,
    limit: 200,
  });
  const stats = useQuery(api.errorLogs.getErrorLogStats, {
    laboratoryId: labId as Id<"laboratories"> | undefined,
  });
  const clearLogs = useMutation(api.errorLogs.clearErrorLogs);

  const filteredLogs = (logs ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.detail.toLowerCase().includes(q) ||
      l.module.toLowerCase().includes(q) ||
      l.screen.toLowerCase().includes(q) ||
      (l.userName ?? "").toLowerCase().includes(q) ||
      l.errorId.toLowerCase().includes(q)
    );
  });

  const handleClear = async () => {
    if (!confirm("Clear all error logs? This cannot be undone.")) return;
    const { deleted } = await clearLogs({ laboratoryId: labId as Id<"laboratories"> | undefined });
    toast.success(`Cleared ${deleted} log entries`);
  };

  const CATEGORIES = ["all", "info", "warning", "validation", "business", "permission", "security", "critical"];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/30">
            <Activity size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Error Logs</h1>
            <p className="text-sm text-muted-foreground">Diagnostic console — technical details hidden from end users</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleClear} className="gap-1.5 text-red-600">
          <Trash2 size={13} /> Clear All
        </Button>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Errors</div>
            </CardContent>
          </Card>
          {(["critical", "validation", "business", "warning"] as ErrorSeverity[]).map((cat) => {
            const meta = SEVERITY_META[cat];
            const count = stats.byCat[cat] ?? 0;
            return (
              <Card key={cat} className={cn("border-l-4", meta.borderClass)}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <span className={meta.iconColor}>{SEVERITY_ICONS[cat]}</span>
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{cat}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, user, module, error ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by severity..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All Severities" : c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log list */}
      {logs === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>No error logs found</EmptyTitle>
            <EmptyDescription>Errors will appear here when they occur. A clean log is a healthy system.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""}</p>
          {filteredLogs.map((log) => (
            <LogRow key={log._id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ErrorLogsPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager"]}>
      <Authenticated>
        <ErrorLogsInner />
      </Authenticated>
    </PageGuard>
  );
}
