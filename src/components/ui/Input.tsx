"use client";

import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: boolean;
  /** Show character count for text fields with maxLength */
  showCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      success,
      showCount,
      className,
      type = "text",
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;
    const currentLength = String(value ?? "").length;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={props.id}
            className="text-sm font-medium text-ink"
          >
            {label}
            {props.required && (
              <span className="text-error ml-1" aria-hidden>*</span>
            )}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            type={resolvedType}
            value={value}
            maxLength={maxLength}
            className={cn(
              // Base
              "w-full px-4 py-3 text-base text-ink",
              "bg-white border rounded-xl",
              "placeholder:text-ink-faint",
              "transition-all duration-200",
              "min-h-[48px]", // comfortable touch target
              // State: default
              !error && !success && "border-surface-border focus:border-brand focus:ring-3 focus:ring-brand/10",
              // State: error
              error && "border-error focus:border-error focus:ring-3 focus:ring-error/10",
              // State: success
              success && !error && "border-success focus:border-success focus:ring-3 focus:ring-success/10",
              // Right padding for icon
              (isPassword || success || error) && "pr-12",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              [
                error && `${props.id}-error`,
                hint && `${props.id}-hint`,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            {...props}
          />

          {/* Right icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-ink-muted hover:text-ink transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            )}
            {success && !error && !isPassword && (
              <CheckCircle2 className="w-5 h-5 text-success" />
            )}
            {error && (
              <AlertCircle className="w-5 h-5 text-error" />
            )}
          </div>
        </div>

        {/* Hint + count row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.p
                  key="error"
                  id={`${props.id}-error`}
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="text-sm text-error"
                >
                  {error}
                </motion.p>
              ) : hint ? (
                <motion.p
                  key="hint"
                  id={`${props.id}-hint`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-ink-muted"
                >
                  {hint}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
          {showCount && maxLength && (
            <span className="text-xs text-ink-faint shrink-0">
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";
