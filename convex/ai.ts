"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightCategory = "tat" | "workload" | "quality" | "instrument" | "inventory" | "billing";

type Insight = {
  category: InsightCategory;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  recommendation: string;
};

type AiInsightsPayload = {
  insights: Insight[];
  summary: string;
};

// ─── OpenAI client factory ────────────────────────────────────────────────────

function makeClient() {
  return new OpenAI({
    baseURL: "https://ai-gateway.hercules.app/v1",
    apiKey: process.env.HERCULES_API_KEY,
  });
}

// ─── Copilot: natural-language Q&A with lab context ──────────────────────────

export const copilotQuery = action({
  args: {
    question: v.string(),
    labContextJson: v.string(),   // JSON-serialised lab snapshot built on frontend
    historyJson: v.optional(v.string()), // prior messages
  },
  handler: async (_ctx, args): Promise<{ answer: string }> => {
    const openai = makeClient();

    const systemPrompt = `You are an expert Laboratory Information Management System (LIMS) AI Copilot embedded in NextGen AI-LIMS.
You have access to a live snapshot of the laboratory's operational data provided in the user message.
Your role is to:
- Answer questions about samples, tests, TAT, quality issues, instruments, inventory, and billing clearly and concisely.
- Identify trends, bottlenecks, and anomalies.
- Provide actionable, specific recommendations.
- Format numbers, dates, and tables neatly using markdown.
- Keep answers focused and practical — no generic advice.
- When asked for predictions or forecasts, reason from the data provided.`;

    type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
    const history: ChatMsg[] = args.historyJson
      ? (JSON.parse(args.historyJson) as ChatMsg[])
      : [];

    const userContent = `Lab data snapshot:\n${args.labContextJson}\n\nQuestion: ${args.question}`;

    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),  // keep last 10 turns for context
      { role: "user", content: userContent },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages,
      });
      return { answer: response.choices[0]?.message?.content ?? "No response generated." };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to generate response. Please try again.");
    }
  },
});

// ─── Insights: structured anomaly + recommendation analysis ──────────────────

export const generateInsights = action({
  args: {
    labContextJson: v.string(),
  },
  handler: async (_ctx, args): Promise<AiInsightsPayload> => {
    const openai = makeClient();

    const systemPrompt = `You are an AI analyst for a Laboratory Information Management System.
Given operational lab data, identify the most important insights, anomalies, and risks.
Return a JSON object with:
{
  "insights": [
    {
      "category": one of "tat"|"workload"|"quality"|"instrument"|"inventory"|"billing",
      "severity": "info"|"warning"|"critical",
      "title": "short title (max 8 words)",
      "detail": "1-2 sentences explaining the finding",
      "recommendation": "1 specific actionable recommendation"
    }
  ],
  "summary": "2-3 sentence executive summary of the lab's current status"
}
Return 4-8 insights. Focus on what needs attention. Be specific with numbers from the data.`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lab data:\n${args.labContextJson}` },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as AiInsightsPayload;
      return parsed;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to generate insights. Please try again.");
    }
  },
});

// ─── System Help: guides any user through the LIMS ──────────────────────────

export const systemHelpQuery = action({
  args: {
    question: v.string(),
    historyJson: v.optional(v.string()),
    userRole: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ answer: string }> => {
    const openai = makeClient();

    const systemPrompt = `You are a friendly, helpful support assistant for a Laboratory Information Management System (LIMS) called "LIMS — powered by AI Data Software Solutions LLC".

Your job is to help laboratory staff understand and use the system. You answer questions clearly, step-by-step, and in plain English. Be concise but thorough.

== SYSTEM MODULES YOU KNOW ABOUT ==

1. DASHBOARD — Overview of all lab activity. Shows sample counts, TAT metrics, charts, recent activity, and quick action buttons.

2. CUSTOMERS — Manage client organisations, contacts, and projects. Each customer has a unique code, billing address, and payment terms.

3. SAMPLES — 
   - Register Sample: Enter new samples. Fill in LIMS number (auto-generated), customer, sample name, type, batch/lot, collection date, priority (Routine/Urgent/STAT), container info, storage conditions, and requested completion date.
   - All Samples: View and filter all samples. Each sample shows status badge, LIMS number, customer name, priority, and key dates.
   - Sample statuses: Draft → Registered → Received → Accepted/Rejected → Assigned → Testing → Result Entered → Pending Review → Pending QA → Approved → COA Generated → Delivered.

4. LABORATORY →
   - Work Assignment: Supervisors assign tests to analysts. Filter by unassigned tests, pick an analyst, and click Assign.
   - My Tests: Analysts see their assigned tests, click Start, enter results, and Submit for review.
   - Scheduling: Calendar of sample deadlines, instrument calibrations, and maintenance. Workload view shows per-analyst load. Capacity Planner shows a weekly heatmap.

5. QUALITY →
   - Technical Review: Supervisors review submitted results, check against limits, and approve or return with comments.
   - QA Approval: QA Officers do final sign-off before COA generation.
   - Quality Management: Manage OOS Investigations, Deviations, CAPAs (Corrective and Preventive Actions), and Change Controls.

6. REPORTS — Generate sample reports and COA (Certificate of Analysis) PDFs.

7. ANALYTICS — Management dashboard with KPI cards, charts, date-range filters, SLA gauge, analyst performance, and revenue trends. CSV export available.

8. AI COPILOT (managers only) — Ask the AI about live lab data: TAT risks, quality trends, workload, inventory alerts, billing. Includes Smart Insights and TAT Prediction tabs.

9. BILLING — Quotations, Invoices (with multi-currency support and PDF download), Payments, Complaints. Create invoices from the Invoices tab.

10. PORTAL — Customer-facing view showing their own samples, results, and invoices.

11. INSTRUMENTS — Manage lab instruments, track calibration schedules, log maintenance events.

12. INVENTORY — Track reagents, consumables, standards. Get alerts for low stock and expiring items.

13. ADMINISTRATION (admin/manager only) →
    - Users & Roles: Add users, change roles (System Admin, Lab Manager, Supervisor, Analyst, QA Officer, Reception, Customer). New registrations default to System Admin.
    - Laboratories, Departments, Test Methods, Test Catalogue.

== ROLES & ACCESS ==
- System Admin: Full access to everything.
- Lab Manager: Full access except some admin functions.
- Supervisor: Lab work, technical review, AI Copilot.
- Analyst: My Tests, samples, lab work only.
- QA Officer: QA Approval, quality management.
- Reception: Billing, portal, sample registration.
- Customer: Portal only (their own data).

== HOW TO GUIDES ==
- How to register a sample: Go to Samples → Register Sample. Fill in customer, sample name, type, priority, and click Submit.
- How to assign tests: Go to Laboratory → Work Assignment. Select unassigned tests, choose an analyst, click Assign.
- How to enter results: Go to Laboratory → My Tests. Click Start on a test, enter the result value, and click Submit for Review.
- How to approve results: Go to Quality → Technical Review (Supervisor) then Quality → QA Approval (QA Officer).
- How to generate a COA: After QA Approval, open the sample in All Samples and click Generate COA.
- How to create an invoice: Go to Billing → Invoices tab → click + Invoice. Choose a customer, currency, add line items, set due date.
- How to download an invoice PDF: In Billing → Invoices, click the PDF button on any invoice row.
- How to change a user's role: Go to Administration → Users & Roles. Find the user and select a new role from the dropdown.
- How to add a new customer: Go to Customers → Customer List → click + New Customer.

${args.userRole ? `The user's current role is: ${args.userRole}. Tailor your answer to what they can access.` : ""}

Always be helpful, friendly, and specific. If you don't know something, say so and suggest where they might find the answer (e.g. contact their system admin).`;

    type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
    const history: ChatMsg[] = args.historyJson
      ? (JSON.parse(args.historyJson) as ChatMsg[])
      : [];

    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8),
      { role: "user", content: args.question },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages,
      });
      return { answer: response.choices[0]?.message?.content ?? "Sorry, I could not generate a response. Please try again." };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Error: ${error.message}`);
      }
      throw new Error("Failed to get AI response. Please try again.");
    }
  },
});

// ─── Anomaly detection on result entry ───────────────────────────────────────

export const detectResultAnomaly = action({
  args: {
    testName: v.string(),
    testCode: v.string(),
    resultValue: v.string(),
    unit: v.optional(v.string()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    historicalResultsJson: v.optional(v.string()), // last N results as [{value, date}]
    sampleType: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    isAnomalous: boolean;
    oosFlag: boolean;
    confidenceScore: number;
    explanation: string;
    recommendation: string;
    severity: "none" | "low" | "medium" | "high";
  }> => {
    const openai = makeClient();

    const systemPrompt = `You are an expert laboratory quality control system that detects anomalous test results.
Given a test result and its acceptance limits, determine if the result is anomalous or out-of-specification.
Return a JSON object:
{
  "isAnomalous": boolean (true if statistically unusual, even if in-spec),
  "oosFlag": boolean (true if outside acceptance limits),
  "confidenceScore": number (0-100, your confidence in the anomaly assessment),
  "explanation": "1-2 sentence explanation of why this result is/isn't anomalous",
  "recommendation": "specific action recommendation",
  "severity": "none" | "low" | "medium" | "high"
}
Consider: OOS status, statistical outlier vs historical trend, proximity to limits, data patterns.`;

    const userContent = `Test: ${args.testName} (${args.testCode})
Result: ${args.resultValue}${args.unit ? ` ${args.unit}` : ""}
Acceptance limits: ${args.lowerLimit ?? "none"} – ${args.upperLimit ?? "none"}${args.unit ? ` ${args.unit}` : ""}
Sample type: ${args.sampleType ?? "unknown"}
Historical results: ${args.historicalResultsJson ?? "no history available"}`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        isAnomalous: boolean;
        oosFlag: boolean;
        confidenceScore: number;
        explanation: string;
        recommendation: string;
        severity: "none" | "low" | "medium" | "high";
      };
      return parsed;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to analyse result.");
    }
  },
});

// ─── AI-generated OOS investigation summary ──────────────────────────────────

export const generateOosSummary = action({
  args: {
    oosNumber: v.string(),
    title: v.string(),
    description: v.string(),
    testName: v.optional(v.string()),
    resultValue: v.optional(v.string()),
    limits: v.optional(v.string()),
    sampleType: v.optional(v.string()),
    phase1Summary: v.optional(v.string()),
    phase2Summary: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{
    rootCauseHypothesis: string;
    probableCategory: string;
    confidenceScore: number;
    investigationSteps: string[];
    preventiveMeasures: string[];
    executiveSummary: string;
  }> => {
    const openai = makeClient();

    const systemPrompt = `You are a GMP-expert quality assurance specialist for a pharmaceutical/chemical laboratory.
Given an OOS investigation record, generate a structured investigation report.
Return a JSON object:
{
  "rootCauseHypothesis": "most probable root cause in 1-2 sentences",
  "probableCategory": "Analyst Error" | "Instrument Error" | "Method Error" | "Sample Error" | "Environmental" | "Unknown",
  "confidenceScore": number (0-100, confidence in root cause assessment),
  "investigationSteps": ["step 1", "step 2", ...] (4-6 specific investigation actions),
  "preventiveMeasures": ["measure 1", ...] (2-4 recommended CAPA actions),
  "executiveSummary": "3-4 sentence professional executive summary of the OOS event and investigation status"
}`;

    const userContent = `OOS Investigation: ${args.oosNumber}
Title: ${args.title}
Description: ${args.description}
Test: ${args.testName ?? "N/A"}, Result: ${args.resultValue ?? "N/A"}, Limits: ${args.limits ?? "N/A"}
Sample Type: ${args.sampleType ?? "N/A"}
Phase 1 Summary: ${args.phase1Summary ?? "Not started"}
Phase 2 Summary: ${args.phase2Summary ?? "Not started"}
Notes: ${args.notes ?? "None"}`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as {
        rootCauseHypothesis: string;
        probableCategory: string;
        confidenceScore: number;
        investigationSteps: string[];
        preventiveMeasures: string[];
        executiveSummary: string;
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to generate OOS summary.");
    }
  },
});

// ─── Predictive OOS risk from trend data ─────────────────────────────────────

export const predictOosRisk = action({
  args: {
    labContextJson: v.string(),  // includes recent OOS events, test categories, trends
  },
  handler: async (_ctx, args): Promise<{
    riskItems: {
      category: string;
      testName: string;
      riskLevel: "high" | "medium" | "low";
      confidenceScore: number;
      trendReason: string;
      recommendation: string;
    }[];
    overallRiskScore: number;
    summary: string;
  }> => {
    const openai = makeClient();

    const systemPrompt = `You are a predictive quality analytics engine for a laboratory.
Analyse OOS event history and identify tests/categories at elevated risk of future OOS events.
Return a JSON object:
{
  "riskItems": [
    {
      "category": "test category name",
      "testName": "specific test or 'Multiple tests'",
      "riskLevel": "high" | "medium" | "low",
      "confidenceScore": 0-100,
      "trendReason": "1 sentence explaining the trend pattern",
      "recommendation": "specific preventive action"
    }
  ],
  "overallRiskScore": number (0-100, 100=highest risk),
  "summary": "2-3 sentence summary of OOS risk landscape"
}
Identify 3-6 risk items. Base predictions on frequency, recency, clustering, and patterns.`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lab quality data:\n${args.labContextJson}` },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as {
        riskItems: {
          category: string;
          testName: string;
          riskLevel: "high" | "medium" | "low";
          confidenceScore: number;
          trendReason: string;
          recommendation: string;
        }[];
        overallRiskScore: number;
        summary: string;
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to predict OOS risk.");
    }
  },
});

// ─── Analyst productivity analysis ───────────────────────────────────────────

export const analyseAnalystProductivity = action({
  args: {
    analystDataJson: v.string(), // array of analyst performance stats
    labContextJson: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    topPerformer: { name: string; reason: string };
    bottleneck: { name: string; reason: string; recommendation: string };
    teamInsights: string[];
    workloadBalance: "balanced" | "imbalanced" | "critical";
    confidenceScore: number;
    summary: string;
  }> => {
    const openai = makeClient();

    const systemPrompt = `You are a laboratory operations analyst specialising in analyst performance and productivity.
Given analyst performance data, generate actionable productivity insights.
Return a JSON object:
{
  "topPerformer": { "name": "analyst name", "reason": "why they stand out" },
  "bottleneck": { "name": "analyst name", "reason": "performance concern", "recommendation": "specific action" },
  "teamInsights": ["insight 1", "insight 2", "insight 3"] (3 key team-level insights),
  "workloadBalance": "balanced" | "imbalanced" | "critical",
  "confidenceScore": 0-100,
  "summary": "2-3 sentence executive summary of team productivity"
}
If data is insufficient (e.g. <2 analysts), set topPerformer and bottleneck names to "N/A" and explain.`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyst data:\n${args.analystDataJson}\n\nLab context:\n${args.labContextJson}` },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as {
        topPerformer: { name: string; reason: string };
        bottleneck: { name: string; reason: string; recommendation: string };
        teamInsights: string[];
        workloadBalance: "balanced" | "imbalanced" | "critical";
        confidenceScore: number;
        summary: string;
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to analyse analyst productivity.");
    }
  },
});

// ─── Return types for new AI actions ─────────────────────────────────────────

type OosAnalysisResult = {
  rootCauses: Array<{ cause: string; probability: "high" | "medium" | "low"; category: string; evidence: string }>;
  recommendedActions: string[];
  immediateActions: string[];
  investigationChecklist: string[];
  aiConclusion: string;
  confidenceScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
};

type TrendAnalysisResult = {
  alerts: Array<{
    testName: string; testCode: string;
    severity: "critical" | "warning" | "watch";
    message: string; trend: "ascending" | "descending" | "oscillating" | "stable";
    predictedOosIn: string; recommendation: string; currentValue: number; percentToLimit: number;
  }>;
  overallHealthScore: number;
  summary: string;
};

type BatchReleaseResult = {
  recommendation: "RELEASE" | "REJECT" | "CONDITIONAL_RELEASE" | "ADDITIONAL_TESTING";
  confidence: number; rationale: string; keyFindings: string[];
  conditions: string[]; regulatoryConsiderations: string[];
  qcSummary: string; riskLevel: "low" | "medium" | "high" | "critical";
};

type RetestJustificationResult = {
  justificationText: string; regulatoryBasis: string;
  retestProtocol: string[]; acceptanceCriteria: string;
  documentationRequired: string[];
};

type AnomalyDetectionResult = {
  anomalies: Array<{
    type: "statistical" | "pattern" | "systematic" | "instrument" | "analyst" | "temporal";
    severity: "critical" | "warning" | "info";
    title: string; description: string; affectedTests: string[];
    recommendation: string; evidence: string;
  }>;
  totalResultsAnalyzed: number;
  anomalyRate: number;
  labHealthIndex: number;
  executiveSummary: string;
};

// ─── OOS Investigation Assistant ─────────────────────────────────────────────

export const analyzeOosInvestigation = action({
  args: {
    testName: v.string(),
    testCode: v.string(),
    measuredValue: v.number(),
    unit: v.optional(v.string()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    sampleName: v.string(),
    sampleType: v.optional(v.string()),
    batchNumber: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    limsNumber: v.string(),
    historicalValuesJson: v.string(),   // last 20 results for this test
    westgardViolations: v.optional(v.array(v.string())),
    additionalContext: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<OosAnalysisResult> => {
    const openai = makeClient();

    const systemPrompt = `You are an expert pharmaceutical/analytical chemistry QA consultant specializing in OOS (Out-of-Specification) investigation for LIMS.
Given an OOS result with historical context, identify probable root causes, assign confidence scores, and recommend investigation steps per ICH Q2, FDA 21 CFR 211, and USP <1010> guidance.

Return a JSON object exactly as:
{
  "rootCauses": [
    {
      "cause": "Specific root cause description",
      "probability": "high"|"medium"|"low",
      "category": "Analyst"|"Instrument"|"Method"|"Sample"|"Environment"|"Reagent"|"Calculation"|"Transcription",
      "evidence": "1-2 sentences of supporting evidence from the data"
    }
  ],
  "recommendedActions": ["action1", "action2", ...],
  "immediateActions": ["immediate action 1", ...],
  "investigationChecklist": ["checklist item 1", ...],
  "aiConclusion": "2-3 sentence professional summary of the OOS investigation findings",
  "confidenceScore": 0-100,
  "riskLevel": "critical"|"high"|"medium"|"low"
}
Provide 3-6 root causes ordered by probability. Make recommendations specific and actionable.`;

    const deviation = args.lowerLimit !== undefined || args.upperLimit !== undefined
      ? `OOS deviation: value ${args.measuredValue}${args.unit ?? ""}, limits [${args.lowerLimit ?? "—"} – ${args.upperLimit ?? "—"}]`
      : `Result: ${args.measuredValue}${args.unit ?? ""}`;

    const userContent = `
Test: ${args.testCode} — ${args.testName}
Sample: ${args.sampleName} (${args.sampleType ?? "unknown type"})
LIMS#: ${args.limsNumber}
Batch: ${args.batchNumber ?? "N/A"}, Lot: ${args.lotNumber ?? "N/A"}
${deviation}
Westgard violations: ${args.westgardViolations?.join(", ") || "None"}
Historical results (most recent last): ${args.historicalValuesJson}
${args.additionalContext ? `Additional context: ${args.additionalContext}` : ""}
`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as OosAnalysisResult;
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("OOS analysis failed. Please try again.");
    }
  },
});

// ─── Predictive Trend Alerts ──────────────────────────────────────────────────

export const analyzePredictiveTrends = action({
  args: {
    trendDataJson: v.string(), // array of { testId, testName, testCode, values: number[], unit, lowerLimit, upperLimit, timestamps }
    laboratoryName: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<TrendAnalysisResult> => {
    const openai = makeClient();

    const systemPrompt = `You are a predictive analytics engine for a pharmaceutical laboratory.
Analyze trend data for multiple tests and identify which are approaching specification limits before they go OOS.
Apply statistical drift detection, trend analysis (Westgard 7T rule context), and predictive modeling.

Return JSON:
{
  "alerts": [
    {
      "testName": "...",
      "testCode": "...",
      "severity": "critical"|"warning"|"watch",
      "message": "Concise alert message",
      "trend": "ascending"|"descending"|"oscillating"|"stable",
      "predictedOosIn": "e.g. 2-3 runs" or "~5 days" or "imminent",
      "recommendation": "Specific corrective action to take now",
      "currentValue": number (last value),
      "percentToLimit": number (0-100, how close to the nearest limit as percentage)
    }
  ],
  "overallHealthScore": 0-100,
  "summary": "2-3 sentence executive summary of trend health"
}
Only include tests with genuine concerns (severity watch, warning, or critical). If all tests are stable, return empty alerts array.`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lab: ${args.laboratoryName ?? "Unknown"}\nTrend data:\n${args.trendDataJson}` },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as TrendAnalysisResult;
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("Trend analysis failed. Please try again.");
    }
  },
});

// ─── Batch Release Recommendation ────────────────────────────────────────────

export const generateBatchReleaseRecommendation = action({
  args: {
    sampleDataJson: v.string(),  // { limsNumber, sampleName, batchNo, lotNo, customer, sampleType, tests: [{name, code, result, unit, spec, status, westgard}] }
    validationSummaryJson: v.string(), // { total, pass, fail, pending, oos, westgardFlags }
    retestSummaryJson: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BatchReleaseResult> => {
    const openai = makeClient();

    const systemPrompt = `You are a senior QA pharmacist/quality release specialist for a pharmaceutical analytical laboratory.
Based on sample test results, validation data, and QC metrics, provide a formal batch release recommendation.
Apply ICH Q6A, USP, EP, and GMP standards.

Return JSON:
{
  "recommendation": "RELEASE"|"REJECT"|"CONDITIONAL_RELEASE"|"ADDITIONAL_TESTING",
  "confidence": 0-100,
  "rationale": "3-4 sentence professional rationale",
  "keyFindings": ["finding 1", "finding 2", ...],
  "conditions": ["condition 1", ...] (empty array if RELEASE or REJECT),
  "regulatoryConsiderations": ["consideration 1", ...],
  "qcSummary": "1-2 sentence QC status summary",
  "riskLevel": "low"|"medium"|"high"|"critical"
}`;

    const content = `Sample data:\n${args.sampleDataJson}\n\nValidation summary:\n${args.validationSummaryJson}${args.retestSummaryJson ? `\n\nRetest summary:\n${args.retestSummaryJson}` : ""}`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as BatchReleaseResult;
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("Batch release analysis failed.");
    }
  },
});

// ─── Smart Retest Justification ───────────────────────────────────────────────

export const suggestRetestJustification = action({
  args: {
    testName: v.string(),
    testCode: v.string(),
    originalResult: v.number(),
    unit: v.optional(v.string()),
    lowerLimit: v.optional(v.number()),
    upperLimit: v.optional(v.number()),
    reason: v.string(),  // analyst-selected reason code
    sampleType: v.optional(v.string()),
    analystNote: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<RetestJustificationResult> => {
    const openai = makeClient();

    const systemPrompt = `You are a QA specialist helping write formal retest justifications for a pharmaceutical LIMS.
Write professional, GMP-compliant retest justifications following FDA OOS guidance (2006) and ICH Q2R1.

Return JSON:
{
  "justificationText": "Formal 2-3 paragraph justification suitable for QA record",
  "regulatoryBasis": "The specific guideline/regulation that supports this retest",
  "retestProtocol": ["step 1", "step 2", ...],
  "acceptanceCriteria": "What constitutes a valid retest result",
  "documentationRequired": ["doc 1", "doc 2", ...]
}`;

    const deviation = args.lowerLimit !== undefined || args.upperLimit !== undefined
      ? `Limits: [${args.lowerLimit ?? "—"} – ${args.upperLimit ?? "—"}] ${args.unit ?? ""}`
      : "";

    const userContent = `Test: ${args.testCode} — ${args.testName}
Sample type: ${args.sampleType ?? "Unknown"}
Original result: ${args.originalResult} ${args.unit ?? ""}
${deviation}
Retest reason selected: ${args.reason}
Analyst note: ${args.analystNote ?? "None"}`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as RetestJustificationResult;
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("Retest justification generation failed.");
    }
  },
});

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export const detectAnomalies = action({
  args: {
    resultsJson: v.string(), // array of { testName, testCode, result, unit, date, analyst, instrument, sampleType, status }
    laboratoryName: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<AnomalyDetectionResult> => {
    const openai = makeClient();

    const systemPrompt = `You are an advanced anomaly detection engine for a pharmaceutical laboratory.
Analyze a batch of test results to identify statistical anomalies, systematic patterns, analyst-specific issues, instrument drift, temporal clustering, and other quality concerns.

Apply: Grubbs test logic, control chart interpretation, analyst performance comparison, instrument correlation analysis, temporal pattern detection.

Return JSON:
{
  "anomalies": [
    {
      "type": "statistical"|"pattern"|"systematic"|"instrument"|"analyst"|"temporal",
      "severity": "critical"|"warning"|"info",
      "title": "Short anomaly title (max 8 words)",
      "description": "2-3 sentence description of the anomaly",
      "affectedTests": ["test1", "test2"],
      "recommendation": "Specific corrective action",
      "evidence": "Quantitative evidence from the data"
    }
  ],
  "totalResultsAnalyzed": number,
  "anomalyRate": number (0-100, percentage of results involved in anomalies),
  "labHealthIndex": number (0-100, overall lab quality health),
  "executiveSummary": "3-4 sentence summary of lab quality status"
}
Return 0-8 anomalies. Only flag genuine concerns backed by data.`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lab: ${args.laboratoryName ?? "Unknown"}\nResults dataset:\n${args.resultsJson}` },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(raw) as AnomalyDetectionResult;
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("Anomaly detection failed.");
    }
  },
});

export const predictTat = action({
  args: {
    samplesJson: v.string(),     // active samples with test counts, priority, age
    historicalJson: v.string(),  // historical TAT stats by test category
  },
  handler: async (_ctx, args): Promise<{ predictions: string; rawJson: string }> => {
    const openai = makeClient();

    const systemPrompt = `You are a predictive analytics engine for a laboratory.
Given a list of active samples (with test count, priority, age in days, status) and historical average TAT data,
predict which samples are at risk of exceeding TAT targets.

Return a JSON object:
{
  "atRisk": [
    { "limsNumber": "...", "sampleName": "...", "reason": "...", "estimatedDaysRemaining": 2, "riskLevel": "high"|"medium"|"low" }
  ],
  "onTrack": number,
  "avgRemainingDays": number,
  "tatHealthScore": number (0-100, 100 = perfect, lower = more at risk)
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Active samples:\n${args.samplesJson}\n\nHistorical TAT:\n${args.historicalJson}` },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      return { predictions: raw, rawJson: raw };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI Gateway Error: ${error.message}`);
      }
      throw new Error("Failed to predict TAT.");
    }
  },
});
