import { cn } from "@/lib/utils.ts";

type StatusVariant =
  | "draft" | "registered" | "awaiting_receipt" | "received" | "accepted"
  | "rejected" | "assigned" | "preparation" | "testing" | "result_entered"
  | "pending_review" | "returned" | "pending_qa" | "oos_investigation"
  | "approved" | "coa_generated" | "delivered" | "stored" | "disposed"
  | "cancelled" | "not_assigned" | "in_progress" | "submitted"
  | "technically_approved" | "qa_approved" | "failed" | "oos"
  | "routine" | "urgent" | "stat"
  | "active" | "inactive";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  registered: { label: "Registered", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  awaiting_receipt: { label: "Awaiting Receipt", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  received: { label: "Received", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  assigned: { label: "Assigned", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  preparation: { label: "Preparation", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  testing: { label: "Testing", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  result_entered: { label: "Result Entered", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  pending_review: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  returned: { label: "Returned", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  pending_qa: { label: "Pending QA", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  oos_investigation: { label: "OOS Investigation", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  coa_generated: { label: "COA Generated", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  stored: { label: "Stored", className: "bg-muted text-muted-foreground" },
  disposed: { label: "Disposed", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  not_assigned: { label: "Not Assigned", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  submitted: { label: "Submitted", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  technically_approved: { label: "Tech. Approved", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  qa_approved: { label: "QA Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  oos: { label: "OOS", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  routine: { label: "Routine", className: "bg-muted text-muted-foreground" },
  urgent: { label: "Urgent", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  stat: { label: "STAT", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export { statusConfig };
