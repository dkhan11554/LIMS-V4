import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { RoleBadge } from "@/components/ui/role-badge.tsx";
import { toast } from "sonner";
import {
  Camera, User, Mail, Phone, Briefcase, FileText, Shield, Save,
  Building2, MapPin, Globe, Clock, Languages, BadgeCheck,
  Upload, X, CheckCircle2, FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.js";

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

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── File Upload Widget ───────────────────────────────────────────────────────

type FileField = "avatarUrl" | "digitalSignatureUrl";

type FileUploadWidgetProps = {
  label: string;
  hint: string;
  accept: string;
  acceptLabel: string;
  currentUrl?: string;
  previewType: "avatar" | "signature";
  field: FileField;
  onUploaded: (url: string, field: FileField) => void;
};

function FileUploadWidget({
  label, hint, accept, acceptLabel, currentUrl, previewType, field, onUploaded,
}: FileUploadWidgetProps) {
  const generateUploadUrl = useMutation(api.users.generateProfileUploadUrl);
  const saveProfileFile = useMutation(api.users.saveProfileFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const displayUrl = uploadedUrl ?? currentUrl;

  async function uploadFile(file: File) {
    // Validate type
    const allowedTypes = accept.split(",").map((s) => s.trim());
    const isAllowed = allowedTypes.some((t) => {
      if (t.endsWith("/*")) return file.type.startsWith(t.replace("/*", ""));
      return file.type === t || file.name.toLowerCase().endsWith(t.replace(".", "").toLowerCase());
    });
    if (!isAllowed) {
      toast.error(`Invalid file type. Allowed: ${acceptLabel}`);
      return;
    }
    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }

    // Local preview
    if (file.type.startsWith("image/")) {
      setLocalPreview(URL.createObjectURL(file));
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const url = await saveProfileFile({ field, storageId }) as string;
      setUploadedUrl(url);
      onUploaded(url, field);
      toast.success(`${label} uploaded successfully`);
    } catch {
      toast.error(`Failed to upload ${label.toLowerCase()}`);
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file).catch(() => null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file).catch(() => null);
  }

  function handleRemove() {
    setLocalPreview(null);
    setUploadedUrl(null);
    onUploaded("", field);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        {previewType === "avatar" ? <Camera size={13} /> : <BadgeCheck size={13} />}
        {label}
      </Label>

      {/* Drop zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "pointer-events-none opacity-60"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Spinner className="w-6 h-6 text-primary" />
            <p className="text-xs text-muted-foreground">Uploading…</p>
          </div>
        ) : displayUrl && previewType === "avatar" ? (
          /* Avatar preview */
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full ring-2 ring-primary/20 overflow-hidden bg-muted shrink-0">
              <img src={localPreview ?? displayUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-500" />Photo uploaded
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Click to replace</p>
            </div>
            <Button
              type="button" variant="ghost" size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            >
              <X size={14} />
            </Button>
          </div>
        ) : displayUrl && previewType === "signature" ? (
          /* Signature preview */
          <div className="flex items-start gap-4">
            <div className="flex-1 border rounded-lg bg-white dark:bg-black/20 p-2 overflow-hidden">
              <img
                src={localPreview ?? displayUrl}
                alt="Signature"
                className="h-14 max-w-full object-contain mx-auto"
              />
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <p className="text-sm font-medium flex items-center gap-1.5 justify-end">
                <CheckCircle2 size={14} className="text-green-500" />Signature uploaded
              </p>
              <p className="text-xs text-muted-foreground">Click to replace</p>
              <Button
                type="button" variant="ghost" size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              >
                <X size={14} className="mr-1" />Remove
              </Button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {previewType === "avatar" ? <Camera size={18} className="text-muted-foreground" /> : <FileImage size={18} className="text-muted-foreground" />}
            </div>
            <div>
              <p className="text-sm font-medium">
                <span className="text-primary underline-offset-2 hover:underline">Click to upload</span> or drag &amp; drop
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{acceptLabel} · Max 10 MB</p>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Authenticated>
      <ProfilePageInner />
    </Authenticated>
  );
}

function ProfilePageInner() {
  const user = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  type ProfileFields = {
    name: string; firstName: string; lastName: string;
    phone: string; jobTitle: string; designation: string;
    businessUnit: string; siteLocation: string; costCenter: string;
    employmentType: string; timezone: string; language: string;
    avatarUrl: string; digitalSignatureUrl: string; bio: string;
  };

  const [fields, setFields] = useState<ProfileFields>({
    name: "", firstName: "", lastName: "",
    phone: "", jobTitle: "", designation: "",
    businessUnit: "", siteLocation: "", costCenter: "",
    employmentType: "", timezone: "", language: "",
    avatarUrl: "", digitalSignatureUrl: "", bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [tab, setTab] = useState<"personal" | "employment" | "account">("personal");

  if (user && !initialized) {
    const u = user as Record<string, unknown>;
    setFields({
      name: (u.name as string) ?? "",
      firstName: (u.firstName as string) ?? "",
      lastName: (u.lastName as string) ?? "",
      phone: (u.phone as string) ?? "",
      jobTitle: (u.jobTitle as string) ?? "",
      designation: (u.designation as string) ?? "",
      businessUnit: (u.businessUnit as string) ?? "",
      siteLocation: (u.siteLocation as string) ?? "",
      costCenter: (u.costCenter as string) ?? "",
      employmentType: (u.employmentType as string) ?? "",
      timezone: (u.timezone as string) ?? "",
      language: (u.language as string) ?? "",
      avatarUrl: (u.avatarUrl as string) ?? "",
      digitalSignatureUrl: (u.digitalSignatureUrl as string) ?? "",
      bio: (u.bio as string) ?? "",
    });
    setInitialized(true);
  }

  const f = (key: keyof ProfileFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Called by FileUploadWidget when a file is saved to storage
  function handleFileUploaded(url: string, field: "avatarUrl" | "digitalSignatureUrl") {
    setFields((prev) => ({ ...prev, [field]: url }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name: fields.name || undefined,
        firstName: fields.firstName || undefined,
        lastName: fields.lastName || undefined,
        phone: fields.phone || undefined,
        jobTitle: fields.jobTitle || undefined,
        designation: fields.designation || undefined,
        businessUnit: fields.businessUnit || undefined,
        siteLocation: fields.siteLocation || undefined,
        costCenter: fields.costCenter || undefined,
        employmentType: fields.employmentType || undefined,
        timezone: fields.timezone || undefined,
        language: fields.language || undefined,
        bio: fields.bio || undefined,
        // avatarUrl and digitalSignatureUrl are saved immediately on upload;
        // only pass them here if there's a non-empty value to keep them in sync
        avatarUrl: fields.avatarUrl || undefined,
        digitalSignatureUrl: fields.digitalSignatureUrl || undefined,
      });
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const u = user as Record<string, unknown>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information and preferences</p>
      </div>

      {/* Avatar hero card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full ring-4 ring-primary/20 overflow-hidden bg-primary/10 flex items-center justify-center">
                {fields.avatarUrl ? (
                  <img
                    src={fields.avatarUrl}
                    alt={fields.name ?? "Avatar"}
                    className="w-full h-full object-cover"
                    onError={() => f("avatarUrl", "")}
                  />
                ) : (
                  <span className="text-primary text-3xl font-bold">{getInitials(fields.name || user.name)}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                <Camera size={13} className="text-white" />
              </div>
            </div>

            {/* User info */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h2 className="text-xl font-bold">{user.name ?? "Unknown User"}</h2>
              {(u.jobTitle as string) && <p className="text-sm text-muted-foreground">{u.jobTitle as string}</p>}
              {(u.designation as string) && <p className="text-xs text-muted-foreground">{u.designation as string}</p>}
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <RoleBadge role={user.role} />
                {user.employeeNumber && (
                  <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">{user.employeeNumber}</span>
                )}
                <span className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  user.isActive !== false
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {user.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
              {user.email && (
                <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <Mail size={13} /> {user.email}
                </p>
              )}
              {(u.lastLoginAt as string) && (
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <Clock size={11} /> Last login {formatDistanceToNow(new Date(u.lastLoginAt as string), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b flex gap-4">
        {([["personal", "Personal Info"], ["employment", "Employment"], ["account", "Account Details"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "text-sm pb-2.5 border-b-2 font-medium transition-colors cursor-pointer",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-4">

        {/* ── Personal Info ── */}
        {tab === "personal" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User size={15} className="text-primary" />Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Avatar upload */}
              <FileUploadWidget
                label="Profile Photo"
                hint="Uploaded photo is saved immediately. JPG, PNG, or WebP recommended."
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                acceptLabel="JPG, PNG, WebP"
                currentUrl={fields.avatarUrl}
                previewType="avatar"
                field="avatarUrl"
                onUploaded={handleFileUploaded}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={fields.firstName} onChange={(e) => f("firstName", e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={fields.lastName} onChange={(e) => f("lastName", e.target.value)} placeholder="Smith" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User size={13} />Full Name</Label>
                <Input value={fields.name} onChange={(e) => f("name", e.target.value)} placeholder="John Smith" />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Phone size={13} />Phone</Label>
                <Input value={fields.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+1 555 0000" />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><FileText size={13} />About / Bio</Label>
                <Textarea
                  value={fields.bio}
                  onChange={(e) => f("bio", e.target.value)}
                  placeholder="Short description about yourself, specialisation, or qualifications…"
                  rows={3}
                />
              </div>

              {/* Digital signature upload */}
              <FileUploadWidget
                label="Digital Signature (optional)"
                hint="Used on COAs and official documents. PNG with transparent background recommended."
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg"
                acceptLabel="PNG, JPG"
                currentUrl={fields.digitalSignatureUrl}
                previewType="signature"
                field="digitalSignatureUrl"
                onUploaded={handleFileUploaded}
              />

            </CardContent>
          </Card>
        )}

        {/* ── Employment ── */}
        {tab === "employment" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase size={15} className="text-primary" />Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="flex items-center gap-1.5"><Briefcase size={13} />Job Title</Label>
                  <Input value={fields.jobTitle} onChange={(e) => f("jobTitle", e.target.value)} placeholder="Senior Analyst" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Designation</Label>
                  <Input value={fields.designation} onChange={(e) => f("designation", e.target.value)} placeholder="Chemist II" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="flex items-center gap-1.5"><Building2 size={13} />Business Unit</Label>
                  <Input value={fields.businessUnit} onChange={(e) => f("businessUnit", e.target.value)} placeholder="Analytical Services" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="flex items-center gap-1.5"><MapPin size={13} />Site / Location</Label>
                  <Input value={fields.siteLocation} onChange={(e) => f("siteLocation", e.target.value)} placeholder="Karachi – Lab A" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Cost Center</Label>
                  <Input value={fields.costCenter} onChange={(e) => f("costCenter", e.target.value)} placeholder="CC-1234" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Employment Type</Label>
                  <Select value={fields.employmentType || "none"} onValueChange={(v) => f("employmentType", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {EMPLOYMENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="flex items-center gap-1.5"><Globe size={13} />Timezone</Label>
                  <Select value={fields.timezone || "none"} onValueChange={(v) => f("timezone", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select timezone…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="flex items-center gap-1.5"><Languages size={13} />Language</Label>
                  <Select value={fields.language || "none"} onValueChange={(v) => f("language", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Account Details ── */}
        {tab === "account" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield size={15} className="text-primary" />Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Email Address</p>
                  <p className="font-medium">{user.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">System Role</p>
                  <RoleBadge role={user.role} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Employee Number</p>
                  <p className="font-medium">{user.employeeNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Account Status</p>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    user.isActive !== false
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}>
                    {user.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last Login</p>
                  <p className="font-medium">
                    {(u.lastLoginAt as string)
                      ? formatDistanceToNow(new Date(u.lastLoginAt as string), { addSuffix: true })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Account Created</p>
                  <p className="font-medium">
                    {user._creationTime
                      ? formatDistanceToNow(new Date(user._creationTime), { addSuffix: true })
                      : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
                Email, employee number, and role can only be changed by a system administrator.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <><Spinner className="w-4 h-4 mr-2" />Saving…</> : <><Save size={14} className="mr-2" />Save Profile</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
