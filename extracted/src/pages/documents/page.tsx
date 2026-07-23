import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { cn } from "@/lib/utils.ts";
import {
  FileText, Plus, Search, Eye, Pencil, Trash2,
  BookOpen, FlaskConical, Shield, ClipboardList,
  Layers, CheckSquare, AlertTriangle, File,
  Download, Clock, CheckCircle, FileSearch,
  Upload, X, FileIcon, Loader2,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPES = ["sop", "method", "policy", "form", "specification", "validation", "safety", "other"] as const;
type DocType = typeof DOC_TYPES[number];

const DOC_STATUSES = ["draft", "under_review", "approved", "effective", "superseded", "obsolete"] as const;
type DocStatus = typeof DOC_STATUSES[number];

const STATUS_COLORS: Record<DocStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  effective: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  superseded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  obsolete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const TYPE_LABELS: Record<DocType, string> = {
  sop: "SOP", method: "Method", policy: "Policy", form: "Form",
  specification: "Specification", validation: "Validation", safety: "Safety", other: "Other",
};

function TypeIcon({ type, className }: { type: DocType; className?: string }) {
  const props = { className: cn("size-4", className) };
  switch (type) {
    case "sop": return <BookOpen {...props} />;
    case "method": return <FlaskConical {...props} />;
    case "policy": return <Shield {...props} />;
    case "form": return <ClipboardList {...props} />;
    case "specification": return <Layers {...props} />;
    case "validation": return <CheckSquare {...props} />;
    case "safety": return <AlertTriangle {...props} />;
    default: return <File {...props} />;
  }
}

function StatusBadge({ status }: { status: DocStatus }) {
  const label = status === "under_review" ? "Under Review" : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant="secondary" className={cn("text-xs font-medium", STATUS_COLORS[status])}>{label}</Badge>;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; }
}

// ─── Create/Edit Dialog ──────────────────────────────────────────────────────

type FormData = {
  title: string; type: DocType; version: string; departmentId: string;
  owner: string; effectiveDate: string; reviewDate: string; expiryDate: string;
  description: string; keywords: string; content: string; status: DocStatus;
};

const EMPTY_FORM: FormData = {
  title: "", type: "sop", version: "1.0", departmentId: "", owner: "",
  effectiveDate: "", reviewDate: "", expiryDate: "",
  description: "", keywords: "", content: "", status: "draft",
};

// ─── PDF Upload Widget ───────────────────────────────────────────────────────

type PdfUploadState =
  | { phase: "idle"; existingFileName?: string; existingStorageId?: Id<"_storage"> }
  | { phase: "selected"; file: File }
  | { phase: "uploading"; file: File }
  | { phase: "done"; storageId: Id<"_storage">; fileName: string };

function PdfUploadWidget({
  value,
  onChange,
}: {
  value: PdfUploadState;
  onChange: (s: PdfUploadState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF must be under 25 MB");
      return;
    }
    onChange({ phase: "selected", file });
  }

  function handleClear() {
    onChange({ phase: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasFile = value.phase === "selected" || value.phase === "uploading" || value.phase === "done";
  const existingName = value.phase === "idle" ? value.existingFileName : undefined;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer",
          hasFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
        onClick={() => !hasFile && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={value.phase === "uploading"}
        />
        {value.phase === "uploading" ? (
          <>
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading {value.file.name}…</p>
          </>
        ) : value.phase === "done" ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <FileIcon className="size-5 text-red-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{value.fileName}</p>
              <p className="text-xs text-green-600 font-medium">Uploaded successfully</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleClear(); }}>
              <X className="size-4" />
            </Button>
          </div>
        ) : value.phase === "selected" ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <FileIcon className="size-5 text-red-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{value.file.name}</p>
              <p className="text-xs text-muted-foreground">{(value.file.size / 1024).toFixed(0)} KB · Ready to upload</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleClear(); }}>
              <X className="size-4" />
            </Button>
          </div>
        ) : existingName ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <FileIcon className="size-5 text-red-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{existingName}</p>
              <p className="text-xs text-muted-foreground">Current PDF · Click to replace</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Click to upload PDF</p>
              <p className="text-xs text-muted-foreground">PDF only · Max 25 MB</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DocumentFormDialog({
  open, onClose, labId, editDoc,
}: {
  open: boolean;
  onClose: () => void;
  labId: Id<"laboratories">;
  editDoc?: Record<string, unknown> | null;
}) {
  const departments = useQuery(api.organization.listDepartments, { laboratoryId: labId });
  const users = useQuery(api.users.listUsers, {});
  const createDoc = useMutation(api.documents.createDocument);
  const updateDoc = useMutation(api.documents.updateDocument);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [form, setForm] = useState<FormData>(() => {
    if (!editDoc) return EMPTY_FORM;
    return {
      title: (editDoc.title as string) || "",
      type: (editDoc.type as DocType) || "sop",
      version: (editDoc.version as string) || "1.0",
      departmentId: (editDoc.departmentId as string) || "",
      owner: (editDoc.owner as string) || "",
      effectiveDate: (editDoc.effectiveDate as string) || "",
      reviewDate: (editDoc.reviewDate as string) || "",
      expiryDate: (editDoc.expiryDate as string) || "",
      description: (editDoc.description as string) || "",
      keywords: Array.isArray(editDoc.keywords) ? (editDoc.keywords as string[]).join(", ") : "",
      content: (editDoc.content as string) || "",
      status: (editDoc.status as DocStatus) || "draft",
    };
  });

  const [pdfState, setPdfState] = useState<PdfUploadState>(() => ({
    phase: "idle",
    existingFileName: (editDoc?.fileName as string | undefined),
    existingStorageId: (editDoc?.fileStorageId as Id<"_storage"> | undefined),
  }));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Upload the selected PDF to Convex storage and return storageId
  async function uploadPdf(file: File): Promise<Id<"_storage">> {
    setPdfState({ phase: "uploading", file });
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    if (!result.ok) throw new Error("Upload failed");
    const { storageId } = await result.json() as { storageId: Id<"_storage"> };
    setPdfState({ phase: "done", storageId, fileName: file.name });
    return storageId;
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.version.trim()) { toast.error("Version is required"); return; }
    setSaving(true);
    const keywordsArr = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);

    try {
      // Handle PDF upload if a file is selected
      let fileStorageId: Id<"_storage"> | undefined;
      let fileName: string | undefined;

      if (pdfState.phase === "selected") {
        fileStorageId = await uploadPdf(pdfState.file);
        fileName = pdfState.file.name;
      } else if (pdfState.phase === "done") {
        fileStorageId = pdfState.storageId;
        fileName = pdfState.fileName;
      } else if (pdfState.phase === "idle" && pdfState.existingStorageId) {
        // Keep existing
        fileStorageId = pdfState.existingStorageId;
        fileName = pdfState.existingFileName;
      }

      if (editDoc) {
        await updateDoc({
          documentId: editDoc._id as Id<"documents">,
          title: form.title,
          type: form.type,
          version: form.version,
          status: form.status,
          departmentId: form.departmentId ? (form.departmentId as Id<"departments">) : undefined,
          owner: form.owner ? (form.owner as Id<"users">) : undefined,
          effectiveDate: form.effectiveDate || undefined,
          reviewDate: form.reviewDate || undefined,
          expiryDate: form.expiryDate || undefined,
          fileStorageId,
          fileName,
          description: form.description || undefined,
          keywords: keywordsArr.length > 0 ? keywordsArr : undefined,
          content: form.content || undefined,
        });
        toast.success("Document updated");
      } else {
        await createDoc({
          laboratoryId: labId,
          title: form.title,
          type: form.type,
          version: form.version,
          departmentId: form.departmentId ? (form.departmentId as Id<"departments">) : undefined,
          owner: form.owner ? (form.owner as Id<"users">) : undefined,
          effectiveDate: form.effectiveDate || undefined,
          reviewDate: form.reviewDate || undefined,
          expiryDate: form.expiryDate || undefined,
          fileStorageId,
          fileName,
          description: form.description || undefined,
          keywords: keywordsArr.length > 0 ? keywordsArr : undefined,
          content: form.content || undefined,
        });
        toast.success("Document created");
      }
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editDoc ? "Edit Document" : "New Document"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Sample Preparation SOP" />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Version *</Label>
            <Input value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="e.g. 1.0" />
          </div>
          {editDoc && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s === "under_review" ? "Under Review" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Department</Label>
            <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Owner</Label>
            <Select value={form.owner} onValueChange={(v) => set("owner", v)}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u._id} value={u._id}>{u.name || u.email || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Effective Date</Label>
            <Input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Review Date</Label>
            <Input type="date" value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Expiry Date</Label>
            <Input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
          </div>

          {/* PDF Upload — spans full width */}
          <div className="col-span-2 space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Upload className="size-3.5" /> Document File (PDF only)
            </Label>
            <PdfUploadWidget value={pdfState} onChange={setPdfState} />
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Brief description of the document" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Keywords (comma-separated)</Label>
            <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="e.g. safety, chemicals, handling" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Content</Label>
            <Textarea rows={5} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="Document content or summary..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || pdfState.phase === "uploading"} className="cursor-pointer">
            {saving || pdfState.phase === "uploading" ? (
              <><Loader2 className="size-4 mr-1.5 animate-spin" />{pdfState.phase === "uploading" ? "Uploading PDF…" : "Saving…"}</>
            ) : (
              editDoc ? "Update Document" : "Create Document"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── View Dialog ─────────────────────────────────────────────────────────────

function DocumentViewDialog({
  open, onClose, doc,
}: {
  open: boolean;
  onClose: () => void;
  doc: Record<string, unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon type={doc.type as DocType} />
            {doc.title as string}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Document #:</span>
              <p className="font-medium">{doc.documentNumber as string}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="mt-0.5"><StatusBadge status={doc.status as DocStatus} /></p>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <p className="font-medium">{TYPE_LABELS[doc.type as DocType]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Version:</span>
              <p className="font-medium">{doc.version as string}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Department:</span>
              <p className="font-medium">{(doc.departmentName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Owner:</span>
              <p className="font-medium">{(doc.ownerName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Effective Date:</span>
              <p className="font-medium">{formatDate(doc.effectiveDate as string | undefined)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Review Date:</span>
              <p className="font-medium">{formatDate(doc.reviewDate as string | undefined)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Expiry Date:</span>
              <p className="font-medium">{formatDate(doc.expiryDate as string | undefined)}</p>
            </div>
          </div>

          {doc.description ? (
            <div>
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="text-sm mt-1">{String(doc.description)}</p>
            </div>
          ) : null}

          {Array.isArray(doc.keywords) && (doc.keywords as string[]).length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Keywords:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(doc.keywords as string[]).map((k) => (
                  <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                ))}
              </div>
            </div>
          )}

          {doc.content ? (
            <div>
              <span className="text-sm text-muted-foreground">Content:</span>
              <div className="mt-1 rounded-md border p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto bg-muted/30">
                {String(doc.content)}
              </div>
            </div>
          ) : null}

          {doc.resolvedFileUrl ? (
            <a
              href={String(doc.resolvedFileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
            >
              <Download className="size-4" />
              {doc.fileName ? `Download ${String(doc.fileName)}` : "Download PDF"}
            </a>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page Content ───────────────────────────────────────────────────────

function DocumentManagementContent() {
  const { labId } = useActiveLab();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Record<string, unknown> | null>(null);
  const [viewDoc, setViewDoc] = useState<Record<string, unknown> | null>(null);

  const documents = useQuery(
    api.documents.listDocuments,
    labId
      ? {
          laboratoryId: labId,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        }
      : "skip",
  );
  const deleteDoc = useMutation(api.documents.deleteDocument);

  // Compute stats
  const stats = useMemo(() => {
    if (!documents) return { total: 0, effective: 0, underReview: 0, expiringSoon: 0 };
    const now = new Date();
    const thirtyDays = addDays(now, 30);
    return {
      total: documents.length,
      effective: documents.filter((d) => d.status === "effective").length,
      underReview: documents.filter((d) => d.status === "under_review").length,
      expiringSoon: documents.filter((d) => {
        if (!d.expiryDate) return false;
        try {
          const exp = parseISO(d.expiryDate);
          return isBefore(exp, thirtyDays) && !isBefore(exp, now);
        } catch { return false; }
      }).length,
    };
  }, [documents]);

  // Client-side text search
  const filtered = useMemo(() => {
    if (!documents) return [];
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.documentNumber.toLowerCase().includes(q) ||
        (d.ownerName && d.ownerName.toLowerCase().includes(q)) ||
        (d.departmentName && d.departmentName.toLowerCase().includes(q)),
    );
  }, [documents, search]);

  const handleDelete = async (docId: Id<"documents">, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will mark the document as obsolete.`)) return;
    try {
      await deleteDoc({ documentId: docId });
      toast.success("Document deleted");
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to delete document");
    }
  };

  if (!labId) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" />
            Document Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            SOPs, Methods, Policies & Controlled Documents
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
          <Plus className="size-4 mr-1" />
          New Document
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{documents ? stats.total : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Effective</CardTitle>
            <CheckCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{documents ? stats.effective : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Under Review</CardTitle>
            <FileSearch className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{documents ? stats.underReview : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            <Clock className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{documents ? stats.expiringSoon : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, document #, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DOC_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "under_review" ? "Under Review" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document Table */}
      {!documents ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>No documents found</EmptyTitle>
            <EmptyDescription>
              {search || typeFilter || statusFilter
                ? "Try adjusting your filters"
                : "Get started by creating your first controlled document"}
            </EmptyDescription>
          </EmptyHeader>
          {!search && !typeFilter && !statusFilter && (
            <EmptyContent>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="cursor-pointer">
                <Plus className="size-4 mr-1" /> Create Document
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium">Document #</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Version</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Department</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Owner</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Effective</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Review</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc._id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{doc.documentNumber}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{doc.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <TypeIcon type={doc.type as DocType} className="text-muted-foreground" />
                      <span className="hidden sm:inline">{TYPE_LABELS[doc.type as DocType]}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{doc.version}</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status as DocStatus} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{doc.departmentName || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{doc.ownerName || "—"}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">{formatDate(doc.effectiveDate)}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">{formatDate(doc.reviewDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer"
                        onClick={() => setViewDoc(doc as unknown as Record<string, unknown>)}
                        title="View"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer"
                        onClick={() => setEditDoc(doc as unknown as Record<string, unknown>)}
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive cursor-pointer"
                        onClick={() => handleDelete(doc._id, doc.title)}
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <DocumentFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          labId={labId}
        />
      )}

      {/* Edit Dialog */}
      {editDoc && (
        <DocumentFormDialog
          key={editDoc._id as string}
          open={!!editDoc}
          onClose={() => setEditDoc(null)}
          labId={labId}
          editDoc={editDoc}
        />
      )}

      {/* View Dialog */}
      {viewDoc && (
        <DocumentViewDialog
          open={!!viewDoc}
          onClose={() => setViewDoc(null)}
          doc={viewDoc}
        />
      )}
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function DocumentManagementPage() {
  return (
    <Authenticated>
      <PageGuard allowed={["system_admin", "lab_manager", "supervisor", "qa_officer"]}>
        <DocumentManagementContent />
      </PageGuard>
    </Authenticated>
  );
}
