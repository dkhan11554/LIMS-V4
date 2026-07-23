/**
 * ValidationSummary — "We found N items that need your attention"
 * Displays all field errors as a clickable summary banner.
 */
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { ValidationIssue } from "@/lib/errors.ts";
import { buildValidationSummary } from "@/lib/errors.ts";
import { motion, AnimatePresence } from "motion/react";

interface ValidationSummaryProps {
  issues: ValidationIssue[];
  onClose?: () => void;
  onClickIssue?: (fieldId: string) => void;
  className?: string;
}

export function ValidationSummary({
  issues,
  onClose,
  onClickIssue,
  className,
}: ValidationSummaryProps) {
  if (issues.length === 0) return null;

  const headline = buildValidationSummary(issues);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 rounded-xl p-4 space-y-3",
          className
        )}
        role="alert"
        aria-label="Validation summary"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">{headline}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Click any item below to jump directly to that field.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-red-400 hover:text-red-600 cursor-pointer shrink-0"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Issue list */}
        <ul className="space-y-1.5" role="list">
          {issues.map((issue, i) => (
            <li key={issue.fieldId}>
              <button
                type="button"
                onClick={() => onClickIssue?.(issue.fieldId)}
                className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors group cursor-pointer"
                aria-label={`Go to ${issue.fieldLabel}: ${issue.message}`}
              >
                <span className="text-xs font-mono text-red-400 w-4 shrink-0">{i + 1}.</span>
                <span className="flex-1 text-xs text-red-700 dark:text-red-300">
                  <span className="font-semibold">{issue.fieldLabel}</span>
                  {" — "}
                  {issue.message}
                </span>
                <ChevronRight
                  size={13}
                  className="text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}
