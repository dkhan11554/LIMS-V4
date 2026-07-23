import { cn } from "@/lib/utils.ts";
import { ROLE_LABELS, ROLE_COLORS, type LimsRole } from "@/hooks/use-role.ts";

interface RoleBadgeProps {
  role: string | undefined | null;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const r = (role ?? "analyst") as LimsRole;
  const label = ROLE_LABELS[r] ?? r;
  const color = ROLE_COLORS[r] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold leading-none",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
