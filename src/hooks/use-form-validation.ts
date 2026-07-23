/**
 * useFormValidation — smart field-level validation hook
 * Tracks per-field errors, focuses and scrolls to first error, highlights fields.
 */
import { useState, useCallback, useRef } from "react";
import type { FieldError, ValidationIssue } from "@/lib/errors.ts";
import { FIELD_ERRORS } from "@/lib/errors.ts";

export type FieldErrors = Record<string, FieldError | undefined>;

export function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const clearFieldError = useCallback((fieldId: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const setFieldError = useCallback((fieldId: string, error: FieldError) => {
    setFieldErrors((prev) => ({ ...prev, [fieldId]: error }));
  }, []);

  const markTouched = useCallback((fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  }, []);

  /**
   * Validate a list of required fields and any custom rules.
   * Returns true if valid, false if errors exist (and scrolls to first error).
   */
  const validate = useCallback((
    checks: Array<{
      fieldId: string;
      fieldLabel: string;
      value: unknown;
      required?: boolean;
      custom?: () => string | null; // return error message or null if ok
    }>
  ): boolean => {
    const newErrors: FieldErrors = {};

    for (const check of checks) {
      const isEmpty =
        check.value === undefined ||
        check.value === null ||
        check.value === "" ||
        (Array.isArray(check.value) && check.value.length === 0);

      if (check.required && isEmpty) {
        const knownError = FIELD_ERRORS[check.fieldId];
        newErrors[check.fieldId] = knownError ?? {
          message: `${check.fieldLabel} is required.`,
          why: `This field is mandatory to proceed.`,
          suggestion: `Please fill in the ${check.fieldLabel} field.`,
        };
        continue;
      }

      if (check.custom) {
        const customMsg = check.custom();
        if (customMsg) {
          const knownError = FIELD_ERRORS[check.fieldId];
          newErrors[check.fieldId] = {
            message: customMsg,
            why: knownError?.why ?? "The value does not meet the required criteria.",
            suggestion: knownError?.suggestion ?? "Please correct the value and try again.",
          };
        }
      }
    }

    setFieldErrors(newErrors);

    const firstErrorId = Object.keys(newErrors)[0];
    if (firstErrorId) {
      scrollToField(firstErrorId);
      return false;
    }
    return true;
  }, []);

  const clearAll = useCallback(() => {
    setFieldErrors({});
    setTouched({});
  }, []);

  /** Scroll + focus the field with this id */
  const scrollToField = (fieldId: string) => {
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus?.();
      }
    }, 60);
  };

  /** Build ValidationIssue[] for the summary panel */
  const getIssues = useCallback((): ValidationIssue[] => {
    return Object.entries(fieldErrors)
      .filter(([, err]) => err !== undefined)
      .map(([fieldId, err]) => ({
        fieldId,
        fieldLabel: (err as FieldError).message.split(" is ")[0].replace(".", "") ?? fieldId,
        message: (err as FieldError).message,
        why: (err as FieldError).why,
        suggestion: (err as FieldError).suggestion,
      }));
  }, [fieldErrors]);

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return {
    fieldErrors,
    touched,
    hasErrors,
    setFieldError,
    clearFieldError,
    markTouched,
    validate,
    clearAll,
    scrollToField,
    getIssues,
  };
}
