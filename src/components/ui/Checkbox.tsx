"use client";

import { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "flex gap-3 cursor-pointer select-none",
          "min-h-[44px] items-start py-2", // generous touch target
          props.disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          {/* Custom checkbox box */}
          <motion.div
            animate={
              props.checked
                ? { backgroundColor: "var(--color-brand)", borderColor: "var(--color-brand)" }
                : { backgroundColor: "white", borderColor: "var(--color-border)" }
            }
            transition={{ duration: 0.15 }}
            className={cn(
              "w-6 h-6 rounded-md border-2 flex items-center justify-center",
              "transition-shadow duration-150",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30",
              error && "border-error"
            )}
          >
            <AnimatePresence>
              {props.checked && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1.0] }}
                >
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="flex flex-col gap-0.5 pt-0.5">
          {label && (
            <span className="text-sm font-medium text-ink leading-snug">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-ink-muted leading-relaxed">
              {description}
            </span>
          )}
          {error && (
            <span className="text-xs text-error">{error}</span>
          )}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
