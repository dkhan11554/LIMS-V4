import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty.tsx";
import { Plus, Layers } from "lucide-react";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const { labId } = useActiveLab();
  const departments = useQuery(api.organization.listDepartments, labId ? { laboratoryId: labId } : "skip");
  const createDepartment = useMutation(api.organization.createDepartment);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !form.name || !form.code) return toast.error("Name and code required");
    setIsSubmitting(true);
    try {
      await createDepartment({ name: form.name, code: form.code, laboratoryId: labId, description: form.description || undefined });
      toast.success("Department created");
      setOpen(false);
      setForm({ name: "", code: "", description: "" });
    } catch { toast.error("Failed to create department"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">{departments?.length ?? 0} departments</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-1" /> Add Department</Button>
      </div>

      {departments === undefined ? <Skeleton className="h-64 w-full" /> : departments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Layers /></EmptyMedia>
            <EmptyTitle>No departments yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent><Button size="sm" onClick={() => setOpen(true)}>Add Department</Button></EmptyContent>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {departments.map((d) => (
            <div key={d._id} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{d.name}</p>
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{d.code}</span>
              </div>
              {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1"><Label>Department Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Chemistry" /></div>
            <div className="space-y-1"><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="CHEM" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
