"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";

import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SignatureOtpBlock } from "@/components/signature/SignatureOtpBlock";
import { SkipStep } from "@/components/forms/SkipStep";
import { listContainer, listItem } from "@/lib/motion";
import type { AcknowledgmentSchema } from "@/types";

interface Props {
  formTemplateId: string;
  schema: unknown;
  signatoryRoles: Array<{ role: string; label: string }>;
  existingData: Record<string, unknown> | null;
  existingStatus: string;
  existingSignatures: Record<string, string>;
  priorSignatures: Record<string, string>;
  studentId: string;
  onComplete: () => void;
}

export function AcknowledgmentForm({
  formTemplateId,
  schema,
  signatoryRoles,
  existingData,
  existingStatus,
  existingSignatures,
  priorSignatures,
  onComplete,
}: Props) {
  const { clauses, acknowledgmentText, guaranteeDeclaration, allowSkip } =
    schema as AcknowledgmentSchema;

  const [acknowledged, setAcknowledged] = useState(
    !!(existingData as { acknowledged?: boolean } | null)?.acknowledged
  );
  const [signatures, setSignatures] = useState<Record<string, string>>(existingSignatures);
  const [submitting, setSubmitting] = useState(false);
  const isAlreadySubmitted = existingStatus === "SUBMITTED";

  function mergeSignatures(partial: Record<string, string>) {
    setSignatures((prev) => ({ ...prev, ...partial }));
  }

  async function submit(skipped: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/form-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId,
          data: { acknowledged, ...(skipped ? { skipped: true } : {}) },
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(skipped ? "Step completed." : "Acknowledged and signed!");
      onComplete();
    } catch {
      toast.error("Failed to save — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!acknowledged) {
      toast.error("Please read and acknowledge the clauses before proceeding");
      return;
    }
    const allSigned = signatoryRoles.every((r) => signatures[r.role]);
    if (!allSigned) {
      toast.error("Please complete all required signatures");
      return;
    }
    await submit(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4"
      >
        {/* Clauses */}
        <motion.div variants={listItem}>
          <Card padding="none" className="overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 border-b border-brand/10">
              <h3 className="text-sm font-semibold text-brand">Please read carefully</h3>
            </div>
            <ol className="flex flex-col divide-y divide-surface-border">
              {clauses.map((clause, i) => (
                <li key={i} className="flex gap-3 px-4 py-3.5 items-start">
                  <span className="text-xs font-bold text-brand/60 pt-0.5 shrink-0 w-5">
                    {i + 1}.
                  </span>
                  <p className="text-sm text-ink leading-relaxed">{clause}</p>
                </li>
              ))}
            </ol>
          </Card>
        </motion.div>

        {/* Parent declaration (placement undertaking only) */}
        {guaranteeDeclaration && (
          <motion.div variants={listItem}>
            <Card padding="md" className="bg-accent-50 border-accent/20">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-accent-dark mb-2">
                Parent / Guardian Declaration
              </h4>
              <p className="text-sm text-ink leading-relaxed">{guaranteeDeclaration}</p>
            </Card>
          </motion.div>
        )}

        {/* Acknowledgment checkbox */}
        <motion.div variants={listItem}>
          <Card padding="md" className="border-brand/20 bg-brand-50/30">
            <Checkbox
              label={acknowledgmentText}
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={isAlreadySubmitted}
            />
          </Card>
        </motion.div>

        {/* Signatures — authenticate with OTP to apply your saved signature */}
        <motion.div variants={listItem}>
          <SignatureOtpBlock
            formTemplateId={formTemplateId}
            signatoryRoles={signatoryRoles}
            masterSignatures={priorSignatures}
            existingSignatures={signatures}
            disabled={isAlreadySubmitted}
            onSigned={mergeSignatures}
          />
        </motion.div>
      </motion.div>

      {/* CTA */}
      <Button
        size="lg"
        fullWidth
        onClick={handleSubmit}
        loading={submitting}
        disabled={isAlreadySubmitted}
        iconRight={
          isAlreadySubmitted ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )
        }
        className={isAlreadySubmitted ? "bg-success hover:bg-green-700" : ""}
      >
        {isAlreadySubmitted ? "Already Submitted — Continue" : "I Acknowledge & Continue"}
      </Button>

      {allowSkip && !isAlreadySubmitted && (
        <SkipStep onSkip={() => submit(true)} disabled={submitting} />
      )}

      {isAlreadySubmitted && (
        <Button variant="ghost" size="md" fullWidth onClick={onComplete}>
          Continue to next step
        </Button>
      )}
    </div>
  );
}
