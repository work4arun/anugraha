"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

// framer-motion's motion.button redefines these drag/animation handlers with
// different signatures than React's native ones, so omit them to avoid the clash.
type ConflictingMotionProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDragExit"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, ConflictingMotionProps> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-400 text-brand-900 shadow-brand hover:bg-brand-300 active:scale-[0.98] disabled:opacity-60",
  secondary:
    "bg-surface-subtle text-ink hover:bg-surface-border active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-brand hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50",
  outline:
    "border border-brand text-brand bg-transparent hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50",
  danger:
    "bg-error text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-base gap-2 rounded-xl",
  lg: "h-14 px-6 text-base font-semibold gap-2.5 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        className={cn(
          // Base
          "inline-flex items-center justify-center font-medium",
          "transition-all duration-200",
          "select-none cursor-pointer",
          "disabled:cursor-not-allowed",
          "min-h-[44px]", // touch target
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Width
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {iconRight && !loading && (
          <span className="shrink-0">{iconRight}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
