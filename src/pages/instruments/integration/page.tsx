/**
 * Instrument Interface Manager & Result File Import
 * Milestone 16 + 17 — two tabs on one page
 */
import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { useRole } from "@/hooks/use-role.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import Papa from "papaparse";
import {
  Plus, Settings2, Upload, FileUp, CheckCircle2, XCircle, AlertCircle,
  Trash2, RefreshCw, ChevronRight, FileText, Download, Eye, Cable
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Interface = {
  _id: Id<"instrumentInterfaces">;
  instrumentId: Id<"instruments">;
  instrumentName?: string;
  instrumentCode?: string;
  interfaceName: string;
  fileFormat: "csv" | "tsv" | "txt";
  delimiter?: string;
  hasHeaderRow: boolean;
  useNamedColumns?: boolean;
  colLimsNumber?: number;
  colTestCode?: number;
  colResult?: number;
  colUnit?: number;
  colFlags?: number;
  colNameLimsNumber?: string;
  colNameTestCode?: string;
  colNameResult?: string;
  colNameUnit?: string;
  colNameFlags?: string;
  isActive: boolean;
  notes?: string;
};

type ParsedRow = {
  rawData: string;
  limsNumber?: string;
  testCode?: string;
  result?: string;
  unit?: string;
  flags?: string;
  analysisDate?: string;
  operator?: string;
};

type RowWithStatus = ParsedRow & {
  matchStatus: "matched" | "unmatched" | "duplicate" | "skipped" | "pending";
};

// ─── Interface Form ───────────────────────────────────────────────────────────

function InterfaceForm({
  instruments,
  initial,
  laboratoryId,
  onClose,
}: {
  instruments: { _id: Id<"instruments">; name: string; instrumentCode: string }[];
  initial?: Interface | null;
  laboratoryId: Id<"laboratories">;
  onClose: () => void;
}) {
  const create = useMutation(api.instrumentIntegration.createInterface);
  const update = useMutation(api.instrumentIntegration.updateInterface);

  const [form, setForm] = useState({
    instrumentId: initial?.instrumentId ?? ("" as Id<"instruments"> | ""),
    interfaceName: initial?.interfaceName ?? "",
    fileFormat: initial?.fileFormat ?? "csv" as "csv" | "tsv" | "txt",
    delimiter: initial?.delimiter ?? "comma",
    hasHeaderRow: initial?.hasHeaderRow ?? true,
    useNamedColumns: initial?.useNamedColumns ?? false,
    colLimsNumber: String(initial?.colLimsNumber ?? "0"),
    colTestCode: String(initial?.colTestCode ?? "1"),
    colResult: String(initial?.colResult ?? "2"),
    colUnit: String(initial?.colUnit ?? "3"),
    colFlags: String(initial?.colFlags ?? ""),
    colNameLimsNumber: initial?.colNameLimsNumber ?? "SampleID",
    colNameTestCode: initial?.colNameTestCode ?? "TestCode",
    colNameResult: initial?.colNameResult ?? "Result",
    colNameUnit: initial?.colNameUnit ?? "Unit",
    colNameFlags: initial?.colNameFlags ?? "Flags",
    notes: initial?.notes ?? "",
  });

  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.instrumentId || !form.interfaceName) {
      toast.error("Instrument and interface name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        instrumentId: form.instrumentId as Id<"instruments">,
        laboratoryId,
        interfaceName: form.interfaceName,
        fileFormat: form.fileFormat,
        delimiter: form.delimiter,
        hasHeaderRow: form.hasHeaderRow,
        useNamedColumns: form.useNamedColumns,
        notes: form.notes || undefined,
        ...(form.useNamedColumns
          ? {
              colNameLimsNumber: form.colNameLimsNumber,
              colNameTestCode: form.colNameTestCode,
              colNameResult: form.colNameResult,
              colNameUnit: form.colNameUnit,
              colNameFlags: form.colNameFlags || undefined,
            }
          : {
              colLimsNumber: Number(form.colLimsNumber),
              colTestCode: Number(form.colTestCode),
              colResult: Number(form.colResult),
              colUnit: form.colUnit !== "" ? Number(form.colUnit) : undefined,
              colFlags: form.colFlags !== "" ? Number(form.colFlags) : undefined,
            }),
      };
      if (initial) {
        await update({ interfaceId: initial._id, ...payload });
        toast.success("Interface updated");
      } else {
        await create(payload);
        toast.success("Interface created");
      }
      onClose();
    } catch {
      toast.error("Failed to save interface");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Instrument + name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Instrument *</Label>
          <Select value={String(form.instrumentId)} onValueChange={(v) => set("instrumentId", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {instruments.map((i) => (
                <SelectItem key={i._id} value={i._id}>{i.name} ({i.instrumentCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Interface Name *</Label>
          <Input value={form.interfaceName} onChange={(e) => set("interfaceName", e.target.value)} placeholder="e.g. Cobas 6000 CSV" />
        </div>
      </div>

      {/* Format */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>File Format</Label>
          <Select value={form.fileFormat} onValueChange={(v) => set("fileFormat", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="tsv">TSV</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Delimiter</Label>
          <Select value={form.delimiter} onValueChange={(v) => set("delimiter", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input type="checkbox" checked={form.hasHeaderRow} onChange={(e) => set("hasHeaderRow", e.target.checked)} className="rounded" />
            Has header row
          </label>
        </div>
      </div>

      {/* Column mapping mode */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.useNamedColumns} onChange={(e) => set("useNamedColumns", e.target.checked)} className="rounded" />
          Use named column headers (instead of column index numbers)
        </label>
      </div>

      {/* Column mappings */}
      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Column Mappings</p>
        {form.useNamedColumns ? (
          <div className="grid grid-cols-2 gap-3">
            {([["colNameLimsNumber", "LIMS Number column *"], ["colNameTestCode", "Test Code column *"], ["colNameResult", "Result column *"], ["colNameUnit", "Unit column"], ["colNameFlags", "Flags column"]] as [keyof typeof form, string][]).map(([k, lbl]) => (
              <div key={String(k)} className="space-y-1">
                <Label className="text-xs">{lbl}</Label>
                <Input className="h-8 text-sm" value={String(form[k])} onChange={(e) => set(String(k), e.target.value)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {([["colLimsNumber", "LIMS # col (0-based) *"], ["colTestCode", "Test Code col *"], ["colResult", "Result col *"], ["colUnit", "Unit col"], ["colFlags", "Flags col"]] as [keyof typeof form, string][]).map(([k, lbl]) => (
              <div key={String(k)} className="space-y-1">
                <Label className="text-xs">{lbl}</Label>
                <Input type="number" min="0" className="h-8 text-sm" value={String(form[k])} onChange={(e) => set(String(k), e.target.value)} placeholder="—" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes about this interface…" />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : initial ? "Update" : "Create Interface"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

function ImportDialog({
  iface,
  laboratoryId,
  onClose,
}: {
  iface: Interface;
  laboratoryId: Id<"laboratories">;
  onClose: () => void;
}) {
  const createBatch = useMutation(api.instrumentIntegration.createBatch);
  const importBatch = useMutation(api.instrumentIntegration.importBatch);

  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowWithStatus[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batchId, setBatchId] = useState<Id<"instrumentResultBatches"> | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);

  function getDelimiter(d?: string) {
    if (d === "tab") return "\t";
    if (d === "semicolon") return ";";
    if (d === "pipe") return "|";
    return ",";
  }

  function parseFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    const delimiter = getDelimiter(iface.delimiter);

    Papa.parse<string[]>(file, {
      delimiter,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as string[][];
        const startRow = iface.hasHeaderRow ? 1 : 0;
        const headerRow = iface.hasHeaderRow ? data[0] ?? [] : [];

        const parsed: RowWithStatus[] = [];
        for (let i = startRow; i < data.length; i++) {
          const row = data[i] ?? [];
          const get = (col: number | undefined, name: string | undefined): string | undefined => {
            if (iface.useNamedColumns && name) {
              const idx = headerRow.indexOf(name);
              return idx >= 0 ? row[idx]?.trim() : undefined;
            }
            return col !== undefined ? row[col]?.trim() : undefined;
          };
          parsed.push({
            rawData: row.join(delimiter),
            limsNumber: get(iface.colLimsNumber, iface.colNameLimsNumber),
            testCode: get(iface.colTestCode, iface.colNameTestCode),
            result: get(iface.colResult, iface.colNameResult),
            unit: get(iface.colUnit, iface.colNameUnit),
            flags: get(iface.colFlags, iface.colNameFlags),
            matchStatus: "pending",
          });
        }
        setRows(parsed);
        setParsing(false);
      },
      error: () => {
        toast.error("Failed to parse file");
        setParsing(false);
      },
    });
  }

  async function handleUpload() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const newBatchId = await createBatch({
        instrumentId: iface.instrumentId,
        interfaceId: iface._id,
        laboratoryId,
        fileName,
        rows: rows.map((r) => ({
          rawData: r.rawData,
          limsNumber: r.limsNumber,
          testCode: r.testCode,
          result: r.result,
          unit: r.unit,
          flags: r.flags,
          analysisDate: r.analysisDate,
          operator: r.operator,
        })),
      });
      setBatchId(newBatchId);

      // Fetch updated rows with match statuses
      const result = await importBatch({ batchId: newBatchId });
      setImportResult(result);
      toast.success(`Imported ${result.imported} results successfully`);
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  const statusConfig = {
    pending: { color: "bg-gray-100 text-gray-600", icon: <RefreshCw size={10} />, label: "Pending" },
    matched: { color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={10} />, label: "Matched" },
    unmatched: { color: "bg-red-100 text-red-700", icon: <XCircle size={10} />, label: "Unmatched" },
    duplicate: { color: "bg-amber-100 text-amber-700", icon: <AlertCircle size={10} />, label: "Duplicate" },
    skipped: { color: "bg-gray-100 text-gray-500", icon: <ChevronRight size={10} />, label: "Skipped" },
  } as const;

  return (
    <div className="space-y-4">
      {!importResult ? (
        <>
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <FileUp className="mx-auto mb-3 text-muted-foreground" size={36} />
            <p className="font-medium">{fileName || "Click or drop a file here"}</p>
            <p className="text-xs text-muted-foreground mt-1">{iface.fileFormat.toUpperCase()} format • {iface.interfaceName}</p>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          </div>

          {parsing && <div className="text-center text-sm text-muted-foreground"><RefreshCw className="inline animate-spin mr-2" size={14} />Parsing file…</div>}

          {/* Preview table */}
          {rows.length > 0 && !parsing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{rows.length} rows parsed</p>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">{rows.filter(r => r.matchStatus === "matched").length} matched</span>
                  <span className="text-red-500">{rows.filter(r => r.matchStatus === "unmatched").length} unmatched</span>
                  <span className="text-amber-500">{rows.filter(r => r.matchStatus === "duplicate").length} duplicates</span>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">LIMS #</th>
                        <th className="px-3 py-2 text-left">Test Code</th>
                        <th className="px-3 py-2 text-left">Result</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Flags</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((row, i) => {
                        const sc = statusConfig[row.matchStatus];
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5 font-mono">{row.limsNumber ?? <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5">{row.testCode ?? <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5 font-semibold">{row.result ?? <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.unit}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.flags}</td>
                            <td className="px-3 py-1.5">
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", sc.color)}>
                                {sc.icon}{sc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {rows.length > 50 && <p className="text-xs text-muted-foreground text-center">Showing first 50 of {rows.length} rows</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={rows.length === 0 || importing || parsing} onClick={() => void handleUpload()}>
              {importing ? <><RefreshCw size={14} className="animate-spin mr-2" />Importing…</> : <><Upload size={14} className="mr-2" />Import {rows.filter(r => r.matchStatus === "matched").length} Matched Results</>}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <div className="text-center space-y-4 py-4">
          <CheckCircle2 className="mx-auto text-green-500" size={48} />
          <div>
            <p className="text-xl font-bold text-green-600">{importResult.imported} Results Imported</p>
            <p className="text-sm text-muted-foreground mt-1">Out of {importResult.total} matched rows</p>
            {batchId && <p className="text-xs text-muted-foreground mt-1">Batch ID: {batchId}</p>}
          </div>
          <p className="text-sm">Test results have been auto-populated into the LIMS. Analysts can review and submit for approval.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Batch History ────────────────────────────────────────────────────────────

function BatchHistory({ laboratoryId }: { laboratoryId: Id<"laboratories"> }) {
  const batches = useQuery(api.instrumentIntegration.listBatches, { laboratoryId });

  const statusStyles = {
    pending: "bg-gray-100 text-gray-600",
    imported: "bg-green-100 text-green-700",
    partial: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  } as const;

  if (!batches) return <Skeleton className="h-32 w-full" />;

  if (batches.length === 0) return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><FileText /></EmptyMedia>
        <EmptyTitle>No imports yet</EmptyTitle>
        <EmptyDescription>Upload a result file to see import history here</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-4 py-3 text-left font-medium">File</th>
            <th className="px-4 py-3 text-left font-medium">Instrument</th>
            <th className="px-4 py-3 text-left font-medium">Uploaded</th>
            <th className="px-4 py-3 text-left font-medium">By</th>
            <th className="px-4 py-3 text-center font-medium">Total</th>
            <th className="px-4 py-3 text-center font-medium">Matched</th>
            <th className="px-4 py-3 text-center font-medium">Imported</th>
            <th className="px-4 py-3 text-center font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {batches.map((b) => (
            <tr key={b._id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs max-w-[180px] truncate">{b.fileName}</td>
              <td className="px-4 py-3">{b.instrumentName}</td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(b.uploadedAt).toLocaleString()}</td>
              <td className="px-4 py-3">{b.uploaderName}</td>
              <td className="px-4 py-3 text-center">{b.totalRows}</td>
              <td className="px-4 py-3 text-center text-green-600 font-medium">{b.matchedRows}</td>
              <td className="px-4 py-3 text-center text-blue-600 font-medium">{b.importedRows}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusStyles[b.status])}>{b.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InstrumentIntegrationPage() {
  const { labId } = useActiveLab();
  const { role } = useRole();
  const interfaces = useQuery(api.instrumentIntegration.listInterfaces, labId ? { laboratoryId: labId } : "skip");
  const instruments = useQuery(api.instruments.listInstruments, labId ? { laboratoryId: labId } : "skip");
  const deleteInterface = useMutation(api.instrumentIntegration.deleteInterface);

  const [showForm, setShowForm] = useState(false);
  const [editIface, setEditIface] = useState<Interface | null>(null);
  const [importIface, setImportIface] = useState<Interface | null>(null);

  if (!labId) return <Skeleton className="h-64 w-full" />;

  return (
    <PageGuard allowed={["system_admin", "lab_manager", "supervisor", "analyst"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Cable size={24} className="text-primary" />Instrument Integration</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure data interfaces and import result files from lab instruments</p>
          </div>
          <Button onClick={() => { setEditIface(null); setShowForm(true); }}>
            <Plus size={16} className="mr-2" />New Interface
          </Button>
        </div>

        <Tabs defaultValue="interfaces">
          <TabsList>
            <TabsTrigger value="interfaces">Interface Profiles</TabsTrigger>
            <TabsTrigger value="import">Import Results</TabsTrigger>
            <TabsTrigger value="history">Import History</TabsTrigger>
          </TabsList>

          {/* ── Interface Profiles ── */}
          <TabsContent value="interfaces" className="mt-4">
            {!interfaces ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
              </div>
            ) : interfaces.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Cable /></EmptyMedia>
                  <EmptyTitle>No interfaces configured</EmptyTitle>
                  <EmptyDescription>Create an interface profile to define how each instrument exports data — file format, delimiters, and column mappings.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" onClick={() => { setEditIface(null); setShowForm(true); }}><Plus size={14} className="mr-1" />Create First Interface</Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {interfaces.map((iface) => (
                  <Card key={iface._id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{iface.interfaceName}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{iface.instrumentName} · {iface.instrumentCode}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{iface.fileFormat.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Delimiter: {iface.delimiter ?? "comma"} · Header row: {iface.hasHeaderRow ? "Yes" : "No"}</p>
                        <p>Mapping: {iface.useNamedColumns ? "Named columns" : "Column indices"}</p>
                        {iface.notes && <p className="italic">{iface.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => setImportIface(iface as Interface)}>
                          <Upload size={13} className="mr-1" />Import File
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => { setEditIface(iface as Interface); setShowForm(true); }}>
                          <Settings2 size={13} />
                        </Button>
                        <Button size="sm" variant="secondary" className="text-destructive hover:text-destructive" onClick={async () => { await deleteInterface({ interfaceId: iface._id }); toast.success("Deleted"); }}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Import Results ── */}
          <TabsContent value="import" className="mt-4">
            {!interfaces ? <Skeleton className="h-32 w-full" /> : interfaces.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FileUp /></EmptyMedia>
                  <EmptyTitle>No interfaces yet</EmptyTitle>
                  <EmptyDescription>Create an interface profile first, then come back here to import result files.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select an interface profile, then upload the instrument's exported result file.</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {interfaces.map((iface) => (
                    <Card key={iface._id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setImportIface(iface as Interface)}>
                      <CardContent className="pt-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileUp size={20} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{iface.interfaceName}</p>
                          <p className="text-xs text-muted-foreground">{iface.instrumentName} · {iface.fileFormat.toUpperCase()}</p>
                        </div>
                        <ChevronRight size={16} className="ml-auto text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history" className="mt-4">
            <BatchHistory laboratoryId={labId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Interface Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editIface ? "Edit Interface" : "New Instrument Interface"}</DialogTitle>
          </DialogHeader>
          {labId && instruments && (
            <InterfaceForm
              instruments={instruments as { _id: Id<"instruments">; name: string; instrumentCode: string }[]}
              initial={editIface}
              laboratoryId={labId}
              onClose={() => setShowForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={!!importIface} onOpenChange={() => setImportIface(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Results — {importIface?.interfaceName}</DialogTitle>
          </DialogHeader>
          {importIface && labId && (
            <ImportDialog iface={importIface} laboratoryId={labId} onClose={() => setImportIface(null)} />
          )}
        </DialogContent>
      </Dialog>
    </PageGuard>
  );
}
