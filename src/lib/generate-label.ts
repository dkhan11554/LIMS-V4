/**
 * generate-label.ts — Client-side QR code sample label generator using jsPDF + qrcode
 * Generates printable sample labels with LIMS number, sample info, and QR code
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export type LabelSize = "small" | "medium" | "large";

export type SampleLabelData = {
  limsNumber: string;
  sampleName: string;
  customerName: string;
  sampleType?: string;
  priority: string;
  collectionDate?: string;
  batchNumber?: string;
  laboratoryName?: string;
};

const LABEL_SIZES: Record<LabelSize, { width: number; height: number; label: string }> = {
  small:  { width: 50,  height: 25,  label: "50×25 mm (Small)" },
  medium: { width: 75,  height: 40,  label: "75×40 mm (Medium)" },
  large:  { width: 100, height: 60,  label: "100×60 mm (Large)" },
};

export const LABEL_SIZE_OPTIONS = Object.entries(LABEL_SIZES).map(([k, v]) => ({ value: k as LabelSize, label: v.label }));

const PRIORITY_COLORS: Record<string, string> = {
  stat:    "#ef4444",
  urgent:  "#f97316",
  routine: "#3b82f6",
};

export async function generateSampleLabel(sample: SampleLabelData, size: LabelSize = "medium"): Promise<void> {
  const dims = LABEL_SIZES[size];

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(sample.limsNumber, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  // Create PDF in landscape for label dimensions
  const doc = new jsPDF({
    orientation: dims.width > dims.height ? "landscape" : "portrait",
    unit: "mm",
    format: [dims.width, dims.height],
  });

  const w = dims.width;
  const h = dims.height;
  const pad = 2;

  // Border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(0.5, 0.5, w - 1, h - 1);

  // Priority stripe at top
  const priorityColor = PRIORITY_COLORS[sample.priority] ?? "#3b82f6";
  const [r, g, b] = hexToRgb(priorityColor);
  doc.setFillColor(r, g, b);
  doc.rect(0.5, 0.5, w - 1, 3.5, "F");

  // Priority label
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(sample.priority.toUpperCase(), w / 2, 2.8, { align: "center" });

  // QR code (right side)
  const qrSize = Math.min(h * 0.55, w * 0.3);
  const qrX = w - pad - qrSize;
  const qrY = 5;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Text area (left side)
  const textWidth = w - qrSize - pad * 3 - 1;
  let y = 6;
  const lineH = size === "small" ? 3.2 : 3.8;

  // LIMS Number — prominent
  doc.setFontSize(size === "small" ? 8 : 10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(sample.limsNumber, pad + 0.5, y);
  y += lineH + 0.5;

  // Sample name
  doc.setFontSize(size === "small" ? 6 : 7.5);
  doc.setFont("helvetica", "normal");
  const nameLines = doc.splitTextToSize(sample.sampleName, textWidth);
  doc.text(nameLines.slice(0, 2) as string[], pad + 0.5, y);
  y += (lineH - 0.5) * Math.min(nameLines.length, 2);

  // Customer
  doc.setFontSize(size === "small" ? 5 : 6);
  doc.setTextColor(80, 80, 80);
  doc.text(sample.customerName, pad + 0.5, y);
  y += lineH - 1;

  if (sample.sampleType) {
    doc.setFontSize(5);
    doc.text(`Type: ${sample.sampleType}`, pad + 0.5, y);
    y += lineH - 1;
  }

  if (sample.batchNumber) {
    doc.text(`Batch: ${sample.batchNumber}`, pad + 0.5, y);
    y += lineH - 1;
  }

  if (sample.collectionDate) {
    doc.text(`Collected: ${new Date(sample.collectionDate).toLocaleDateString()}`, pad + 0.5, y);
    y += lineH - 1;
  }

  // Lab name footer
  if (sample.laboratoryName) {
    doc.setFontSize(4.5);
    doc.setTextColor(120, 120, 120);
    doc.text(sample.laboratoryName, pad + 0.5, h - 2);
  }

  // LIMS text under QR
  doc.setFontSize(4.5);
  doc.setTextColor(60, 60, 60);
  doc.text(sample.limsNumber, qrX + qrSize / 2, qrY + qrSize + 2, { align: "center" });

  doc.autoPrint();
  doc.output("dataurlnewwindow");
}

export async function generateBatchLabels(samples: SampleLabelData[], size: LabelSize = "medium"): Promise<void> {
  const dims = LABEL_SIZES[size];
  const labelsPerRow = 2;
  const labelsPerCol = 3;
  const pageW = dims.width * labelsPerRow + 10;
  const pageH = dims.height * labelsPerCol + 10;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, pageH] });

  for (let i = 0; i < samples.length; i++) {
    const col = i % labelsPerRow;
    const row = Math.floor(i / labelsPerRow) % labelsPerCol;

    if (i > 0 && i % (labelsPerRow * labelsPerCol) === 0) {
      doc.addPage();
    }

    const offsetX = col * (dims.width + 5) + 2.5;
    const offsetY = row * (dims.height + 5) + 2.5;

    const sample = samples[i];
    if (!sample) continue;

    const qrDataUrl = await QRCode.toDataURL(sample.limsNumber, { width: 100, margin: 1 });
    const w = dims.width;
    const h = dims.height;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(offsetX, offsetY, w, h);

    const [r, g, b] = hexToRgb(PRIORITY_COLORS[sample.priority] ?? "#3b82f6");
    doc.setFillColor(r, g, b);
    doc.rect(offsetX, offsetY, w, 3.5, "F");

    doc.setFontSize(5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(sample.priority.toUpperCase(), offsetX + w / 2, offsetY + 2.8, { align: "center" });

    const qrSize = Math.min(h * 0.55, w * 0.3);
    doc.addImage(qrDataUrl, "PNG", offsetX + w - qrSize - 2, offsetY + 5, qrSize, qrSize);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(sample.limsNumber, offsetX + 2, offsetY + 7);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(sample.sampleName, w - qrSize - 6);
    doc.text(lines.slice(0, 2) as string[], offsetX + 2, offsetY + 11);

    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text(sample.customerName, offsetX + 2, offsetY + 16);
  }

  doc.autoPrint();
  doc.output("dataurlnewwindow");
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1]!, 16), parseInt(result[2]!, 16), parseInt(result[3]!, 16)]
    : [0, 0, 0];
}
