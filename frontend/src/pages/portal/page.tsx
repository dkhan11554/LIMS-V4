import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";
import {
  FlaskConical, FileText, Receipt, Bell, CheckCircle2,
  Clock, AlertTriangle, ArrowRight, User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";

// Status display config (shared subset from samples)
const SAMPLE_STATUS: Record<string, { label: string; color: string }> = {
  registered:      { label: "Registered",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  awaiting_receipt:{ label: "Awaiting Receipt",color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  received:        { label: "Received",        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  accepted:        { label: "Accepted",        color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  rejected:        { label: "Rejected",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  testing:         { label: "Testing",         color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  pending_review:  { label: "Pending Review",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  approved:        { label: "Approved",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  coa_generated:   { label: "COA Ready",       color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  delivered:       { label: "Delivered",       color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const INV_STATUS_COLOR: Record<string, string> = {
  draft:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sent:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ─── Customer selector ────────────────────────────────────────────────

function CustomerSelector({ labId, onSelect }: { labId: string; onSelect: (id: string, name: string) => void }) {
  const customers = useQuery(api.customers.listCustomers, { laboratoryId: labId as never });
  return (
    <div className="p-8 max-w-xl mx-auto space-y-4">
      <div className="text-center space-y-2 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <User size={28} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold">Customer Portal</h2>
        <p className="text-sm text-muted-foreground">Select your account to view samples, reports and invoices</p>
      </div>
      {customers === undefined ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : customers.length === 0 ? (
        <p className="text-center text-muted-foreground">No customers found.</p>
      ) : (
        <div className="space-y-2">
          {customers.filter((c) => c.isActive).map((c) => (
            <button
              key={c._id}
              onClick={() => onSelect(c._id, c.name)}
              className="w-full text-left rounded-xl border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.customerCode}{c.email && ` · ${c.email}`}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Portal content ───────────────────────────────────────────────────

type PortalTab = "samples" | "invoices";

function PortalContent({ customerId, customerName, labId }: { customerId: string; customerName: string; labId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<PortalTab>("samples");

  const samples = useQuery(api.billing.getCustomerSamples, { customerId: customerId as never });
  const invoices = useQuery(api.billing.getCustomerInvoices, { customerId: customerId as never });

  const completedCount = (samples ?? []).filter((s) => ["approved", "coa_generated", "delivered"].includes(s.status)).length;
  const pendingInvoices = (invoices ?? []).filter((i) => !["paid", "cancelled", "credited"].includes(i.status));
  const totalOutstanding = pendingInvoices.reduce((s, i) => s + i.balance, 0);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-teal-500/10 border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <User size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Customer Portal</p>
            <h2 className="text-lg font-bold">{customerName}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total Samples",   value: samples?.length ?? 0,  icon: <FlaskConical size={15} /> },
            { label: "Completed",       value: completedCount,         icon: <CheckCircle2 size={15} className="text-green-500" /> },
            { label: "Invoices",        value: invoices?.length ?? 0,  icon: <Receipt size={15} /> },
            { label: "Outstanding",     value: fmt(totalOutstanding),  icon: <AlertTriangle size={15} className="text-orange-500" /> },
          ].map((s) => (
            <div key={s.label} className="bg-background/60 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{s.icon}<span>{s.label}</span></div>
              <p className="text-lg font-bold mt-0.5">{samples === undefined ? <Skeleton className="h-6 w-10 inline-block" /> : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {([
          { id: "samples" as PortalTab,  label: "My Samples",  icon: <FlaskConical size={14} /> },
          { id: "invoices" as PortalTab, label: "Invoices",    icon: <Receipt size={14} /> },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* Samples tab */}
      {tab === "samples" && (
        samples === undefined ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : samples.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
            <p>No samples found for your account.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {samples.map((s) => {
              const cfg = SAMPLE_STATUS[s.status] ?? { label: s.status, color: "" };
              const canViewCoa = ["approved", "coa_generated", "delivered"].includes(s.status);
              return (
                <Card key={s._id} className="border hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{s.limsNumber}</span>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>{cfg.label}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                          s.priority === "stat" ? "bg-red-100 text-red-700" :
                          s.priority === "urgent" ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-600"
                        )}>{s.priority.toUpperCase()}</span>
                      </div>
                      <p className="text-sm font-semibold mt-0.5">{s.sampleName}</p>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        {s.collectionDate && <span>Collected: {format(parseISO(s.collectionDate), "dd MMM yyyy")}</span>}
                        {s.receivedDate && <span>Received: {format(parseISO(s.receivedDate), "dd MMM yyyy")}</span>}
                      </div>
                    </div>
                    {canViewCoa && (
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/quality/coa/${s._id}`)}>
                        <FileText size={13} className="mr-1" />View COA
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Invoices tab */}
      {tab === "invoices" && (
        invoices === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt size={36} className="mx-auto mb-3 opacity-30" />
            <p>No invoices on your account.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const color = INV_STATUS_COLOR[inv.status] ?? "";
              return (
                <Card key={inv._id} className="border">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", color)}>{inv.status.replace("_", " ")}</span>
                      </div>
                      <div className="text-sm font-semibold mt-0.5">{fmt(inv.total)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        <span>Issued: {format(parseISO(inv.issueDate), "dd MMM yyyy")}</span>
                        {inv.dueDate && <span>Due: {format(parseISO(inv.dueDate), "dd MMM yyyy")}</span>}
                        {inv.balance > 0 && <span className="text-orange-600">Balance: {fmt(inv.balance)}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Main portal page ─────────────────────────────────────────────────

function PortalInner() {
  const { labId } = useActiveLab();
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);

  if (!labId) return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {!selectedCustomer ? (
        <CustomerSelector labId={labId} onSelect={(id, name) => setSelectedCustomer({ id, name })} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>← Back</Button>
          </div>
          <PortalContent customerId={selectedCustomer.id} customerName={selectedCustomer.name} labId={labId} />
        </div>
      )}
    </div>
  );
}

export default function CustomerPortalPage() {
  return (
    <>
      <AuthLoading><div className="flex items-center justify-center h-64"><Skeleton className="h-8 w-40" /></div></AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Please sign in to access the customer portal.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated><PortalInner /></Authenticated>
    </>
  );
}
