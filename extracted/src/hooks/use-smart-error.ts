/**
 * useSmartError — unified hook for showing AI-powered errors.
 * - Parses raw errors into SmartError
 * - Shows SmartErrorDialog
 * - Logs to backend (fire-and-forget)
 * - Integrates with useFormValidation for field highlighting
 */
import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { parseError, buildErrorLog, type SmartError, type ErrorSeverity } from "@/lib/errors.ts";
import { useActiveLab } from "@/hooks/use-active-lab.ts";
import type { Id } from "@/convex/_generated/dataModel";

interface SmartErrorContext {
  module: string;
  screen: string;
  action: string;
  fieldId?: string;
}

export function useSmartError(context: SmartErrorContext) {
  const { labId } = useActiveLab();
  const logError = useMutation(api.errorLogs.logError);

  const [error, setError] = useState<SmartError | null>(null);
  const [rawError, setRawError] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const showError = useCallback(
    async (
      err: unknown,
      overrides?: Partial<SmartError>
    ) => {
      const smart: SmartError = { ...parseError(err, context.screen), ...overrides };
      const raw = err instanceof Error ? err.message : String(err);

      setError(smart);
      setRawError(raw);
      setOpen(true);

      // Fire-and-forget log
      try {
        const payload = buildErrorLog(err, smart, context);
        await logError({
          ...payload,
          laboratoryId: labId as Id<"laboratories"> | undefined,
        });
      } catch {
        // Never block UX on logging failure
      }
    },
    [context, labId, logError]
  );

  /** Show a pre-built SmartError directly (no parsing needed) */
  const showSmartError = useCallback(
    async (smart: SmartError, raw?: string) => {
      setError(smart);
      setRawError(raw);
      setOpen(true);

      try {
        const payload = buildErrorLog(new Error(smart.detail), smart, context);
        await logError({
          ...payload,
          laboratoryId: labId as Id<"laboratories"> | undefined,
        });
      } catch { /* silent */ }
    },
    [context, labId, logError]
  );

  const dismiss = useCallback(() => {
    setOpen(false);
    setError(null);
    setRawError(undefined);
  }, []);

  return { error, rawError, open, showError, showSmartError, dismiss };
}
