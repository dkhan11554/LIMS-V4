/**
 * Client-side scientific calculation utilities for the LIMS Calculations Engine.
 * Formulae are evaluated in a safe sandbox — only numeric operations.
 */

// ─── Statistics ───────────────────────────────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[], population = false): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (population ? values.length : values.length - 1);
  return Math.sqrt(variance);
}

export function rsd(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return (stdDev(values) / avg) * 100;
}

export function confidenceInterval(values: number[], confidenceLevel = 0.95): { lower: number; upper: number; margin: number } {
  const n = values.length;
  const avg = mean(values);
  const sd = stdDev(values);
  // t-value approximations for common levels
  const tTable: Record<number, number> = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const t = tTable[confidenceLevel] ?? 1.96;
  const margin = t * (sd / Math.sqrt(n));
  return { lower: avg - margin, upper: avg + margin, margin };
}

export function measurementUncertainty(values: number[]): number {
  // Combined standard uncertainty (Type A) = SD / sqrt(n)
  const n = values.length;
  if (n < 2) return 0;
  return stdDev(values) / Math.sqrt(n);
}

export function grubbs(values: number[]): { outlierIndex: number | null; gStat: number; critical: number } {
  if (values.length < 3) return { outlierIndex: null, gStat: 0, critical: 0 };
  const avg = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return { outlierIndex: null, gStat: 0, critical: 0 };
  const gValues = values.map((v) => Math.abs(v - avg) / sd);
  const maxG = Math.max(...gValues);
  const maxIdx = gValues.indexOf(maxG);
  // Approximate Grubbs critical value for α=0.05
  const n = values.length;
  const critical = ((n - 1) / Math.sqrt(n)) * Math.sqrt(Math.pow(1.96, 2) / (n - 2 + Math.pow(1.96, 2)));
  return { outlierIndex: maxG > critical ? maxIdx : null, gStat: maxG, critical };
}

// ─── Formula evaluator ────────────────────────────────────────────────────────

/**
 * Safely evaluate a numeric formula string with named variable substitution.
 * Supports: +, -, *, /, (, ), **, Math.*, numeric literals.
 * Returns null if evaluation fails.
 */
export function evaluateFormula(formula: string, variables: Record<string, number>): number | null {
  try {
    // Replace variable names with values
    let expr = formula;
    for (const [key, val] of Object.entries(variables)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(val));
    }
    // Whitelist safe math expression
    if (!/^[\d\s+\-*/().,^%Ee]+$/.test(expr.replace(/Math\.\w+/g, "").replace(/\*\*/g, ""))) {
      return null;
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function("Math", `"use strict"; return (${expr});`);
    const result = fn(Math) as unknown;
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

// ─── Built-in formula templates ───────────────────────────────────────────────

export type FormulaTemplate = {
  name: string;
  category: string;
  formula: string;
  description: string;
  variables: { symbol: string; label: string; unit?: string; defaultValue?: number }[];
  resultUnit?: string;
};

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    name: "Simple Dilution",
    category: "dilution",
    formula: "C1 * V1 / V2",
    description: "Diluted concentration: C1 × V1 ÷ V2",
    variables: [
      { symbol: "C1", label: "Initial Concentration", unit: "mg/L" },
      { symbol: "V1", label: "Initial Volume", unit: "mL" },
      { symbol: "V2", label: "Final Volume", unit: "mL" },
    ],
    resultUnit: "mg/L",
  },
  {
    name: "Percentage Recovery",
    category: "recovery",
    formula: "(measured / theoretical) * 100",
    description: "% Recovery = (Measured ÷ Theoretical) × 100",
    variables: [
      { symbol: "measured", label: "Measured Value" },
      { symbol: "theoretical", label: "Theoretical / Spiked Value" },
    ],
    resultUnit: "%",
  },
  {
    name: "Concentration (w/v)",
    category: "concentration",
    formula: "(mass / volume) * 1000",
    description: "Concentration mg/L = (mass g ÷ volume mL) × 1000",
    variables: [
      { symbol: "mass", label: "Mass", unit: "g" },
      { symbol: "volume", label: "Volume", unit: "mL" },
    ],
    resultUnit: "mg/L",
  },
  {
    name: "Moisture Content",
    category: "moisture",
    formula: "((wetMass - dryMass) / wetMass) * 100",
    description: "% Moisture = ((Wet − Dry) ÷ Wet) × 100",
    variables: [
      { symbol: "wetMass", label: "Wet Mass", unit: "g" },
      { symbol: "dryMass", label: "Dry Mass (after drying)", unit: "g" },
    ],
    resultUnit: "%",
  },
  {
    name: "Yield Calculation",
    category: "yield",
    formula: "(actual / theoretical) * 100",
    description: "% Yield = (Actual ÷ Theoretical) × 100",
    variables: [
      { symbol: "actual", label: "Actual Yield", unit: "g" },
      { symbol: "theoretical", label: "Theoretical Yield", unit: "g" },
    ],
    resultUnit: "%",
  },
  {
    name: "Potency (per dry weight)",
    category: "concentration",
    formula: "(assayResult * dilutionFactor) / (sampleWeight * (1 - moisture / 100))",
    description: "Potency corrected for moisture and dilution",
    variables: [
      { symbol: "assayResult", label: "Assay Result", unit: "mg/mL" },
      { symbol: "dilutionFactor", label: "Dilution Factor", defaultValue: 1 },
      { symbol: "sampleWeight", label: "Sample Weight", unit: "g" },
      { symbol: "moisture", label: "Moisture %", unit: "%" },
    ],
    resultUnit: "mg/g",
  },
  {
    name: "RSD from replicates",
    category: "statistics",
    formula: "(stdDev / average) * 100",
    description: "Relative Standard Deviation. Use the Replicates tab for automatic calculation.",
    variables: [
      { symbol: "stdDev", label: "Standard Deviation" },
      { symbol: "average", label: "Mean Value" },
    ],
    resultUnit: "%",
  },
  {
    name: "Density",
    category: "concentration",
    formula: "mass / volume",
    description: "Density = Mass ÷ Volume",
    variables: [
      { symbol: "mass", label: "Mass", unit: "g" },
      { symbol: "volume", label: "Volume", unit: "cm³" },
    ],
    resultUnit: "g/cm³",
  },
];
