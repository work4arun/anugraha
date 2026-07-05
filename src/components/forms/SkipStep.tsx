"use client";

/**
 * "Skip for now" affordance shown under a step's primary CTA when the admin
 * has enabled `allowSkip` on the form template. Submits the step as-is
 * (partial data, flagged `skipped: true`) so the student can move on.
 */

export function SkipStep({
  onSkip,
  disabled,
  note = "You can complete this with the Admissions Office later.",
}: {
  onSkip: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="-mt-2 mb-8 text-center">
      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        className="text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-50 min-h-[44px] px-4"
      >
        Skip for now — continue without completing
      </button>
      <p className="text-xs text-ink-faint mt-1">{note}</p>
    </div>
  );
}
