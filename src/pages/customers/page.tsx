import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { StatusBadge } from "@/components/ui/status-badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Plus, Search, Users, Phone, Mail, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  legalName: z.string().optional(),
  taxNumber: z.string().optional(),
  billingAddress: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CustomersPage() {
  const { labId } = useActiveLab();
  const customers = useQuery(
    api.customers.listCustomers,
    labId ? { laboratoryId: labId } : "skip"
  );
  const createCustomer = useMutation(api.customers.createCustomer);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const filtered = customers?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.customerCode.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (data: FormData) => {
    if (!labId) return;
    try {
      await createCustomer({
        ...data,
        email: data.email || undefined,
        laboratoryId: labId,
      });
      toast.success("Customer created");
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to create customer");
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">{customers?.length ?? 0} customers registered</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1" /> New Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {customers === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>No customers yet</EmptyTitle>
            <EmptyDescription>Add your first customer to start registering samples</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setOpen(true)}>Add Customer</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered?.map((c) => (
            <Link key={c._id} to={`/customers/${c._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.customerCode}</p>
                    </div>
                    <StatusBadge status={c.isActive ? "active" : "inactive"} />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.country && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} />
                        <span>{c.country}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Customer Name *</Label>
                <Input {...register("name")} placeholder="Acme Pharma Ltd" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Legal Name</Label>
                <Input {...register("legalName")} placeholder="Full legal name" />
              </div>
              <div className="space-y-1">
                <Label>Tax Number</Label>
                <Input {...register("taxNumber")} placeholder="VAT/Tax ID" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input {...register("email")} placeholder="contact@company.com" type="email" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="+1 555 000 0000" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input {...register("country")} placeholder="United States" />
              </div>
              <div className="space-y-1">
                <Label>Payment Terms</Label>
                <Input {...register("paymentTerms")} placeholder="Net 30" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Billing Address</Label>
                <Input {...register("billingAddress")} placeholder="123 Main Street, City, State" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notes</Label>
                <Input {...register("notes")} placeholder="Additional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>Create Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
