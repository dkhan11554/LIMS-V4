import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import {
  ArrowLeft, Mail, Phone, Building2, FileText, Plus,
  Star, User, FolderOpen, FlaskConical, Pencil, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = id as Id<"customers">;
  const customer = useQuery(api.customers.getCustomer, { id: customerId });
  const updateCustomer = useMutation(api.customers.updateCustomer);
  const createContact = useMutation(api.customers.createContact);
  const createProject = useMutation(api.customers.createProject);

  const [editing, setEditing] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // Edit form state mirrored from customer
  const [editForm, setEditForm] = useState<{
    name: string; legalName: string; taxNumber: string;
    billingAddress: string; collectionAddress: string; country: string;
    phone: string; email: string; paymentTerms: string;
    contractStart: string; contractExpiry: string; notes: string;
  } | null>(null);

  const [contactForm, setContactForm] = useState({ name: "", role: "", email: "", phone: "", isPrimary: false });
  const [projectForm, setProjectForm] = useState({ name: "", description: "", startDate: "", endDate: "", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      legalName: customer.legalName ?? "",
      taxNumber: customer.taxNumber ?? "",
      billingAddress: customer.billingAddress ?? "",
      collectionAddress: customer.collectionAddress ?? "",
      country: customer.country ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      paymentTerms: customer.paymentTerms ?? "",
      contractStart: customer.contractStart ?? "",
      contractExpiry: customer.contractExpiry ?? "",
      notes: customer.notes ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setIsSubmitting(true);
    try {
      await updateCustomer({
        id: customerId,
        name: editForm.name,
        legalName: editForm.legalName || undefined,
        taxNumber: editForm.taxNumber || undefined,
        billingAddress: editForm.billingAddress || undefined,
        collectionAddress: editForm.collectionAddress || undefined,
        country: editForm.country || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        paymentTerms: editForm.paymentTerms || undefined,
        contractStart: editForm.contractStart || undefined,
        contractExpiry: editForm.contractExpiry || undefined,
        notes: editForm.notes || undefined,
      });
      toast.success("Customer updated");
      setEditing(false);
    } catch { toast.error("Failed to update"); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name) return toast.error("Name required");
    setIsSubmitting(true);
    try {
      await createContact({
        customerId,
        name: contactForm.name,
        role: contactForm.role || undefined,
        email: contactForm.email || undefined,
        phone: contactForm.phone || undefined,
        isPrimary: contactForm.isPrimary,
      });
      toast.success("Contact added");
      setContactOpen(false);
      setContactForm({ name: "", role: "", email: "", phone: "", isPrimary: false });
    } catch { toast.error("Failed to add contact"); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name || !customer) return toast.error("Name required");
    setIsSubmitting(true);
    try {
      await createProject({
        customerId,
        laboratoryId: customer.laboratoryId,
        name: projectForm.name,
        description: projectForm.description || undefined,
        startDate: projectForm.startDate || undefined,
        endDate: projectForm.endDate || undefined,
        notes: projectForm.notes || undefined,
      });
      toast.success("Project created");
      setProjectOpen(false);
      setProjectForm({ name: "", description: "", startDate: "", endDate: "", notes: "" });
    } catch { toast.error("Failed to create project"); }
    finally { setIsSubmitting(false); }
  };

  if (customer === undefined) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!customer) return <div className="text-muted-foreground p-4">Customer not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/customers"><ArrowLeft size={16} /> Back</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{customer.name}</h1>
            <StatusBadge status={customer.isActive ? "active" : "inactive"} />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{customer.customerCode}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X size={14} className="mr-1" /> Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={isSubmitting}><Check size={14} className="mr-1" /> Save</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={startEdit}><Pencil size={14} className="mr-1" /> Edit</Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Samples", value: customer.sampleCount, icon: <FlaskConical size={16} className="text-blue-500" /> },
          { label: "Contacts", value: customer.contacts.length, icon: <User size={16} className="text-purple-500" /> },
          { label: "Projects", value: customer.projects.length, icon: <FolderOpen size={16} className="text-teal-500" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({customer.contacts.filter(c => c.isActive).length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({customer.projects.length})</TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {editing && editForm ? (
                  <div className="space-y-3">
                    <Field label="Email" value={editForm.email} onChange={(v) => setEditForm((f) => f ? { ...f, email: v } : f)} />
                    <Field label="Phone" value={editForm.phone} onChange={(v) => setEditForm((f) => f ? { ...f, phone: v } : f)} />
                    <Field label="Country" value={editForm.country} onChange={(v) => setEditForm((f) => f ? { ...f, country: v } : f)} />
                    <Field label="Billing Address" value={editForm.billingAddress} onChange={(v) => setEditForm((f) => f ? { ...f, billingAddress: v } : f)} />
                    <Field label="Collection Address" value={editForm.collectionAddress} onChange={(v) => setEditForm((f) => f ? { ...f, collectionAddress: v } : f)} />
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <InfoRow icon={<Mail size={13} />} value={customer.email} />
                    <InfoRow icon={<Phone size={13} />} value={customer.phone} />
                    <InfoRow icon={<Building2 size={13} />} value={customer.country} />
                    {customer.billingAddress && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Billing Address</p>
                        <p className="text-sm">{customer.billingAddress}</p>
                      </div>
                    )}
                    {customer.collectionAddress && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Collection Address</p>
                        <p className="text-sm">{customer.collectionAddress}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Commercial Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {editing && editForm ? (
                  <div className="space-y-3">
                    <Field label="Legal Name" value={editForm.legalName} onChange={(v) => setEditForm((f) => f ? { ...f, legalName: v } : f)} />
                    <Field label="Tax Number" value={editForm.taxNumber} onChange={(v) => setEditForm((f) => f ? { ...f, taxNumber: v } : f)} />
                    <Field label="Payment Terms" value={editForm.paymentTerms} onChange={(v) => setEditForm((f) => f ? { ...f, paymentTerms: v } : f)} />
                    <Field label="Contract Start" value={editForm.contractStart} onChange={(v) => setEditForm((f) => f ? { ...f, contractStart: v } : f)} type="date" />
                    <Field label="Contract Expiry" value={editForm.contractExpiry} onChange={(v) => setEditForm((f) => f ? { ...f, contractExpiry: v } : f)} type="date" />
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <DetailRow label="Legal Name" value={customer.legalName} />
                    <DetailRow label="Tax Number" value={customer.taxNumber} />
                    <DetailRow label="Payment Terms" value={customer.paymentTerms} />
                    <DetailRow label="Contract Start" value={customer.contractStart ? format(new Date(customer.contractStart), "PP") : undefined} />
                    <DetailRow label="Contract Expiry" value={customer.contractExpiry ? format(new Date(customer.contractExpiry), "PP") : undefined} highlight={
                      customer.contractExpiry
                        ? new Date(customer.contractExpiry) < new Date()
                          ? "expired"
                          : new Date(customer.contractExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            ? "expiring"
                            : undefined
                        : undefined
                    } />
                  </div>
                )}
              </CardContent>
            </Card>

            {(editing ? editForm?.notes !== undefined : customer.notes) && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent>
                  {editing && editForm ? (
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{customer.notes}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">Manage customer contact persons</p>
            <Button size="sm" onClick={() => setContactOpen(true)}><Plus size={14} className="mr-1" /> Add Contact</Button>
          </div>
          {customer.contacts.filter(c => c.isActive).length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><User /></EmptyMedia>
                <EmptyTitle>No contacts yet</EmptyTitle>
                <EmptyDescription>Add contact persons for this customer</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setContactOpen(true)}>Add Contact</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {customer.contacts.filter(c => c.isActive).map((c) => (
                <Card key={c._id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{c.name}</p>
                          {c.isPrimary && (
                            <span className="flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                              <Star size={11} fill="currentColor" /> Primary
                            </span>
                          )}
                        </div>
                        {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {c.email && <div className="flex items-center gap-1.5"><Mail size={11} />{c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{c.phone}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">Track testing projects for this customer</p>
            <Button size="sm" onClick={() => setProjectOpen(true)}><Plus size={14} className="mr-1" /> New Project</Button>
          </div>
          {customer.projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>Group related samples into projects</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setProjectOpen(true)}>Create Project</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3">
              {customer.projects.map((p) => (
                <Card key={p._id}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{p.name}</p>
                          <span className="text-xs text-muted-foreground font-mono">{p.projectCode}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                      </div>
                    </div>
                    {(p.startDate ?? p.endDate) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {p.startDate ? format(new Date(p.startDate), "PP") : "—"}
                        {" → "}
                        {p.endDate ? format(new Date(p.endDate), "PP") : "ongoing"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Samples Tab */}
        <TabsContent value="samples" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">Samples submitted by this customer</p>
            <Button size="sm" asChild>
              <Link to={`/samples/register`}><Plus size={14} className="mr-1" /> Register Sample</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
            {customer.sampleCount} total samples. <Link to="/samples" className="text-primary hover:underline">View all samples</Link>
          </p>
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateContact} className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" /></div>
            <div className="space-y-1"><Label>Role / Title</Label><Input value={contactForm.role} onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))} placeholder="Quality Manager" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
              Set as primary contact
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setContactOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Add Contact</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-3">
            <div className="space-y-1"><Label>Project Name *</Label><Input value={projectForm.name} onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))} placeholder="Annual Water Quality Study" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={projectForm.description} onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm((f) => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>End Date</Label><Input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm((f) => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={projectForm.notes} onChange={(e) => setProjectForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setProjectOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create Project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}<span>{value}</span>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value?: string; highlight?: "expired" | "expiring" }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight === "expired" ? "text-destructive font-medium" : highlight === "expiring" ? "text-orange-600 font-medium" : ""}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}
