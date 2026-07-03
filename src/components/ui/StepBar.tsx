"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  status: "completed" | "current" | "upcoming";
}

interface StepBarProps {
  steps: Step[];
  currentIndex: number;
  className?: string;
}

export function StepBar({ steps, currentIndex, className }: StepBarProps) {
  const pct = Math.round((currentIndex / (steps.length - 1)) * 100);

  return (
    <div className={cn("w-full", className)}>
      {/* Progress bar track */}
      <div className="relative h-1 bg-surface-border rounded-full mb-4 mx-4">
        <motion.div
          className="absolute left-0 top-0 h-full bg-brand rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1.0] }}
        />
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-between px-2">
        {steps.map((step, i) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <motion.div
                initial={false}
                animate={
                  isCompleted
                    ? { scale: 1, backgroundColor: "var(--color-brand)" }
                    : isCurrent
                    ? { scale: 1.15, backgroundColor: "var(--color-brand)" }
                    : { scale: 1, backgroundColor: "var(--color-border)" }
                }
                transition={{ duration: 0.3 }}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center",
                  "border-2",
                  isCompleted || isCurrent
                    ? "border-brand text-white"
                    : "border-surface-border text-ink-faint"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight max-w-[60px]",
                  isCurrent ? "text-brand" : isCompleted ? "text-ink-muted" : "text-ink-faint"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
