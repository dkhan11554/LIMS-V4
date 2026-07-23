/**
 * SmartField — wraps any input/select with:
 * - Red border highlight on error
 * - Inline error message below field
 * - "Why did this happen?" expand
 * - "How to fix" suggestion
 */
import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { FieldError } from "@/lib/errors.ts";

interface SmartFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: FieldError;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}

export function SmartField({
  id,
  label,
  required,
  error,
  children,
  className,
  hint,
}: SmartFieldProps) {
  const [showWhy, setShowWhy] = useState(false);
  const hasError = !!error;

  return (
    <div className={cn("space-y-1", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium leading-none flex items-center gap-1",
          hasError ? "text-red-600 dark:text-red-400" : "text-foreground"
        )}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden>*</span>
        )}
        {hasError && (
          <AlertCircle size={13} className="text-red-500 ml-auto shrink-0" aria-label="Validation error" />
        )}
      </label>

      {/* Wrap children to apply error border */}
      <div
        className={cn(
          "relative rounded-md transition-all",
          hasError && "ring-2 ring-red-500 ring-offset-0 rounded-md [&>*]:!border-red-500"
        )}
      >
        {children}
      </div>

      {hint && !hasError && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {/* Error message + Why/How */}
      {hasError && (
        <div
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 space-y-1.5"
          role="alert"
          aria-live="polite"
        >
          <p className="text-xs text-red-700 dark:text-red-300 font-medium flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {error.message}
          </p>

          {/* Why toggle */}
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline cursor-pointer"
            aria-expanded={showWhy}
          >
            {showWhy ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            Why did this happen?
          </button>

          {showWhy && (
            <div className="space-y-1.5 pt-0.5">
              <p className="text-xs text-red-700 dark:text-red-300 italic">{error.why}</p>
              <div className="flex items-start gap-1.5">
                <Lightbulb size={11} className="shrink-0 mt-0.5 text-yellow-500" />
                <p className="text-xs text-red-600 dark:text-red-300">{error.suggestion}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
