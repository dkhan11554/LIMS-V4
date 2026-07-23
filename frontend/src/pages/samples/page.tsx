import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Plus, FlaskConical, Search, Printer, QrCode } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";
import { generateSampleLabel, generateBatchLabels, LABEL_SIZE_OPTIONS, type LabelSize } from "@/lib/generate-label.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "received", label: "Received" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "assigned", label: "Assigned" },
  { value: "testing", label: "Testing" },
  { value: "pending_review", label: "Pending Review" },
  { value: "pending_qa", label: "Pending QA" },
  { value: "approved", label: "Approved" },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  routine: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  stat: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function SamplesPage() {
  const { labId, lab } = useActiveLab();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");
  const [printing, setPrinting] = useState(false);

  const samples = useQuery(
    api.samples.listSamples,
    labId ? { laboratoryId: labId, status: statusFilter || undefined } : "skip"
  );

  const filtered = samples?.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.limsNumber.toLowerCase().includes(q) ||
      s.sampleName.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      (s.batchNumber ?? "").toLowerCase().includes(q) ||
      (s.product ?? "").toLowerCase().includes(q)
    );
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function printSelected() {
    const toprint = filtered?.filter((s) => selectedIds.has(s._id)) ?? [];
    if (!toprint.length) { toast.error("Select at least one sample"); return; }
    setPrinting(true);
    try {
      if (toprint.length === 1 && toprint[0]) {
        await generateSampleLabel({ limsNumber: toprint[0].limsNumber, sampleName: toprint[0].sampleName, customerName: toprint[0].customerName, sampleType: toprint[0].sampleType, priority: toprint[0].priority, collectionDate: toprint[0].collectionDate, batchNumber: toprint[0].batchNumber, laboratoryName: lab?.name }, labelSize);
      } else {
        await generateBatchLabels(toprint.map((s) => ({ limsNumber: s.limsNumber, sampleName: s.sampleName, customerName: s.customerName, sampleType: s.sampleType, priority: s.priority, collectionDate: s.collectionDate, batchNumber: s.batchNumber, laboratoryName: lab?.name })), labelSize);
      }
      toast.success(`Label${toprint.length > 1 ? "s" : ""} opened for printing`);
    } catch { toast.error("Failed to generate labels"); }
    finally { setPrinting(false); }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Samples</h1>
          <p className="text-sm text-muted-foreground">{samples?.length ?? 0} samples</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LABEL_SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => void printSelected()} disabled={printing}>
                <Printer size={13} className="mr-1.5" />{printing ? "Generating…" : `Print ${selectedIds.size} Label${selectedIds.size > 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          <Button asChild>
            <Link to="/samples/register"><Plus size={14} className="mr-1.5" /> Register Sample</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm w-64"
            placeholder="Search LIMS #, name, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {samples === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FlaskConical /></EmptyMedia>
            <EmptyTitle>No samples found</EmptyTitle>
            <EmptyDescription>Register a new sample to get started</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm">
              <Link to="/samples/register">Register Sample</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                    <th className="px-3 py-2.5 w-8"><input type="checkbox" className="rounded cursor-pointer" onChange={(e) => { if (e.target.checked) { setSelectedIds(new Set(filtered?.map(s => s._id) ?? [])); } else setSelectedIds(new Set()); }} checked={selectedIds.size > 0 && selectedIds.size === filtered?.length} /></th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">LIMS #</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Sample</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Batch</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Received</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered?.map((s) => (
                  <tr key={s._id} className={cn("hover:bg-muted/30 transition-colors", selectedIds.has(s._id) && "bg-primary/5")}>
                    <td className="px-3 py-3"><input type="checkbox" className="rounded cursor-pointer" checked={selectedIds.has(s._id)} onChange={() => toggleSelect(s._id)} /></td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{s.limsNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{s.sampleName}</p>
                      {s.sampleType && <p className="text-xs text-muted-foreground">{s.sampleType}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {s.customerName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {s.batchNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                      {s.receivedDate ? format(new Date(s.receivedDate), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded", PRIORITY_COLORS[s.priority] ?? "bg-muted text-muted-foreground")}>
                        {s.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                        <Link to={`/samples/${s._id}`}>View</Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Print label" onClick={() => void generateSampleLabel({ limsNumber: s.limsNumber, sampleName: s.sampleName, customerName: s.customerName, sampleType: s.sampleType, priority: s.priority, collectionDate: s.collectionDate, batchNumber: s.batchNumber, laboratoryName: lab?.name }, labelSize)}>
                        <QrCode size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
