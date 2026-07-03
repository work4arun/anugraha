"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
  inline?: boolean;
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  error,
  className,
  inline = false,
}: RadioGroupProps) {
  return (
    <div
      className={cn(
        inline ? "flex flex-wrap gap-3" : "flex flex-col gap-2",
        className
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              "min-h-[48px] px-4 py-3 rounded-xl border-2 transition-all duration-200",
              isSelected
                ? "border-brand bg-brand-50"
                : "border-surface-border bg-white hover:border-brand/40",
              error && "border-error"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange?.(option.value)}
              className="sr-only"
            />
            {/* Custom radio dot */}
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                "transition-all duration-200",
                isSelected ? "border-brand" : "border-ink-faint"
              )}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1.0] }}
                  className="w-2.5 h-2.5 rounded-full bg-brand"
                />
              )}
            </div>
            <div>
              <span className={cn("text-sm font-medium", isSelected ? "text-brand" : "text-ink")}>
                {option.label}
              </span>
              {option.description && (
                <p className="text-xs text-ink-muted mt-0.5">{option.description}</p>
              )}
            </div>
          </label>
        );
      })}
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
