/**
 * Client-side Invoice PDF generator.
 * Uses jsPDF + jspdf-autotable with clinical LIMS branding.
 * Supports multi-currency formatting.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Currency helpers ────────────────────────────────────────────────────────

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$",    label: "US Dollar (USD)" },
  { code: "EUR", symbol: "€",    label: "Euro (EUR)" },
  { code: "GBP", symbol: "£",    label: "British Pound (GBP)" },
  { code: "AED", symbol: "AED ", label: "UAE Dirham (AED)" },
  { code: "SAR", symbol: "SAR ", label: "Saudi Riyal (SAR)" },
  { code: "PKR", symbol: "PKR ", label: "Pakistani Rupee (PKR)" },
  { code: "INR", symbol: "₹",    label: "Indian Rupee (INR)" },
  { code: "BDT", symbol: "৳",    label: "Bangladeshi Taka (BDT)" },
  { code: "QAR", symbol: "QAR ", label: "Qatari Riyal (QAR)" },
  { code: "KWD", symbol: "KWD ", label: "Kuwaiti Dinar (KWD)" },
  { code: "BHD", symbol: "BHD ", label: "Bahraini Dinar (BHD)" },
  { code: "OMR", symbol: "OMR ", label: "Omani Rial (OMR)" },
  { code: "EGP", symbol: "EGP ", label: "Egyptian Pound (EGP)" },
  { code: "ZAR", symbol: "R",    label: "South African Rand (ZAR)" },
  { code: "NGN", symbol: "₦",    label: "Nigerian Naira (NGN)" },
  { code: "GHS", symbol: "₵",    label: "Ghanaian Cedi (GHS)" },
  { code: "KES", symbol: "KSh ", label: "Kenyan Shilling (KES)" },
  { code: "MYR", symbol: "RM ",  label: "Malaysian Ringgit (MYR)" },
  { code: "SGD", symbol: "S$",   label: "Singapore Dollar (SGD)" },
  { code: "AUD", symbol: "A$",   label: "Australian Dollar (AUD)" },
  { code: "CAD", symbol: "C$",   label: "Canadian Dollar (CAD)" },
  { code: "JPY", symbol: "¥",    label: "Japanese Yen (JPY)" },
  { code: "CNY", symbol: "¥",    label: "Chinese Yuan (CNY)" },
  { code: "CHF", symbol: "Fr ",  label: "Swiss Franc (CHF)" },
  { code: "TRY", symbol: "₺",    label: "Turkish Lira (TRY)" },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? (code + " ");
}

/** Format a monetary value using Intl if possible, falling back to a plain format. */
export function formatMoney(amount: number, currencyCode = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sym = getCurrencySymbol(currencyCode);
    return `${sym}${amount.toFixed(2)}`;
  }
}

// ─── Invoice data types ───────────────────────────────────────────────────────

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type InvoicePdfData = {
  // Lab / issuer details
  labName: string;
  labAddress?: string;
  labPhone?: string;
  labEmail?: string;
  labWebsite?: string;
  accreditationNumber?: string;

  // Document metadata
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  paymentTerms?: string;
  currency: string;

  // Customer
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  customerTaxNumber?: string;
  projectName?: string;

  // Line items & totals
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  balance?: number;

  // Footer
  notes?: string;
  bankDetails?: string;
};

// ─── PDF generator ────────────────────────────────────────────────────────────

const PRIMARY = [30, 90, 160] as [number, number, number];   // clinical blue
const ACCENT  = [0, 160, 140] as [number, number, number];   // teal accent
const DARK    = [25, 35, 55]  as [number, number, number];
const LIGHT   = [245, 247, 251] as [number, number, number];
const MID     = [120, 130, 150] as [number, number, number];
const WHITE   = [255, 255, 255] as [number, number, number];
const RED     = [200, 40, 40]  as [number, number, number];

export function generateInvoicePdf(data: InvoicePdfData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ml = 14; // margin left
  const mr = PW - 14; // margin right
  let y = 0;

  const fmt = (n: number) => formatMoney(n, data.currency);
  const sym = getCurrencySymbol(data.currency);

  // ── Header banner ──────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PW, 38, "F");

  // Lab name
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.labName, ml, 14);

  // Tagline / accreditation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const sub: string[] = [];
  if (data.accreditationNumber) sub.push(`Accredited: ${data.accreditationNumber}`);
  if (data.labPhone) sub.push(`T: ${data.labPhone}`);
  if (data.labEmail) sub.push(data.labEmail);
  if (data.labWebsite) sub.push(data.labWebsite);
  doc.text(sub.join("   ·   "), ml, 20);

  if (data.labAddress) {
    doc.setFontSize(7.5);
    doc.text(data.labAddress, ml, 26);
  }

  // Document type label (right side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...WHITE);
  doc.text("INVOICE", mr, 22, { align: "right" });

  // Accent underline strip
  doc.setFillColor(...ACCENT);
  doc.rect(0, 38, PW, 2.5, "F");

  y = 52;

  // ── Invoice metadata box ──────────────────────────────────────────────────
  // Left block: customer details
  doc.setTextColor(...MID);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("BILL TO", ml, y);

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.customerName, ml, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let cy = y + 10;
  if (data.customerAddress) {
    const addrLines = doc.splitTextToSize(data.customerAddress, 90);
    doc.setTextColor(...DARK);
    doc.text(addrLines as string[], ml, cy);
    cy += (addrLines as string[]).length * 4.5;
  }
  if (data.customerEmail) { doc.setTextColor(...MID); doc.text(data.customerEmail, ml, cy); cy += 4.5; }
  if (data.customerTaxNumber) { doc.text(`Tax No: ${data.customerTaxNumber}`, ml, cy); cy += 4.5; }
  if (data.projectName) {
    doc.setFont("helvetica", "italic");
    doc.text(`Project: ${data.projectName}`, ml, cy);
  }

  // Right block: invoice details table
  const rxStart = PW / 2 + 10;
  const rxEnd = mr;
  const rxMid = (rxStart + rxEnd) / 2 + 15;

  const metaRows: [string, string][] = [
    ["Invoice No.", data.invoiceNumber],
    ["Issue Date",  data.issueDate],
    ["Due Date",    data.dueDate ?? "—"],
    ["Currency",    `${data.currency} (${sym.trim()})`],
    ["Status",      (data.balance ?? 0) <= 0 ? "PAID" : data.amountPaid ? "PARTIAL" : "UNPAID"],
  ];
  if (data.paymentTerms) metaRows.push(["Payment Terms", data.paymentTerms]);

  let ry = y;
  for (const [label, val] of metaRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MID);
    doc.text(label, rxStart, ry);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(val, rxEnd, ry, { align: "right" });
    ry += 6;
  }

  y = Math.max(cy + 8, ry + 6);

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(ml, y, mr, y);
  y += 6;

  // ── Line items table ───────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: ml, right: 14 },
    head: [["#", "Description", "Qty", `Unit Price (${sym.trim()})`, `Amount (${sym.trim()})`]],
    body: data.lineItems.map((li, idx) => [
      String(idx + 1),
      li.description,
      String(li.quantity),
      li.unitPrice.toFixed(2),
      li.amount.toFixed(2),
    ]),
    headStyles: {
      fillColor: PRIMARY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: DARK,
    },
    alternateRowStyles: {
      fillColor: LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
    didDrawPage: () => { /* keep footer */ },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Totals box ─────────────────────────────────────────────────────────────
  const totalsX = PW / 2 + 10;
  const totalsW = mr - totalsX;

  const totalRows: [string, string, boolean, boolean][] = [
    ["Subtotal",     fmt(data.subtotal),      false, false],
    ...(data.taxAmount
      ? [[`Tax (${data.taxRate ?? 0}%)`, fmt(data.taxAmount), false, false] as [string, string, boolean, boolean]]
      : []),
    ["Total",        fmt(data.total),         true,  false],
    ...(data.amountPaid && data.amountPaid > 0
      ? [["Amount Paid", fmt(data.amountPaid), false, false] as [string, string, boolean, boolean]]
      : []),
    ...((data.balance !== undefined && data.balance > 0)
      ? [["Balance Due", fmt(data.balance), true, true] as [string, string, boolean, boolean]]
      : []),
    ...((data.balance !== undefined && data.balance <= 0)
      ? [["Balance Due", "PAID IN FULL", true, false] as [string, string, boolean, boolean]]
      : []),
  ];

  let ty = y;
  for (const [label, val, bold, highlight] of totalRows) {
    if (highlight) {
      doc.setFillColor(...RED);
      doc.roundedRect(totalsX - 2, ty - 4.5, totalsW + 2, 6.5, 1, 1, "F");
      doc.setTextColor(...WHITE);
    } else if (bold) {
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(totalsX - 2, ty - 4.5, totalsW + 2, 6.5, 1, 1, "F");
      doc.setTextColor(...WHITE);
    } else {
      doc.setTextColor(...DARK);
    }

    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.text(label, totalsX + 2, ty);
    doc.text(val, mr, ty, { align: "right" });
    ty += 7;
  }

  y = ty + 4;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes || data.bankDetails) {
    doc.setDrawColor(...LIGHT);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(ml, y, mr - ml, data.notes && data.bankDetails ? 28 : 18, 2, 2, "FD");

    let ny = y + 6;
    if (data.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MID);
      doc.text("NOTES", ml + 4, ny);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      const wrapped = doc.splitTextToSize(data.notes, mr - ml - 8) as string[];
      doc.text(wrapped, ml + 4, ny + 5);
      ny += 5 + wrapped.length * 4;
    }

    if (data.bankDetails) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MID);
      doc.text("BANK / PAYMENT DETAILS", ml + 4, ny);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      const wrapped = doc.splitTextToSize(data.bankDetails, mr - ml - 8) as string[];
      doc.text(wrapped, ml + 4, ny + 5);
    }

    y += data.notes && data.bankDetails ? 34 : 24;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, PH - 14, PW, 14, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text(
    `${data.labName}  ·  This invoice was generated electronically and is valid without a signature.`,
    PW / 2, PH - 7,
    { align: "center" },
  );

  // Page numbers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(`Page ${p} of ${totalPages}`, mr, PH - 7, { align: "right" });
  }

  doc.save(`${data.invoiceNumber}.pdf`);
}
