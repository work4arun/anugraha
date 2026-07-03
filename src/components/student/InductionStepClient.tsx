"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, GraduationCap } from "lucide-react";

import { RegistrationForm } from "@/components/forms/RegistrationForm";
import { AcknowledgmentForm } from "@/components/forms/AcknowledgmentForm";
import { DeliverablesTable } from "@/components/forms/DeliverablesTable";
import { DocumentUploadForm } from "@/components/forms/DocumentUploadForm";
import { StepBar } from "@/components/ui/StepBar";
import { fadeSlideUp } from "@/lib/motion";

interface StepData {
  assignment: {
    id: string;
    order: number;
    stepSlug: string;
    required: boolean;
    formTemplate: {
      id: string;
      name: string;
      type: string;
      schema: unknown;
      signatoryRoles: unknown;
      version: number;
    };
  };
  allSteps: Array<{ stepSlug: string; name: string; order: number }>;
  existingData: unknown;
  existingStatus: string;
  existingSignatures: Array<{ role: string; imageUrl: string }>;
  priorSignatures: Array<{ role: string; imageUrl: string }>;
  acknowledgedRowIds: string[];
  documents: Array<{ id: string; type: string; fileUrl: string; fileName: string; uploadStatus: string }>;
  institution: { code: string; fullName: string; primaryColor: string };
  studentId: string;
  batchId: string;
  studentName: string;
  batchCourse: string;
  logoUrl: string;
}

export function InductionStepClient({ stepData }: { stepData: StepData }) {
  const router = useRouter();
  const [direction, setDirection] = useState<1 | -1>(1);

  const { assignment, allSteps } = stepData;
  const firstName = (stepData.studentName || "").split(" ")[0];
  const currentIndex = allSteps.findIndex((s) => s.stepSlug === assignment.stepSlug);

  const stepBarSteps = allSteps.map((s, i) => ({
    label: s.name.split(" ").slice(0, 2).join(" "), // shorten for display
    status:
      i < currentIndex
        ? ("completed" as const)
        : i === currentIndex
        ? ("current" as const)
        : ("upcoming" as const),
  }));

  function goBack() {
    setDirection(-1);
    router.back();
  }

  function goNext(nextSlug?: string) {
    setDirection(1);
    if (nextSlug) {
      router.push(`/induction/${nextSlug}`);
    } else {
      router.push("/review");
    }
  }

  const nextStep = allSteps[currentIndex + 1];
  const isLastStep = currentIndex === allSteps.length - 1;

  const priorSignatureMap = Object.fromEntries(
    stepData.priorSignatures.map((s) => [s.role, s.imageUrl])
  );
  const existingSignatureMap = Object.fromEntries(
    stepData.existingSignatures.map((s) => [s.role, s.imageUrl])
  );

  const handleComplete = useCallback(() => {
    if (isLastStep) {
      router.push("/review");
    } else {
      goNext(nextStep?.stepSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLastStep, nextStep]);

  const templateType = assignment.formTemplate.type;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={goBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors -ml-1"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-muted font-medium">
              Step {assignment.order} of {allSteps.length}
            </p>
            <p className="text-sm font-semibold text-ink truncate">
              {assignment.formTemplate.name}
            </p>
          </div>
          {stepData.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stepData.logoUrl}
              alt="College logo"
              className="h-8 w-auto max-w-[110px] object-contain shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-brand" />
            </div>
          )}
        </div>

        {/* Step progress bar */}
        <div className="px-2 pb-3 max-w-lg mx-auto">
          <StepBar steps={stepBarSteps} currentIndex={currentIndex} />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={assignment.stepSlug}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1.0] }}
            className="px-4 py-6"
          >
            {firstName && (
              <p className="text-sm text-ink-muted mb-4">
                Hey <span className="font-semibold text-brand">{firstName}</span> 👋 — let&apos;s
                complete{" "}
                <span className="font-medium text-ink">{assignment.formTemplate.name}</span>.
              </p>
            )}

            {/* Render correct form type */}
            {templateType === "REGISTRATION" && (
              <RegistrationForm
                formTemplateId={assignment.formTemplate.id}
                schema={assignment.formTemplate.schema}
                signatoryRoles={assignment.formTemplate.signatoryRoles as Array<{ role: string; label: string }>}
                existingData={stepData.existingData as Record<string, unknown> | null}
                existingSignatures={existingSignatureMap}
                priorSignatures={priorSignatureMap}
                studentId={stepData.studentId}
                batchCourse={stepData.batchCourse}
                onComplete={handleComplete}
              />
            )}

            {templateType === "ACKNOWLEDGMENT" && (
              <AcknowledgmentForm
                formTemplateId={assignment.formTemplate.id}
                schema={assignment.formTemplate.schema}
                signatoryRoles={assignment.formTemplate.signatoryRoles as Array<{ role: string; label: string }>}
                existingData={stepData.existingData as Record<string, unknown> | null}
                existingStatus={stepData.existingStatus}
                existingSignatures={existingSignatureMap}
                priorSignatures={priorSignatureMap}
                studentId={stepData.studentId}
                onComplete={handleComplete}
              />
            )}

            {templateType === "DELIVERABLES_TABLE" && (
              <DeliverablesTable
                formTemplateId={assignment.formTemplate.id}
                schema={assignment.formTemplate.schema}
                signatoryRoles={assignment.formTemplate.signatoryRoles as Array<{ role: string; label: string }>}
                existingData={stepData.existingData as Record<string, unknown> | null}
                existingStatus={stepData.existingStatus}
                existingSignatures={existingSignatureMap}
                priorSignatures={priorSignatureMap}
                acknowledgedRowIds={stepData.acknowledgedRowIds}
                studentId={stepData.studentId}
                formTemplateId2={assignment.formTemplate.id}
                onComplete={handleComplete}
              />
            )}

            {templateType === "DOCUMENT_UPLOAD" && (
              <DocumentUploadForm
                formTemplateId={assignment.formTemplate.id}
                schema={assignment.formTemplate.schema}
                existingDocuments={stepData.documents}
                studentId={stepData.studentId}
                onComplete={handleComplete}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
