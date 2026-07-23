/**
 * SmartErrorDialog — rich error dialog with:
 * - Severity badge + icon
 * - Title + detail
 * - "Why did this happen?"
 * - "How to fix" steps
 * - Optional "Show me where" CTA
 * - Optional admin technical detail (expandable)
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertTriangle, AlertCircle, Info, ShieldAlert, KeyRound,
  Zap, ChevronDown, ChevronUp, Lightbulb, Navigation, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { SmartError, ErrorSeverity } from "@/lib/errors.ts";
import { SEVERITY_META } from "@/lib/errors.ts";
import { useNavigate } from "react-router-dom";

const SEVERITY_ICONS: Record<ErrorSeverity, React.ReactNode> = {
  info:       <Info size={22} />,
  warning:    <AlertTriangle size={22} />,
  validation: <AlertCircle size={22} />,
  business:   <AlertTriangle size={22} />,
  permission: <KeyRound size={22} />,
  security:   <ShieldAlert size={22} />,
  critical:   <Zap size={22} />,
};

interface SmartErrorDialogProps {
  open: boolean;
  onClose: () => void;
  error: SmartError | null;
  /** Raw technical error for admins (hidden behind expand) */
  rawError?: string;
  onShowField?: (fieldId: string) => void;
}

export function SmartErrorDialog({
  open, onClose, error, rawError, onShowField,
}: SmartErrorDialogProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const navigate = useNavigate();

  if (!error) return null;
  const meta = SEVERITY_META[error.severity];

  const handleCta = () => {
    if (error.cta?.href) {
      navigate(error.cta.href);
      onClose();
    } else if (error.cta?.action === "showField" && error.fieldId) {
      onShowField?.(error.fieldId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        {/* Colour header bar */}
        <div className={cn("px-5 py-4 flex items-start gap-3", meta.bgClass, meta.borderClass, "border-b-2")}>
          <span className={cn("shrink-0 mt-0.5", meta.iconColor)}>
            {SEVERITY_ICONS[error.severity]}
          </span>
          <div>
            <div className={cn("text-xs font-bold uppercase tracking-wider mb-0.5", meta.textClass)}>
              {meta.label}
            </div>
            <DialogTitle className={cn("text-base font-bold", meta.textClass)}>
              {error.title}
            </DialogTitle>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Main message */}
          <p className="text-sm text-foreground leading-relaxed">{error.detail}</p>

          {/* Why section */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Info size={12} /> Why did this happen?
            </div>
            <p className="text-sm text-foreground/80">{error.why}</p>
          </div>

          {/* How to fix */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Lightbulb size={12} /> How to fix
            </div>
            <ol className="space-y-1.5">
              {error.howToFix.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Show field button */}
          {error.fieldId && onShowField && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => { onShowField(error.fieldId!); onClose(); }}
            >
              <Navigation size={13} /> Show me where
            </Button>
          )}

          {/* Technical details (admin only) */}
          {rawError && (
            <div>
              <button
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showTechnical ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Technical details (admin only)
              </button>
              {showTechnical && (
                <pre className="mt-2 text-xs bg-muted rounded-md p-3 overflow-auto max-h-32 text-muted-foreground whitespace-pre-wrap break-all">
                  {rawError}
                </pre>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 pb-4 gap-2">
          {error.cta && (
            <Button size="sm" onClick={handleCta} className="gap-1.5">
              {error.cta.label}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SmartErrorBanner — inline, non-modal version for page-level errors
 */
interface SmartErrorBannerProps {
  error: SmartError | null;
  onClose?: () => void;
  className?: string;
}

export function SmartErrorBanner({ error, onClose, className }: SmartErrorBannerProps) {
  const [showWhy, setShowWhy] = useState(false);
  if (!error) return null;
  const meta = SEVERITY_META[error.severity];

  return (
    <div
      className={cn("rounded-xl border-2 p-4 space-y-2", meta.bgClass, meta.borderClass, className)}
      role="alert"
    >
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2">
          <span className={cn("shrink-0 mt-0.5", meta.iconColor)}>
            {SEVERITY_ICONS[error.severity]}
          </span>
          <div className="space-y-0.5">
            <p className={cn("text-sm font-semibold", meta.textClass)}>{error.title}</p>
            <p className="text-sm text-foreground/80">{error.detail}</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            <ChevronDown size={15} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowWhy(!showWhy)}
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1 cursor-pointer"
      >
        {showWhy ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {showWhy ? "Hide details" : "Why did this happen?"}
      </button>

      {showWhy && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-foreground/70 italic">{error.why}</p>
          <ul className="space-y-1">
            {error.howToFix.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <CheckCircle2 size={11} className="shrink-0 mt-0.5 text-green-500" /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
