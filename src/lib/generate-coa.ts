/**
 * Client-side COA (Certificate of Analysis) PDF generator — M36 Enhanced.
 * jsPDF + jspdf-autotable with:
 *   - Watermark (DRAFT / CANCELLED / REISSUED)
 *   - Version number in header
 *   - AI interpretation summary section
 *   - QR code verification
 *   - Digital signature image support
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

export type CoaTestRow = {
  testCode: string;
  testName: string;
  result: string;
  unit?: string;
  lowerLimit?: number;
  upperLimit?: number;
  passFailStatus?: "pass" | "fail";
  method?: string;
};

export type CoaData = {
  // Lab identity
  labName: string;
  labAddress?: string;
  labPhone?: string;
  labEmail?: string;
  accreditationNumber?: string;

  // Sample identity
  limsNumber: string;
  sampleName: string;
  sampleType?: string;
  product?: string;
  batchNumber?: string;
  lotNumber?: string;
  customerSampleNumber?: string;

  // Customer
  customerName: string;
  customerCode?: string;
  projectName?: string;

  // Dates
  collectionDate?: string;
  receivedDate?: string;
  reportDate: string;
  requestedCompletionDate?: string;

  // Approval
  analystName?: string;
  reviewerName?: string;
  qaApproverName?: string;
  qaApprovedAt?: string;

  // Results
  tests: CoaTestRow[];

  // COA URL for QR
  coaUrl: string;

  // M36 enhancements
  version?: number;                    // COA issue version
  watermark?: "DRAFT" | "CANCELLED" | "REISSUED"; // diagonal watermark
  aiSummary?: string;                  // AI-generated interpretation paragraph
  reissueReason?: string;              // reason for REISSUED watermark
};

// Brand colours (RGB)
const NAVY        = [18,  38,  64]  as const;
const TEAL        = [15, 118, 110]  as const;
const LIGHT_TEAL  = [240, 253, 250] as const;
const PASS_GREEN  = [22, 163,  74]  as const;
const FAIL_RED    = [220,  38,  38] as const;
const GREY        = [100, 116, 139] as const;
const LIGHT_GREY  = [248, 250, 252] as const;

function fmt(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return d; }
}

/** Draws a diagonal watermark across the entire page */
function addWatermark(doc: jsPDF, text: string) {
  const pageW = 210;
  const pageH = 297;
  const colour: [number, number, number] =
    text === "DRAFT"     ? [200, 200, 200] :
    text === "CANCELLED" ? [220,  38,  38] :
                           [245, 158,  11];

  doc.saveGraphicsState();
  // GState opacity via type cast — jsPDF supports this at runtime
  const gState = new (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 0.08 });
  (doc as unknown as { setGState: (g: unknown) => void }).setGState(gState);
  doc.setFontSize(72);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colour);
  // Draw rotated text at centre
  doc.text(text, pageW / 2, pageH / 2, {
    align: "center",
    angle: 45,
    baseline: "middle",
  });
  doc.restoreGraphicsState();
}

export async function generateCoaPdf(data: CoaData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 30, "F");

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(data.labName, margin, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 220, 230);
  if (data.labAddress) doc.text(data.labAddress, margin, 19);
  const contactParts = [data.labPhone, data.labEmail].filter(Boolean);
  if (contactParts.length) doc.text(contactParts.join("  |  "), margin, 24);

  // Right: title + version
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CERTIFICATE OF ANALYSIS", pageW - margin, 13, { align: "right" });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 220, 230);
  if (data.accreditationNumber) {
    doc.text(`Accreditation No: ${data.accreditationNumber}`, pageW - margin, 19, { align: "right" });
  }
  doc.text(`Report Date: ${fmt(data.reportDate)}`, pageW - margin, 24, { align: "right" });

  y = 34;

  // ── LIMS Number + version banner ──────────────────────────────────────────────
  doc.setFillColor(...LIGHT_TEAL);
  doc.rect(margin, y, contentW, 10, "F");
  doc.setDrawColor(...TEAL);
  doc.rect(margin, y, contentW, 10, "S");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text(`LIMS No: ${data.limsNumber}`, margin + 4, y + 6.8);

  // Version tag
  if (data.version && data.version > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const vColor: [number, number, number] = data.watermark === "REISSUED" ? [245, 158, 11] : [...TEAL];
    doc.setTextColor(...vColor);
    doc.text(`v${data.version}`, margin + 50, y + 6.8);
  }

  const priority = data.requestedCompletionDate ? `Due: ${fmt(data.requestedCompletionDate)}` : "";
  if (priority) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text(priority, pageW - margin - 4, y + 6.8, { align: "right" });
  }

  y += 14;

  // ── QR code ───────────────────────────────────────────────────────────────────
  const qrDataUrl = await QRCode.toDataURL(data.coaUrl, { width: 120, margin: 0 });
  const qrSize = 26;
  doc.addImage(qrDataUrl, "PNG", pageW - margin - qrSize, y, qrSize, qrSize);
  // QR label
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GREY);
  doc.text("Scan to verify", pageW - margin - qrSize / 2, y + qrSize + 3, { align: "center" });

  // ── Sample Info + Customer ────────────────────────────────────────────────────
  const infoW = contentW - qrSize - 5;
  const infoRows: [string, string][] = [
    ["Sample Name",   data.sampleName],
    ["Sample Type",   data.sampleType ?? "—"],
    ["Product",       data.product ?? "—"],
    ["Batch / Lot",   [data.batchNumber, data.lotNumber].filter(Boolean).join(" / ") || "—"],
    ["Customer Ref",  data.customerSampleNumber ?? "—"],
    ["Customer",      data.customerName],
    ["Project",       data.projectName ?? "—"],
    ["Collection",    fmt(data.collectionDate)],
    ["Received",      fmt(data.receivedDate)],
  ];

  const rowH = 5.5;
  const labelW = 40;
  doc.setFontSize(8.5);
  let iy = y;
  infoRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_GREY);
      doc.rect(margin, iy, infoW, rowH, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREY);
    doc.text(label, margin + 2, iy + 3.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + labelW, iy + 3.8, { maxWidth: infoW - labelW - 2 });
    iy += rowH;
  });

  y = Math.max(iy, y + qrSize + 8) + 4;

  // ── Reissue reason (if applicable) ───────────────────────────────────────────
  if (data.reissueReason) {
    doc.setFillColor(254, 243, 199);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14);
    doc.text(`Reissue Reason: `, margin + 3, y + 5.3);
    doc.setFont("helvetica", "normal");
    doc.text(data.reissueReason, margin + 35, y + 5.3, { maxWidth: contentW - 38 });
    y += 11;
  }

  // ── AI Interpretation Summary ─────────────────────────────────────────────────
  if (data.aiSummary) {
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setDrawColor(14, 165, 233);
    doc.rect(margin, y, contentW, 7, "S");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(14, 165, 233);
    doc.text("AI INTERPRETATION SUMMARY", margin + 3, y + 5);
    y += 10;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(30, 30, 30);
    const summaryLines = doc.splitTextToSize(data.aiSummary, contentW - 6) as string[];
    const summaryH = summaryLines.length * 4.5 + 5;
    doc.setFillColor(245, 252, 255);
    doc.rect(margin, y, contentW, summaryH, "F");
    doc.text(summaryLines, margin + 3, y + 4.5);
    y += summaryH + 5;
  }

  // ── TEST RESULTS heading ──────────────────────────────────────────────────────
  doc.setFillColor(...TEAL);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TEST RESULTS", margin + 3, y + 5);
  y += 9;

  // ── Results table ─────────────────────────────────────────────────────────────
  const tableBody = data.tests.map((t) => {
    const spec =
      t.lowerLimit != null && t.upperLimit != null ? `${t.lowerLimit} – ${t.upperLimit}`
      : t.upperLimit != null ? `≤ ${t.upperLimit}`
      : t.lowerLimit != null ? `≥ ${t.lowerLimit}`
      : "—";
    return [t.testCode, t.testName, t.result, t.unit ?? "—", spec, t.method ?? "—", t.passFailStatus?.toUpperCase() ?? "—"];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Code", "Test Parameter", "Result", "Unit", "Specification", "Method", "Status"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [...NAVY] as [number, number, number], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold" },
      1: { cellWidth: 48 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 24 },
      6: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [...LIGHT_GREY] as [number, number, number] },
    didDrawCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 6) {
        const val = String(hookData.cell.raw ?? "");
        if (val === "PASS") doc.setTextColor(...PASS_GREEN);
        else if (val === "FAIL") doc.setTextColor(...FAIL_RED);
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Authorisation ─────────────────────────────────────────────────────────────
  if (y > 235) { doc.addPage(); y = 20; }

  doc.setFillColor(...TEAL);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("AUTHORISATION", margin + 3, y + 5);
  y += 11;

  const sigCols = [
    { label: "Analysed by",            name: data.analystName    ?? "—", date: "" },
    { label: "Technically Reviewed by", name: data.reviewerName  ?? "—", date: "" },
    { label: "QA Approved by",         name: data.qaApproverName ?? "—", date: fmt(data.qaApprovedAt) },
  ];
  const sigW = contentW / 3 - 2;
  sigCols.forEach((col, i) => {
    const sx = margin + i * (sigW + 3);
    doc.setFillColor(...LIGHT_GREY);
    doc.rect(sx, y, sigW, 22, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(sx, y, sigW, 22, "S");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREY);
    doc.text(col.label.toUpperCase(), sx + 3, y + 5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.line(sx + 3, y + 14, sx + sigW - 3, y + 14);
    doc.text(col.name, sx + 3, y + 13);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    if (col.date) doc.text(`Date: ${col.date}`, sx + 3, y + 19);
  });
  y += 28;

  // ── Disclaimer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...GREY);
  const disclaimer =
    "This Certificate of Analysis relates only to the sample as received. Results are based on the test methods stated and apply solely to the sample tested. " +
    "This document may not be reproduced except in full without written approval of the issuing laboratory.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentW) as string[];
  doc.text(disclaimerLines, margin, y);

  // ── Watermark (applied to every page last) ────────────────────────────────────
  if (data.watermark) {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      addWatermark(doc, data.watermark);
    }
  }

  // ── Page footer ───────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY);
    doc.rect(0, 287, pageW, 10, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 220, 230);
    doc.text(`${data.labName} — CONFIDENTIAL`, margin, 293);
    const versionStr = data.version ? `  |  v${data.version}` : "";
    doc.text(`Page ${p} of ${totalPages}   |   LIMS: ${data.limsNumber}${versionStr}`, pageW - margin, 293, { align: "right" });
  }

  doc.save(`COA-${data.limsNumber}${data.version ? `-v${data.version}` : ""}.pdf`);
}
