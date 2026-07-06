"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  CheckCircle2,
  Clock,
  Circle,
  ChevronRight,
  LogOut,
  GraduationCap,
  FileText,
  ClipboardList,
  Table2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Badge } from "@/components/ui/Badge";
import { AgreementsCard } from "@/components/student/AgreementsCard";
import { fadeSlideUp, listContainer, listItem } from "@/lib/motion";
import type { StudentProfile, InductionStep, StepStatus } from "@/types";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

const stepTypeIcon = {
  REGISTRATION:      FileText,
  ACKNOWLEDGMENT:    ClipboardList,
  DELIVERABLES_TABLE: Table2,
  DOCUMENT_UPLOAD:   Upload,
};

const statusConfig: Record<
  StepStatus,
  { label: string; badge: "success" | "warning" | "muted"; Icon: typeof CheckCircle2 }
> = {
  completed:   { label: "Completed",   badge: "success",  Icon: CheckCircle2 },
  in_progress: { label: "In Progress", badge: "warning",  Icon: Clock },
  not_started: { label: "Not Started", badge: "muted",    Icon: Circle },
};

function StepCard({
  step,
  index,
  onContinue,
}: {
  step: InductionStep;
  index: number;
  onContinue: (slug: string) => void;
}) {
  const { label, badge } = statusConfig[step.status];
  const StepIcon = stepTypeIcon[step.type] ?? FileText;
  const isCompleted = step.status === "completed";

  return (
    <motion.div
      variants={listItem}
      custom={index}
      onClick={() => !isCompleted && onContinue(step.stepSlug)}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl border-2",
        "transition-all duration-200",
        isCompleted
          ? "border-surface-border bg-surface-muted cursor-default"
          : "border-surface-border bg-white hover:border-brand/40 hover:shadow-card cursor-pointer active:scale-[0.99]"
      )}
    >
      {/* Step number + icon */}
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          isCompleted ? "bg-success-light" : "bg-brand-50"
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : (
          <StepIcon className="w-5 h-5 text-brand" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              isCompleted ? "text-ink-faint" : "text-brand"
            )}
          >
            Step {step.order}
          </span>
          {!step.required && (
            <Badge variant="muted" className="text-[10px]">Optional</Badge>
          )}
        </div>
        <p
          className={cn(
            "text-sm font-semibold leading-snug truncate",
            isCompleted ? "text-ink-muted" : "text-ink"
          )}
        >
          {step.name}
        </p>
        <Badge variant={badge} dot className="mt-1.5">
          {label}
        </Badge>
      </div>

      {/* Arrow */}
      {!isCompleted && (
        <ChevronRight className="w-5 h-5 text-ink-faint shrink-0" />
      )}
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function DashboardClient({ profile }: { profile: StudentProfile }) {
  const router = useRouter();

  const nextStep = profile.steps.find(
    (s) => s.status !== "completed" && s.required
  );
  const stepsDone = profile.completionPct === 100;
  const agreementsPending = profile.agreementsPending.length > 0;
  // Agreements are the last step of induction — not "done" until every one
  // is signed, even if every form step is complete.
  const allDone = stepsDone && !agreementsPending;

  function handleContinue(slug: string) {
    router.push(`/induction/${slug}`);
  }

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-surface-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {profile.batch.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.batch.logoUrl}
                alt="College logo"
                className="max-h-11 max-w-[200px] w-auto object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-brand" />
              </div>
            )}
            <span className="text-sm font-bold text-brand">Anugraha 2026</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors min-h-[44px] px-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-32 pt-6">
        {/* Welcome card */}
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          className="bg-gradient-to-br from-brand-200 to-brand-100 rounded-3xl p-6 text-brand-900 mb-6 relative overflow-hidden border border-brand-200"
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-brand-500/10" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-brand-500/10" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-brand-700 text-xs font-medium uppercase tracking-wider mb-1">
                {allDone ? "All done" : "Welcome back"}
              </p>
              <h1 className="text-2xl font-bold leading-tight truncate text-brand-900">
                Hey {firstName} 👋
              </h1>
              <p className="text-brand-800 text-sm mt-1">
                {allDone
                  ? `You're all set, ${firstName}! 🎉`
                  : nextStep
                  ? `Let's finish your induction — ${profile.completionPct}% there.`
                  : stepsDone && agreementsPending
                  ? "Just one last step — sign your agreement(s) below."
                  : "Let's get your induction started."}
              </p>
              <p className="text-brand-700 text-sm mt-1 truncate">
                {profile.regNo} · {profile.batch.course}
              </p>
              <p className="text-brand-700/80 text-xs mt-0.5">
                {profile.batch.institution.fullName}
              </p>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-brand-800 text-xs font-medium">Overall Progress</span>
                  <motion.span
                    key={profile.completionPct}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-brand-900 font-bold text-sm"
                  >
                    {profile.completionPct}%
                  </motion.span>
                </div>
                <div className="h-2 bg-brand-500/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-600 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${profile.completionPct}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1.0], delay: 0.3 }}
                  />
                </div>
              </div>
            </div>

            <ProgressRing
              pct={profile.completionPct}
              size={72}
              strokeWidth={5}
              className="[&_.text-brand]:text-brand-700 [&_.text-surface-border]:text-brand-500/20 shrink-0"
            />
          </div>
        </motion.div>

        {/* All done state */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-success-light border border-success/20 rounded-2xl p-5 mb-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="font-semibold text-success">Induction Complete!</p>
                <p className="text-sm text-success/80 mt-0.5">
                  Download your Anugraha 2026 PDF below
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Steps done, agreement(s) still awaiting signature */}
        <AnimatePresence>
          {stepsDone && agreementsPending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-warning-light border border-warning/20 rounded-2xl p-5 mb-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-warning/10 rounded-2xl flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="font-semibold text-warning">One last step</p>
                <p className="text-sm text-warning/80 mt-0.5">
                  Sign the agreement{profile.agreementsPending.length === 1 ? "" : "s"} below to
                  finish your induction
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Steps list */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
            {firstName}&apos;s Induction Checklist
          </h2>
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {profile.steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                onContinue={handleContinue}
              />
            ))}
          </motion.div>
        </div>

        {/* Agreements — admin-placed signature/checkbox/date/text fields */}
        <AgreementsCard />

        {/* Institution info */}
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
          className="bg-surface-subtle rounded-2xl p-4 text-center"
        >
          <p className="text-xs text-ink-muted">
            For assistance, contact the Admissions Office
          </p>
          <p className="text-xs font-medium text-ink mt-1">
            {profile.batch.institution.fullName}
          </p>
        </motion.div>
      </main>

      {/* Sticky bottom CTA */}
      <div className="bottom-action-bar">
        {allDone ? (
          <Button
            size="lg"
            fullWidth
            onClick={() => router.push("/complete")}
            className="bg-success hover:bg-green-700 shadow-none"
            icon={<CheckCircle2 className="w-5 h-5" />}
          >
            View & Download PDF
          </Button>
        ) : nextStep ? (
          <Button
            size="lg"
            fullWidth
            onClick={() => handleContinue(nextStep.stepSlug)}
            iconRight={<ChevronRight className="w-5 h-5" />}
          >
            Continue — {nextStep.name}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
