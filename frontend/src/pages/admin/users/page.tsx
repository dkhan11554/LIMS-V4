import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { RoleBadge } from "@/components/ui/role-badge.tsx";
import { PageGuard } from "@/components/rbac/role-guard.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty.tsx";
import { ALL_ROLES, ROLE_LABELS, type LimsRole } from "@/hooks/use-role.ts";
import {
  Plus, Users, Pencil, Archive, UserCog, Search, Eye,
  Power, PowerOff, Mail, Phone, Building2, MapPin, Briefcase,
  Clock, Globe, ChevronDown, ChevronUp, Download, Upload,
  CheckSquare, Square, AlertCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow } from "date-fns";
import Papa from "papaparse";
import type { Id } from "@/convex/_generated/dataModel.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type User = {
  _id: Id<"users">;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  employeeNumber?: string;
  phone?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isArchived?: boolean;
  accountStatus?: string;
  jobTitle?: string;
  designation?: string;
  businessUnit?: string;
  siteLocation?: string;
  costCenter?: string;
  employmentType?: string;
  managerId?: string;
  supervisorId?: string;
  managerName?: string;
  supervisorName?: string;
  departmentName?: string;
  timezone?: string;
  language?: string;
  avatarUrl?: string;
  bio?: string;
  lastLoginAt?: string;
  _creationTime?: number;
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "temporary", label: "Temporary" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ur", label: "Urdu" },
];

type FormState = {
  name: string; firstName: string; lastName: string;
  email: string; role: LimsRole; employeeNumber: string; phone: string;
  jobTitle: string; designation: string; businessUnit: string;
  siteLocation: string; costCenter: string; employmentType: string;
  managerId: string; supervisorId: string;
  timezone: string; language: string;
};

const EMPTY_FORM: FormState = {
  name: "", firstName: "", lastName: "", email: "", role: "analyst",
  employeeNumber: "", phone: "", jobTitle: "", designation: "",
  businessUnit: "", siteLocation: "", costCenter: "", employmentType: "",
  managerId: "", supervisorId: "", timezone: "", language: "",
};

// CSV template columns for import
const CSV_IMPORT_COLUMNS = [
  "name", "firstName", "lastName", "email", "role",
  "employeeNumber", "phone", "jobTitle", "designation",
  "businessUnit", "siteLocation", "costCenter", "employmentType",
  "timezone", "language",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AccountStatusBadge({ user }: { user: User }) {
  if (user.isArchived) return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs">Archived</Badge>;
  if (user.isDisabled || user.accountStatus === "suspended") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Suspended</Badge>;
  if (user.isActive === false || user.accountStatus === "inactive") return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">Inactive</Badge>;
  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Active</Badge>;
}

function UserAvatar({ user, size = "sm" }: { user: User; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-xl" : size === "md" ? "w-10 h-10 text-base" : "w-8 h-8 text-xs";
  const initials = (user.name ?? user.email ?? "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name ?? ""} className={cn("rounded-full object-cover shrink-0", dim)} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div className={cn("rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0", dim)}>
      {initials}
    </div>
  );
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────

type ImportRow = {
  name?: string; firstName?: string; lastName?: string; email?: string;
  role?: string; employeeNumber?: string; phone?: string; jobTitle?: string;
  designation?: string; businessUnit?: string; siteLocation?: string;
  costCenter?: string; employmentType?: string; timezone?: string; language?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function CsvImportModal({
  open, onClose, onComplete,
}: {
  open: boolean; onClose: () => void; onComplete: (result: ImportResult) => void;
}) {
  const createUser = useMutation(api.users.createUser);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    const sample: ImportRow[] = [
      { name: "John Smith", firstName: "John", lastName: "Smith", email: "john@lab.com", role: "analyst", employeeNumber: "EMP-001", jobTitle: "Senior Analyst", businessUnit: "Analytical", siteLocation: "Lab A", timezone: "UTC", language: "en" },
    ];
    const csv = Papa.unparse([CSV_IMPORT_COLUMNS.reduce<Record<string, string>>((acc, k) => { acc[k] = ""; return acc; }, {}), ...sample.map((r) => ({ ...r }))], { columns: CSV_IMPORT_COLUMNS, header: true });
    downloadCsv(csv, "users-import-template.csv");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setRows([]);
    setFileName(file.name);
    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0].message);
          return;
        }
        setRows(result.data);
      },
      error: (err) => setParseError(err.message),
    });
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name?.trim() && !row.email?.trim()) {
        skipped++;
        continue;
      }
      if (!row.email?.trim() || !row.email.includes("@")) {
        errors.push(`Row ${i + 2}: Invalid or missing email "${row.email ?? ""}"`);
        skipped++;
        continue;
      }
      const validRoles: LimsRole[] = ["system_admin", "lab_manager", "supervisor", "analyst", "qa_officer", "reception", "customer"];
      const role = (validRoles.includes(row.role as LimsRole) ? row.role : "analyst") as LimsRole;
      try {
        await createUser({
          name: row.name?.trim() || row.email,
          firstName: row.firstName?.trim() || undefined,
          lastName: row.lastName?.trim() || undefined,
          email: row.email.trim(),
          role,
          employeeNumber: row.employeeNumber?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          jobTitle: row.jobTitle?.trim() || undefined,
          designation: row.designation?.trim() || undefined,
          businessUnit: row.businessUnit?.trim() || undefined,
          siteLocation: row.siteLocation?.trim() || undefined,
          costCenter: row.costCenter?.trim() || undefined,
          employmentType: row.employmentType?.trim() || undefined,
          timezone: row.timezone?.trim() || undefined,
          language: row.language?.trim() || undefined,
        });
        imported++;
      } catch {
        errors.push(`Row ${i + 2}: Failed to create user "${row.name ?? row.email}"`);
        skipped++;
      }
    }

    setImporting(false);
    onComplete({ imported, skipped, errors });
    onClose();
  }

  function handleClose() {
    setRows([]);
    setParseError("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const validRows = rows.filter((r) => (r.name?.trim() || r.email?.trim()) && r.email?.includes("@"));
  const invalidCount = rows.length - validRows.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload size={17} />Import Users from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Need a template?</p>
              <p className="text-xs text-muted-foreground">Download and fill in the CSV template</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
              <Download size={13} className="mr-1.5" />Template
            </Button>
          </div>

          {/* Required columns hint */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">Required columns:</p>
            <p><span className="font-medium text-foreground">email</span> (required), <span className="font-medium text-foreground">name</span> (required)</p>
            <p>Optional: firstName, lastName, role, employeeNumber, phone, jobTitle, designation, businessUnit, siteLocation, costCenter, employmentType, timezone, language</p>
            <p className="mt-1">Role must be one of: <span className="font-mono">analyst</span>, <span className="font-mono">lab_manager</span>, <span className="font-mono">supervisor</span>, <span className="font-mono">qa_officer</span>, <span className="font-mono">reception</span>, <span className="font-mono">customer</span>, <span className="font-mono">system_admin</span>. Defaults to <span className="font-mono">analyst</span> if empty/invalid.</p>
          </div>

          {/* File picker */}
          <div className="space-y-1.5">
            <Label>Upload CSV File</Label>
            <Input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="cursor-pointer" />
            {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <p>{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                <p className="text-sm font-medium">{rows.length} rows detected</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-700 dark:text-green-400 flex items-center gap-1"><CheckCircle2 size={11} />{validRows.length} valid</span>
                  {invalidCount > 0 && <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle size={11} />{invalidCount} will be skipped</span>}
                </div>
              </div>
              {/* Preview table — first 5 rows */}
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      {["name", "email", "role", "jobTitle", "siteLocation"].map((col) => (
                        <th key={col} className="text-left px-3 py-1.5 font-medium text-muted-foreground">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className={cn("border-b last:border-0", (!row.email?.includes("@") || !row.name?.trim()) && "bg-red-50 dark:bg-red-950/20")}>
                        {["name", "email", "role", "jobTitle", "siteLocation"].map((col) => (
                          <td key={col} className="px-3 py-1.5 truncate max-w-[120px]">{(row as Record<string, string | undefined>)[col] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                    {rows.length > 5 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-1.5 text-center text-muted-foreground">…and {rows.length - 5} more rows</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
            {importing ? <><Spinner className="mr-2 w-4 h-4" />Importing…</> : <><Upload size={13} className="mr-1.5" />Import {validRows.length > 0 ? `${validRows.length} Users` : ""}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── User detail modal ─────────────────────────────────────────────────────────

function UserDetailModal({ user, open, onClose, onEdit }: { user: User; open: boolean; onClose: () => void; onEdit: () => void }) {
  const rows: { label: string; value: string | undefined }[] = [
    { label: "Employee #", value: user.employeeNumber },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone },
    { label: "Job Title", value: user.jobTitle },
    { label: "Designation", value: user.designation },
    { label: "Department", value: user.departmentName },
    { label: "Business Unit", value: user.businessUnit },
    { label: "Site / Location", value: user.siteLocation },
    { label: "Cost Center", value: user.costCenter },
    { label: "Employment Type", value: EMPLOYMENT_TYPES.find((e) => e.value === user.employmentType)?.label ?? user.employmentType },
    { label: "Manager", value: user.managerName },
    { label: "Supervisor", value: user.supervisorName },
    { label: "Timezone", value: user.timezone },
    { label: "Language", value: LANGUAGES.find((l) => l.value === user.language)?.label ?? user.language },
    { label: "Last Login", value: user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : undefined },
    { label: "Account Created", value: user._creationTime ? formatDistanceToNow(new Date(user._creationTime), { addSuffix: true }) : undefined },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div>
              <h3 className="text-lg font-bold">{user.name ?? "—"}</h3>
              {user.jobTitle && <p className="text-sm text-muted-foreground">{user.jobTitle}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <RoleBadge role={user.role} />
                <AccountStatusBadge user={user} />
              </div>
            </div>
          </div>
          {user.bio && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 italic">{user.bio}</p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {rows.filter((r) => r.value).map((r) => (
              <div key={r.label}>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="font-medium truncate">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => { onClose(); onEdit(); }}><Pencil size={13} className="mr-1.5" />Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create / Edit form ────────────────────────────────────────────────────────

function UserFormModal({ open, title, form, setForm, onSubmit, isSubmitting, onClose, allUsers }: {
  open: boolean; title: string;
  form: FormState; setForm: (f: FormState) => void;
  onSubmit: () => void; isSubmitting: boolean; onClose: () => void;
  allUsers: User[];
}) {
  const [tab, setTab] = useState<"basic" | "employment" | "org">("basic");
  const f = (key: keyof FormState, value: string) => setForm({ ...form, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog size={18} />{title}</DialogTitle>
        </DialogHeader>
        <div className="flex border-b gap-4 -mt-1 mb-1">
          {([["basic", "Basic Info"], ["employment", "Employment"], ["org", "Organisation"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn(
              "text-sm pb-2 border-b-2 font-medium transition-colors cursor-pointer",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{label}</button>
          ))}
        </div>

        {tab === "basic" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>First Name</Label><Input value={form.firstName} onChange={(e) => f("firstName", e.target.value)} placeholder="John" /></div>
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => f("lastName", e.target.value)} placeholder="Smith" /></div>
            <div className="space-y-1 col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="John Smith" /></div>
            <div className="space-y-1 col-span-2"><Label>Email Address *</Label><Input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="john.smith@company.com" /></div>
            <div className="space-y-1"><Label>Employee Number</Label><Input value={form.employeeNumber} onChange={(e) => f("employeeNumber", e.target.value)} placeholder="EMP-001" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+1 555 0000" /></div>
            <div className="space-y-1 col-span-2">
              <Label>System Role *</Label>
              <Select value={form.role} onValueChange={(v) => f("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        {tab === "employment" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Job Title</Label><Input value={form.jobTitle} onChange={(e) => f("jobTitle", e.target.value)} placeholder="Senior Analyst" /></div>
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Designation</Label><Input value={form.designation} onChange={(e) => f("designation", e.target.value)} placeholder="Chemist II" /></div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label>Employment Type</Label>
              <Select value={form.employmentType || "none"} onValueChange={(v) => f("employmentType", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not specified</SelectItem>{EMPLOYMENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Cost Center</Label><Input value={form.costCenter} onChange={(e) => f("costCenter", e.target.value)} placeholder="CC-1234" /></div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label>Timezone</Label>
              <Select value={form.timezone || "none"} onValueChange={(v) => f("timezone", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select timezone…" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not specified</SelectItem>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label>Language</Label>
              <Select value={form.language || "none"} onValueChange={(v) => f("language", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not specified</SelectItem>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        {tab === "org" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Business Unit</Label><Input value={form.businessUnit} onChange={(e) => f("businessUnit", e.target.value)} placeholder="Analytical Services" /></div>
            <div className="space-y-1 col-span-2 md:col-span-1"><Label>Site / Location</Label><Input value={form.siteLocation} onChange={(e) => f("siteLocation", e.target.value)} placeholder="Karachi – Lab A" /></div>
            <div className="space-y-1 col-span-2">
              <Label>Manager</Label>
              <Select value={form.managerId || "none"} onValueChange={(v) => f("managerId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select manager…" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{allUsers.map((u) => <SelectItem key={u._id} value={u._id}>{u.name ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Supervisor</Label>
              <Select value={form.supervisorId || "none"} onValueChange={(v) => f("supervisorId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select supervisor…" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{allUsers.map((u) => <SelectItem key={u._id} value={u._id}>{u.name ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save User"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  return (
    <PageGuard allowed={["system_admin", "lab_manager"]}>
      <UsersPageInner />
    </PageGuard>
  );
}

function UsersPageInner() {
  const users = useQuery(api.users.listUsers, {}) as User[] | undefined;
  const createUser = useMutation(api.users.createUser);
  const updateUser = useMutation(api.users.updateUser);
  const archiveUser = useMutation(api.users.archiveUser);
  const setUserEnabled = useMutation(api.users.setUserEnabled);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<LimsRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended">("all");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  // ── Role counts ─────────────────────────────────────────────────────────────

  const roleCounts = ALL_ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (users ?? []).filter((u) => u.role === r).length;
    return acc;
  }, {});

  // ── Filtered users ───────────────────────────────────────────────────────────

  const filtered = (users ?? []).filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (u.name ?? "").toLowerCase().includes(q)
      || (u.email ?? "").toLowerCase().includes(q)
      || (u.employeeNumber ?? "").toLowerCase().includes(q)
      || (u.jobTitle ?? "").toLowerCase().includes(q)
      || (u.departmentName ?? "").toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const status = u.isArchived ? "archived" : u.isDisabled ? "suspended" : u.isActive !== false ? "active" : "inactive";
    const matchStatus = statusFilter === "all" || status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  // Bulk selection helpers
  const filteredNonArchived = filtered.filter((u) => !u.isArchived);
  const allSelected = filteredNonArchived.length > 0 && filteredNonArchived.every((u) => selectedIds.has(u._id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNonArchived.map((u) => u._id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  async function handleBulkEnable() {
    const ids = [...selectedIds];
    setBulkWorking(true);
    let count = 0;
    for (const id of ids) {
      try { await setUserEnabled({ id: id as Id<"users">, enabled: true }); count++; }
      catch { /* skip */ }
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    toast.success(`${count} user(s) enabled`);
  }

  async function handleBulkDisable() {
    const ids = [...selectedIds];
    setBulkWorking(true);
    let count = 0;
    for (const id of ids) {
      try { await setUserEnabled({ id: id as Id<"users">, enabled: false }); count++; }
      catch { /* skip */ }
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    toast.success(`${count} user(s) disabled`);
  }

  // ── CSV Export ───────────────────────────────────────────────────────────────

  function handleExportCsv() {
    const exportData = filtered.map((u) => ({
      "Employee #": u.employeeNumber ?? "",
      "Full Name": u.name ?? "",
      "First Name": u.firstName ?? "",
      "Last Name": u.lastName ?? "",
      "Email": u.email ?? "",
      "Role": ROLE_LABELS[u.role as LimsRole] ?? u.role ?? "",
      "Job Title": u.jobTitle ?? "",
      "Designation": u.designation ?? "",
      "Business Unit": u.businessUnit ?? "",
      "Site/Location": u.siteLocation ?? "",
      "Cost Center": u.costCenter ?? "",
      "Employment Type": EMPLOYMENT_TYPES.find((e) => e.value === u.employmentType)?.label ?? u.employmentType ?? "",
      "Timezone": u.timezone ?? "",
      "Language": LANGUAGES.find((l) => l.value === u.language)?.label ?? u.language ?? "",
      "Phone": u.phone ?? "",
      "Account Status": u.isArchived ? "Archived" : u.isDisabled ? "Suspended" : u.isActive !== false ? "Active" : "Inactive",
      "Last Login": u.lastLoginAt ?? "",
      "Account Created": u._creationTime ? new Date(u._creationTime).toISOString() : "",
    }));
    const csv = Papa.unparse(exportData, { quotes: true, header: true });
    downloadCsv(csv, `lims-users-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success(`Exported ${exportData.length} users`);
  }

  // ── User CRUD ─────────────────────────────────────────────────────────────────

  function openCreate() { setForm(EMPTY_FORM); setCreateOpen(true); }

  function openEdit(u: User) {
    setForm({
      name: u.name ?? "", firstName: u.firstName ?? "", lastName: u.lastName ?? "",
      email: u.email ?? "", role: (u.role as LimsRole) ?? "analyst",
      employeeNumber: u.employeeNumber ?? "", phone: u.phone ?? "",
      jobTitle: u.jobTitle ?? "", designation: u.designation ?? "",
      businessUnit: u.businessUnit ?? "", siteLocation: u.siteLocation ?? "",
      costCenter: u.costCenter ?? "", employmentType: u.employmentType ?? "",
      managerId: u.managerId ?? "", supervisorId: u.supervisorId ?? "",
      timezone: u.timezone ?? "", language: u.language ?? "",
    });
    setEditUser(u);
  }

  async function handleCreate() {
    if (!form.name.trim()) return toast.error("Full name is required");
    if (!form.email.trim()) return toast.error("Email is required");
    setIsSubmitting(true);
    try {
      await createUser({
        name: form.name, firstName: form.firstName || undefined, lastName: form.lastName || undefined,
        email: form.email, role: form.role,
        employeeNumber: form.employeeNumber || undefined, phone: form.phone || undefined,
        jobTitle: form.jobTitle || undefined, designation: form.designation || undefined,
        businessUnit: form.businessUnit || undefined, siteLocation: form.siteLocation || undefined,
        costCenter: form.costCenter || undefined, employmentType: form.employmentType || undefined,
        managerId: form.managerId ? (form.managerId as Id<"users">) : undefined,
        supervisorId: form.supervisorId ? (form.supervisorId as Id<"users">) : undefined,
        timezone: form.timezone || undefined, language: form.language || undefined,
      });
      setCreateOpen(false);
      toast.success(`User ${form.name} created`);
    } catch { toast.error("Failed to create user"); }
    finally { setIsSubmitting(false); }
  }

  async function handleEdit() {
    if (!editUser) return;
    setIsSubmitting(true);
    try {
      await updateUser({
        id: editUser._id, name: form.name || undefined, firstName: form.firstName || undefined,
        lastName: form.lastName || undefined, email: form.email || undefined, role: form.role,
        employeeNumber: form.employeeNumber || undefined, phone: form.phone || undefined,
        jobTitle: form.jobTitle || undefined, designation: form.designation || undefined,
        businessUnit: form.businessUnit || undefined, siteLocation: form.siteLocation || undefined,
        costCenter: form.costCenter || undefined, employmentType: form.employmentType || undefined,
        managerId: form.managerId ? (form.managerId as Id<"users">) : undefined,
        supervisorId: form.supervisorId ? (form.supervisorId as Id<"users">) : undefined,
        timezone: form.timezone || undefined, language: form.language || undefined,
      });
      setEditUser(null); toast.success("User updated");
    } catch { toast.error("Failed to update user"); }
    finally { setIsSubmitting(false); }
  }

  async function handleArchive(u: User) {
    if (!confirm(`Archive "${u.name}"? They will no longer be able to log in, but all their records are retained.`)) return;
    try { await archiveUser({ id: u._id }); toast.success(`${u.name} archived`); }
    catch { toast.error("Failed to archive user"); }
  }

  async function handleToggleEnabled(u: User) {
    const enable = u.isDisabled || u.isActive === false;
    try {
      await setUserEnabled({ id: u._id, enabled: enable });
      toast.success(`${u.name} ${enable ? "enabled" : "disabled"}`);
    } catch { toast.error("Failed to update account status"); }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
            <p className="text-sm text-muted-foreground">{users?.length ?? 0} system users · Manage roles and access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleExportCsv} disabled={!users || users.length === 0} title="Export visible users to CSV">
            <Download size={13} className="mr-1.5" />Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} title="Import users from CSV">
            <Upload size={13} className="mr-1.5" />Import CSV
          </Button>
          <Button onClick={openCreate}><Plus size={14} className="mr-1.5" />Add User</Button>
        </div>
      </div>

      {/* Role summary cards */}
      {users ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? "all" : r)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all cursor-pointer",
                roleFilter === r ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-muted/50"
              )}
            >
              <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[r]}</p>
              <p className="text-xl font-bold mt-0.5">{roleCounts[r] ?? 0}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search by name, email, or employee #…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as LimsRole | "all")}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button variant="ghost" size="sm" className="h-7 text-green-700 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30" onClick={handleBulkEnable} disabled={bulkWorking}>
              {bulkWorking ? <Spinner className="w-3 h-3 mr-1" /> : <Power size={13} className="mr-1" />}Bulk Enable
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-yellow-700 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30" onClick={handleBulkDisable} disabled={bulkWorking}>
              {bulkWorking ? <Spinner className="w-3 h-3 mr-1" /> : <PowerOff size={13} className="mr-1" />}Bulk Disable
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* User list */}
      {!users ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>No users found</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openCreate}><Plus size={13} className="mr-1.5" />Add User</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all"
              className="cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">
              {allSelected ? "Deselect all" : `Select all ${filteredNonArchived.length} non-archived`}
            </span>
          </div>

          <div className="space-y-2">
            {filtered.map((u) => {
              const isExpanded = expandedCard === u._id;
              const isSelected = selectedIds.has(u._id);
              return (
                <Card key={u._id} className={cn(
                  "transition-all",
                  u.isArchived && "opacity-60",
                  isSelected && "border-primary/50 shadow-sm"
                )}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-3">
                      {/* Checkbox */}
                      {!u.isArchived && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(u._id)}
                          aria-label={`Select ${u.name}`}
                          className="cursor-pointer shrink-0"
                        />
                      )}
                      {u.isArchived && <div className="w-4 shrink-0" />}

                      <UserAvatar user={u} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{u.name ?? u.email ?? "Unknown"}</span>
                          <AccountStatusBadge user={u} />
                          <RoleBadge role={u.role} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {u.employeeNumber && <span className="text-xs text-muted-foreground flex items-center gap-1"><UserCog size={10} />{u.employeeNumber}</span>}
                          {u.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} />{u.email}</span>}
                          {u.jobTitle && <span className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase size={10} />{u.jobTitle}</span>}
                          {u.siteLocation && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} />{u.siteLocation}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => setViewUser(u)} title="View profile"><Eye size={14} /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => openEdit(u)} title="Edit"><Pencil size={14} /></Button>
                        {!u.isArchived && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => handleToggleEnabled(u)} title={u.isDisabled || u.isActive === false ? "Enable account" : "Disable account"}>
                            {u.isDisabled || u.isActive === false ? <Power size={14} className="text-green-600" /> : <PowerOff size={14} className="text-yellow-600" />}
                          </Button>
                        )}
                        {!u.isArchived && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer text-destructive hover:text-destructive" onClick={() => handleArchive(u)} title="Archive user"><Archive size={14} /></Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : u._id)}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t px-4 pb-3 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                        {[
                          { icon: <Phone size={12} />, label: "Phone", value: u.phone },
                          { icon: <Building2 size={12} />, label: "Business Unit", value: u.businessUnit },
                          { icon: <MapPin size={12} />, label: "Site", value: u.siteLocation },
                          { icon: <Globe size={12} />, label: "Timezone", value: u.timezone },
                          { icon: <UserCog size={12} />, label: "Manager", value: u.managerName },
                          { icon: <UserCog size={12} />, label: "Supervisor", value: u.supervisorName },
                          { icon: <Briefcase size={12} />, label: "Employment", value: EMPLOYMENT_TYPES.find((e) => e.value === u.employmentType)?.label },
                          { icon: <Clock size={12} />, label: "Last Login", value: u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : undefined },
                        ].filter((r) => r.value).map((r) => (
                          <div key={r.label} className="flex items-start gap-1.5">
                            <span className="text-muted-foreground mt-0.5 shrink-0">{r.icon}</span>
                            <div>
                              <p className="text-xs text-muted-foreground">{r.label}</p>
                              <p className="font-medium text-xs">{r.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      <UserFormModal
        open={createOpen} title="Add New User"
        form={form} setForm={setForm}
        onSubmit={handleCreate} isSubmitting={isSubmitting}
        onClose={() => setCreateOpen(false)}
        allUsers={users ?? []}
      />
      {editUser && (
        <UserFormModal
          open={!!editUser} title={`Edit — ${editUser.name}`}
          form={form} setForm={setForm}
          onSubmit={handleEdit} isSubmitting={isSubmitting}
          onClose={() => setEditUser(null)}
          allUsers={(users ?? []).filter((u) => u._id !== editUser._id)}
        />
      )}
      {viewUser && (
        <UserDetailModal
          user={viewUser} open={!!viewUser}
          onClose={() => setViewUser(null)}
          onEdit={() => openEdit(viewUser)}
        />
      )}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={(result) => {
          if (result.imported > 0) toast.success(`Imported ${result.imported} user(s) successfully`);
          if (result.skipped > 0) toast.error(`${result.skipped} row(s) skipped or failed`);
          if (result.errors.length > 0) {
            result.errors.slice(0, 3).forEach((e) => toast.error(e));
          }
        }}
      />
    </div>
  );
}
