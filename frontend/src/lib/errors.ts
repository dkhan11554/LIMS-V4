/**
 * Intelligent Error Handling System — M37 companion
 *
 * Human-friendly error messages, field context, suggestions,
 * severity levels, and logging payloads.
 */

// ─── Severity Levels ──────────────────────────────────────────────────────────

export type ErrorSeverity =
  | "info"
  | "warning"
  | "validation"
  | "business"
  | "permission"
  | "security"
  | "critical";

// ─── Structured Error ─────────────────────────────────────────────────────────

export type SmartError = {
  /** Short, human-readable headline */
  title: string;
  /** Plain-language explanation of what went wrong */
  detail: string;
  /** Why it happened */
  why: string;
  /** Step-by-step fix suggestions */
  howToFix: string[];
  severity: ErrorSeverity;
  /** Field ID to scroll to / highlight */
  fieldId?: string;
  /** Human-readable field name */
  fieldLabel?: string;
  /** Optional CTA label + href */
  cta?: { label: string; href?: string; action?: string };
};

export type FieldError = {
  message: string;
  why: string;
  suggestion: string;
};

// ─── Field-level validation errors ────────────────────────────────────────────

export const FIELD_ERRORS: Record<string, FieldError> = {
  customerId: {
    message: "Customer is required.",
    why: "Every sample must be linked to a customer for billing, reporting, and COA generation.",
    suggestion: "Select an existing customer from the list, or create a new customer first.",
  },
  sampleName: {
    message: "Sample name is required.",
    why: "The sample name identifies the material being tested throughout the workflow.",
    suggestion: "Enter a descriptive name, e.g. 'Paracetamol Tablets 500mg Batch A'.",
  },
  sampleType: {
    message: "Sample type is required.",
    why: "Sample type determines the applicable test methods and regulatory requirements.",
    suggestion: "Choose the closest match from the dropdown: Raw Material, Finished Product, etc.",
  },
  selectedTests: {
    message: "At least one test must be selected.",
    why: "A sample without any tests cannot progress through the laboratory workflow.",
    suggestion: "Use the test search on the right to find and select at least one test to perform.",
  },
  collectionDate: {
    message: "Collection date cannot be in the future.",
    why: "The sample has already been received, so the collection date must be today or earlier.",
    suggestion: "Enter today's date or the actual date the sample was collected.",
  },
  expiryDate: {
    message: "Expiry date must be after the manufacturing date.",
    why: "A product cannot expire before it was manufactured.",
    suggestion: "Check the batch documentation and correct either the manufacturing or expiry date.",
  },
  requestedCompletionDate: {
    message: "Completion date must be in the future.",
    why: "The requested turnaround date should allow enough time for testing.",
    suggestion: "Enter a date at least 1 day in the future, or leave blank for the default TAT.",
  },
  containerCount: {
    message: "Container count must be a positive number.",
    why: "At least one container must be received to proceed with testing.",
    suggestion: "Enter the number of containers received, e.g. 1, 3, or 10.",
  },
  laboratoryId: {
    message: "No laboratory is selected.",
    why: "All samples must be registered against a specific laboratory.",
    suggestion: "Make sure your account is assigned to a laboratory. Contact your administrator if needed.",
  },
  email: {
    message: "Please enter a valid email address.",
    why: "The email format is incorrect — it should look like 'name@company.com'.",
    suggestion: "Check for typos, missing @ symbol, or invalid characters.",
  },
  phone: {
    message: "Please enter a valid phone number.",
    why: "The phone number format is not recognised.",
    suggestion: "Include the country code, e.g. +44 20 1234 5678 or +1 (555) 000-0000.",
  },
  resultValue: {
    message: "Result value must be a number.",
    why: "Analytical results must be numeric for calculations, Westgard rules, and spec checks.",
    suggestion: "Enter only digits and a decimal point, e.g. 98.6. Do not include units in this field.",
  },
  resultValueOos: {
    message: "Result value is outside the specification limits.",
    why: "The entered value exceeds the allowed specification range, which triggers an OOS investigation.",
    suggestion: "Double-check your calculation. If the result is correct, proceed — an OOS flag will be raised automatically.",
  },
  instrumentId: {
    message: "Instrument is required.",
    why: "Recording which instrument was used is mandatory for traceability and audit purposes.",
    suggestion: "Select the instrument from the list. If it is under maintenance, choose an alternative.",
  },
  analystId: {
    message: "Analyst must be assigned.",
    why: "Tests must be assigned to a qualified analyst before they can begin.",
    suggestion: "Select an analyst from the Work Assignment page, or assign one directly.",
  },
};

// ─── Business rule errors ─────────────────────────────────────────────────────

export const BUSINESS_ERRORS: Record<string, SmartError> = {
  duplicate_sample: {
    title: "Duplicate Sample Detected",
    detail: "A sample with this batch/lot number already exists in the system.",
    why: "The system prevents duplicate registrations to maintain data integrity and avoid billing errors.",
    howToFix: [
      "Search for the existing sample in All Samples.",
      "Open the existing record and check if it is the same submission.",
      "If it is a new submission, use a different batch or lot number.",
    ],
    severity: "business",
    cta: { label: "Search Existing Samples", href: "/samples" },
  },
  expired_instrument: {
    title: "Instrument Calibration Expired",
    detail: "The selected instrument's calibration certificate has expired. Results obtained may be invalid.",
    why: "Using an out-of-calibration instrument violates GMP requirements and may invalidate test results.",
    howToFix: [
      "Select a different instrument with a valid calibration certificate.",
      "Contact the Laboratory Administrator to schedule recalibration.",
    ],
    severity: "business",
    cta: { label: "View Instruments", href: "/instruments" },
  },
  inactive_test: {
    title: "Test Method is Inactive",
    detail: "The selected test method is currently marked as inactive.",
    why: "Inactive tests have been suspended and cannot be used until reactivated by an administrator.",
    howToFix: [
      "Choose another active test method.",
      "Ask your administrator to reactivate the test from Administration → Test Catalogue.",
    ],
    severity: "business",
    cta: { label: "View Test Catalogue", href: "/admin/tests" },
  },
  no_permission: {
    title: "You Don't Have Permission",
    detail: "Your current role does not allow this action.",
    why: "This action is restricted to specific roles to protect data integrity and compliance.",
    howToFix: [
      "Contact your Laboratory Administrator to request elevated permissions.",
      "If you believe this is an error, ask an admin to review your role assignment.",
    ],
    severity: "permission",
    cta: { label: "Contact Admin", href: "/admin/users" },
  },
  workflow_conflict: {
    title: "Workflow Conflict",
    detail: "This action cannot be performed because the sample is at a different workflow stage.",
    why: "The LIMS enforces a strict workflow to ensure regulatory compliance and audit trail integrity.",
    howToFix: [
      "Check the sample's current status and proceed from the correct stage.",
      "Undo previous actions if permitted, or contact a supervisor.",
    ],
    severity: "business",
  },
  ai_insufficient_credits: {
    title: "AI Service Unavailable",
    detail: "The AI feature is temporarily unavailable due to usage limits.",
    why: "AI features are powered by cloud credits. Your organisation's allowance may have been reached.",
    howToFix: [
      "Try again in a few minutes.",
      "Contact your system administrator to review AI credit usage.",
    ],
    severity: "warning",
  },
};

// ─── Convert a raw error to SmartError ───────────────────────────────────────

export function parseError(error: unknown, context?: string): SmartError {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // ConvexError / API error pattern matching
  if (lower.includes("unauthenticated") || lower.includes("not logged in")) {
    return {
      title: "Session Expired",
      detail: "Your session has expired. Please sign in again to continue.",
      why: "For security, sessions expire after a period of inactivity.",
      howToFix: ["Click Sign In and enter your credentials.", "If the problem persists, clear your browser cache."],
      severity: "security",
    };
  }
  if (lower.includes("forbidden") || lower.includes("permission")) {
    return { ...BUSINESS_ERRORS.no_permission };
  }
  if (lower.includes("not_found") || lower.includes("not found")) {
    return {
      title: "Record Not Found",
      detail: context ? `The ${context} could not be found.` : "The requested record no longer exists.",
      why: "It may have been deleted by another user, or the link is outdated.",
      howToFix: ["Go back and refresh the list.", "Search for the record again."],
      severity: "warning",
    };
  }
  if (lower.includes("duplicate") || lower.includes("conflict")) {
    return { ...BUSINESS_ERRORS.duplicate_sample };
  }
  if (lower.includes("gateway") || lower.includes("credits") || lower.includes("403")) {
    return { ...BUSINESS_ERRORS.ai_insufficient_credits };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return {
      title: "Network Connection Issue",
      detail: "We couldn't reach the server. Please check your internet connection.",
      why: "The request could not be sent due to a network error.",
      howToFix: ["Check your internet connection.", "Try refreshing the page.", "If the problem continues, contact support."],
      severity: "critical",
    };
  }

  // Generic fallback
  return {
    title: "Something Went Wrong",
    detail: context
      ? `We couldn't complete the ${context} action. Please try again.`
      : "An unexpected error occurred. Please try again.",
    why: "An unexpected condition was encountered. Our team has been notified.",
    howToFix: ["Try again in a moment.", "If the problem persists, refresh the page.", "Contact support if the issue continues."],
    severity: "critical",
  };
}

// ─── Multi-field validation ───────────────────────────────────────────────────

export type ValidationIssue = {
  fieldId: string;
  fieldLabel: string;
  message: string;
  why: string;
  suggestion: string;
};

export function buildValidationSummary(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "";
  if (issues.length === 1) return `One item needs your attention before you can continue.`;
  return `We found ${issues.length} items that need your attention before you can continue.`;
}

// ─── Severity meta ────────────────────────────────────────────────────────────

export const SEVERITY_META: Record<ErrorSeverity, {
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconColor: string;
}> = {
  info:       { label: "Info",             bgClass: "bg-blue-50 dark:bg-blue-950/20",     borderClass: "border-blue-300 dark:border-blue-700",    textClass: "text-blue-800 dark:text-blue-300",    iconColor: "text-blue-500" },
  warning:    { label: "Warning",          bgClass: "bg-yellow-50 dark:bg-yellow-950/20", borderClass: "border-yellow-400 dark:border-yellow-700", textClass: "text-yellow-800 dark:text-yellow-300", iconColor: "text-yellow-500" },
  validation: { label: "Validation Error", bgClass: "bg-red-50 dark:bg-red-950/20",       borderClass: "border-red-400 dark:border-red-700",       textClass: "text-red-800 dark:text-red-300",      iconColor: "text-red-500" },
  business:   { label: "Business Rule",    bgClass: "bg-orange-50 dark:bg-orange-950/20", borderClass: "border-orange-400 dark:border-orange-700", textClass: "text-orange-800 dark:text-orange-300", iconColor: "text-orange-500" },
  permission: { label: "Access Denied",    bgClass: "bg-purple-50 dark:bg-purple-950/20", borderClass: "border-purple-400 dark:border-purple-700", textClass: "text-purple-800 dark:text-purple-300", iconColor: "text-purple-500" },
  security:   { label: "Security",         bgClass: "bg-red-50 dark:bg-red-950/30",       borderClass: "border-red-500 dark:border-red-600",       textClass: "text-red-900 dark:text-red-200",      iconColor: "text-red-600" },
  critical:   { label: "System Error",     bgClass: "bg-red-50 dark:bg-red-950/30",       borderClass: "border-red-500 dark:border-red-700",       textClass: "text-red-900 dark:text-red-200",      iconColor: "text-red-600" },
};

// ─── Log payload builder (for admin error logs) ───────────────────────────────

export type ErrorLogPayload = {
  errorId: string;
  timestamp: string;
  module: string;
  screen: string;
  action: string;
  fieldId?: string;
  category: ErrorSeverity;
  title: string;
  detail: string;
  rawMessage: string;
  userAgent: string;
  url: string;
};

export function buildErrorLog(
  error: unknown,
  smart: SmartError,
  context: { module: string; screen: string; action: string; fieldId?: string }
): ErrorLogPayload {
  return {
    errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    module: context.module,
    screen: context.screen,
    action: context.action,
    fieldId: context.fieldId,
    category: smart.severity,
    title: smart.title,
    detail: smart.detail,
    rawMessage: error instanceof Error ? error.message : String(error),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    url: typeof window !== "undefined" ? window.location.href : "unknown",
  };
}
