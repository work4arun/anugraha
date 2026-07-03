import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-brand-50 text-brand",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  error:   "bg-error-light text-error",
  info:    "bg-blue-50 text-blue-700",
  muted:   "bg-surface-subtle text-ink-muted",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  error:   "bg-error",
  info:    "bg-blue-500",
  muted:   "bg-ink-faint",
};

export function Badge({
  children,
  variant = "default",
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5",
        "text-xs font-medium rounded-full",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotStyles[variant])}
        />
      )}
      {children}
    </span>
  );
}
