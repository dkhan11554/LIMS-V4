import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty.tsx";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function LaboratoriesPage() {
  const companies = useQuery(api.organization.listCompanies);
  const labs = useQuery(api.organization.listLaboratories, {});
  const createCompany = useMutation(api.organization.createCompany);
  const createLaboratory = useMutation(api.organization.createLaboratory);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", legalName: "", country: "", phone: "", email: "" });
  const [labForm, setLabForm] = useState({ name: "", code: "", companyId: "", country: "", accreditationNumber: "", accreditationExpiry: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name) return toast.error("Company name required");
    setIsSubmitting(true);
    try {
      await createCompany(companyForm);
      toast.success("Company created");
      setCompanyOpen(false);
    } catch { toast.error("Failed to create company"); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labForm.name || !labForm.code || !labForm.companyId) return toast.error("Name, code, and company required");
    setIsSubmitting(true);
    try {
      await createLaboratory({
        name: labForm.name,
        code: labForm.code,
        companyId: labForm.companyId as Parameters<typeof createLaboratory>[0]["companyId"],
        country: labForm.country || undefined,
        accreditationNumber: labForm.accreditationNumber || undefined,
        accreditationExpiry: labForm.accreditationExpiry || undefined,
      });
      toast.success("Laboratory created");
      setLabOpen(false);
    } catch { toast.error("Failed to create laboratory"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Companies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Companies</h2>
          <Button size="sm" onClick={() => setCompanyOpen(true)}><Plus size={14} className="mr-1" /> Add Company</Button>
        </div>
        {companies === undefined ? <Skeleton className="h-24 w-full" /> : companies.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
              <EmptyTitle>No companies yet</EmptyTitle>
            </EmptyHeader>
            <EmptyContent><Button size="sm" onClick={() => setCompanyOpen(true)}>Add Company</Button></EmptyContent>
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {companies.map((c) => (
              <div key={c._id} className="border border-border rounded-lg p-4">
                <p className="font-semibold text-sm">{c.name}</p>
                {c.legalName && <p className="text-xs text-muted-foreground">{c.legalName}</p>}
                {c.country && <p className="text-xs text-muted-foreground">{c.country}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Laboratories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Laboratories</h2>
          <Button size="sm" onClick={() => setLabOpen(true)} disabled={!companies?.length}><Plus size={14} className="mr-1" /> Add Laboratory</Button>
        </div>
        {labs === undefined ? <Skeleton className="h-24 w-full" /> : labs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No laboratories yet. Add a company first.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {labs.map((lab) => (
              <div key={lab._id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{lab.name}</p>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{lab.code}</span>
                </div>
                {lab.accreditationNumber && (
                  <p className="text-xs text-muted-foreground mt-1">Accred: {lab.accreditationNumber}</p>
                )}
                {lab.country && <p className="text-xs text-muted-foreground">{lab.country}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Dialog */}
      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateCompany} className="space-y-3">
            <div className="space-y-1"><Label>Company Name *</Label><Input value={companyForm.name} onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" /></div>
            <div className="space-y-1"><Label>Legal Name</Label><Input value={companyForm.legalName} onChange={(e) => setCompanyForm((f) => ({ ...f, legalName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Country</Label><Input value={companyForm.country} onChange={(e) => setCompanyForm((f) => ({ ...f, country: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm((f) => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCompanyOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lab Dialog */}
      <Dialog open={labOpen} onOpenChange={setLabOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Laboratory</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateLab} className="space-y-3">
            <div className="space-y-1"><Label>Laboratory Name *</Label><Input value={labForm.name} onChange={(e) => setLabForm((f) => ({ ...f, name: e.target.value }))} placeholder="Central Testing Lab" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code *</Label><Input value={labForm.code} onChange={(e) => setLabForm((f) => ({ ...f, code: e.target.value }))} placeholder="CTL-01" /></div>
              <div className="space-y-1"><Label>Country</Label><Input value={labForm.country} onChange={(e) => setLabForm((f) => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <div className="space-y-1">
              <Label>Company *</Label>
              <select value={labForm.companyId} onChange={(e) => setLabForm((f) => ({ ...f, companyId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select company</option>
                {companies?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Accreditation #</Label><Input value={labForm.accreditationNumber} onChange={(e) => setLabForm((f) => ({ ...f, accreditationNumber: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Accreditation Expiry</Label><Input type="date" value={labForm.accreditationExpiry} onChange={(e) => setLabForm((f) => ({ ...f, accreditationExpiry: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setLabOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
