import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils.ts";
import {
  Package, Plus, Search, AlertTriangle, TrendingDown,
  ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle, RefreshCcw
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  reagent:     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  consumable:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  standard:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  equipment:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ppe:         "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  other:       "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const CATEGORIES = ["reagent", "consumable", "standard", "equipment", "ppe", "other"] as const;
const STORAGE_CONDITIONS = ["room_temp", "refrigerated", "frozen"] as const;

function AddItemDialog({ labId, open, onClose }: { labId: string; open: boolean; onClose: () => void }) {
  const create = useMutation(api.inventory.createInventoryItem);
  const [form, setForm] = useState({
    name: "", category: "reagent", supplier: "", catalogueNumber: "",
    unit: "pcs", currentStock: "", minStock: "", maxStock: "",
    reorderPoint: "", location: "", storageCondition: "",
    expiryDate: "", lotNumber: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.unit.trim()) { toast.error("Name and unit are required"); return; }
    if (!form.currentStock || !form.minStock) { toast.error("Stock levels are required"); return; }
    setSaving(true);
    try {
      await create({
        name: form.name,
        category: form.category as typeof CATEGORIES[number],
        supplier: form.supplier || undefined,
        catalogueNumber: form.catalogueNumber || undefined,
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStock: Number(form.minStock),
        maxStock: form.maxStock ? Number(form.maxStock) : undefined,
        reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
        location: form.location || undefined,
        storageCondition: form.storageCondition || undefined,
        laboratoryId: labId as never,
        expiryDate: form.expiryDate || undefined,
        lotNumber: form.lotNumber || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Item added to inventory");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to add item");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Acetonitrile HPLC Grade" />
          </div>
          <div className="space-y-1">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unit *</Label>
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="e.g. mL, g, pcs, box" />
          </div>
          <div className="space-y-1">
            <Label>Current Stock *</Label>
            <Input type="number" value={form.currentStock} onChange={(e) => set("currentStock", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label>Min Stock *</Label>
            <Input type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label>Max Stock</Label>
            <Input type="number" value={form.maxStock} onChange={(e) => set("maxStock", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label>Reorder Point</Label>
            <Input type="number" value={form.reorderPoint} onChange={(e) => set("reorderPoint", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Catalogue Number</Label>
            <Input value={form.catalogueNumber} onChange={(e) => set("catalogueNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Storage Location</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Fridge 2, Shelf B" />
          </div>
          <div className="space-y-1">
            <Label>Storage Condition</Label>
            <Select value={form.storageCondition} onValueChange={(v) => set("storageCondition", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="room_temp">Room Temperature</SelectItem>
                <SelectItem value="refrigerated">Refrigerated (2–8°C)</SelectItem>
                <SelectItem value="frozen">Frozen (-20°C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Lot Number</Label>
            <Input value={form.lotNumber} onChange={(e) => set("lotNumber", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Expiry Date</Label>
            <Input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Add Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockTransactionDialog({
  itemId, itemName, unit, currentStock, open, onClose,
}: { itemId: string; itemName: string; unit: string; currentStock: number; open: boolean; onClose: () => void }) {
  const record = useMutation(api.inventory.recordTransaction);
  const [txType, setTxType] = useState<"receipt" | "issue" | "adjustment" | "waste" | "return">("receipt");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  const TX_LABELS: Record<string, string> = {
    receipt: "Stock Receipt (In)", issue: "Issue (Out)", adjustment: "Adjustment",
    waste: "Waste / Disposal", return: "Return to Stock",
  };

  const handleSubmit = async () => {
    if (!qty || Number(qty) <= 0) { toast.error("Enter a valid quantity"); return; }
    setSaving(true);
    try {
      await record({
        inventoryItemId: itemId as never,
        transactionType: txType,
        quantity: Number(qty),
        referenceNumber: ref || undefined,
        reason: reason || undefined,
      });
      toast.success("Transaction recorded");
      onClose();
    } catch (e) {
      if (e instanceof ConvexError) toast.error((e.data as { message: string }).message);
      else toast.error("Failed to record transaction");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Stock Transaction — {itemName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted px-4 py-2 text-sm">
            Current stock: <strong>{currentStock} {unit}</strong>
          </div>
          <div className="space-y-1">
            <Label>Transaction Type</Label>
            <Select value={txType} onValueChange={(v) => setTxType(v as typeof txType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TX_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quantity ({unit}) *</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label>Reference Number</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PO number, work order…" />
          </div>
          <div className="space-y-1">
            <Label>Reason / Notes</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type InventoryItem = {
  _id: string;
  name: string;
  itemCode: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  supplier?: string;
  location?: string;
  expiryDate?: string;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
};

function StockBar({ item }: { item: InventoryItem }) {
  const pct = item.maxStock ? Math.min((item.currentStock / item.maxStock) * 100, 100) : null;
  return (
    <div className="flex items-center gap-2 mt-1">
      {pct !== null ? (
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", item.isLowStock ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      <span className={cn("text-xs font-medium", item.isLowStock ? "text-destructive" : "text-foreground")}>
        {item.currentStock} {item.unit}
      </span>
      {item.isLowStock && <AlertTriangle size={11} className="text-destructive shrink-0" />}
    </div>
  );
}

function InventoryRow({ item, onTransaction }: { item: InventoryItem; onTransaction: (item: InventoryItem) => void }) {
  return (
    <Card className={cn("border", item.isExpired ? "border-destructive/40" : item.isLowStock ? "border-orange-400/50" : "")}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{item.name}</p>
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", CATEGORY_COLORS[item.category] ?? "")}>
              {item.category}
            </span>
            {item.isExpired && <span className="text-xs px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Expired</span>}
            {!item.isExpired && item.isExpiringSoon && <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">Expiring Soon</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{item.itemCode}{item.supplier && ` · ${item.supplier}`}{item.location && ` · 📍${item.location}`}</p>
          <StockBar item={item} />
          {item.expiryDate && (
            <p className="text-xs text-muted-foreground mt-0.5">Expiry: {format(parseISO(item.expiryDate), "dd MMM yyyy")}</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => onTransaction(item)} className="shrink-0">
          <RefreshCcw size={13} className="mr-1" /> Transaction
        </Button>
      </CardContent>
    </Card>
  );
}

function InventoryInner() {
  const { labId } = useActiveLab();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [txItem, setTxItem] = useState<InventoryItem | null>(null);

  const items = useQuery(api.inventory.listInventoryItems, labId ? { laboratoryId: labId as never } : "skip");
  const alerts = useQuery(api.inventory.getInventoryAlerts, labId ? { laboratoryId: labId as never } : "skip");

  if (!labId) return <div className="p-8 text-muted-foreground">No laboratory configured.</div>;

  const filtered = (items ?? []).filter((i) => {
    const matchSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      (i.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || i.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package size={22} className="text-primary" /> Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reagents, consumables, standards and lab supplies</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus size={16} className="mr-1" /> Add Item</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Items",   value: items?.length ?? 0,                    icon: <Package size={18} />,       color: "text-primary" },
          { label: "Low Stock",     value: alerts?.lowStock.length ?? 0,          icon: <TrendingDown size={18} />,  color: "text-orange-500" },
          { label: "Expiring Soon", value: alerts?.expiringSoon.length ?? 0,      icon: <AlertTriangle size={18} />, color: "text-yellow-500" },
          { label: "Expired",       value: alerts?.expired.length ?? 0,           icon: <AlertTriangle size={18} />, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">
                  {items === undefined ? <Skeleton className="h-7 w-10" /> : s.value}
                </p>
              </div>
              <span className={s.color}>{s.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts banners */}
      {(alerts?.expired.length ?? 0) > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle size={16} />
          <span><strong>{alerts!.expired.length}</strong> item{alerts!.expired.length > 1 ? "s have" : " has"} expired and should be removed from use.</span>
        </div>
      )}
      {(alerts?.lowStock.length ?? 0) > 0 && (
        <div className="rounded-lg border border-orange-400/40 bg-orange-50 dark:bg-orange-900/10 px-4 py-3 flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
          <TrendingDown size={16} />
          <span><strong>{alerts!.lowStock.length}</strong> item{alerts!.lowStock.length > 1 ? "s are" : " is"} at or below minimum stock level.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory…" className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {items === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No items found</p>
          <p className="text-sm">Add your first inventory item to get started.</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-1" />Add Item</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <InventoryRow key={item._id} item={item} onTransaction={setTxItem} />
          ))}
        </div>
      )}

      <AddItemDialog labId={labId} open={addOpen} onClose={() => setAddOpen(false)} />
      {txItem && (
        <StockTransactionDialog
          itemId={txItem._id}
          itemName={txItem.name}
          unit={txItem.unit}
          currentStock={txItem.currentStock}
          open={!!txItem}
          onClose={() => setTxItem(null)}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return <Authenticated><InventoryInner /></Authenticated>;
}
