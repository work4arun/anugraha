"use client";

/**
 * DeliverablesTable — per-row individual acknowledgment.
 *
 * Each row must be individually checked before the student can proceed.
 * Acknowledgments are stored as separate DB records (DeliverableRowAcknowledgment)
 * — not folded into the JSON blob — so the audit trail shows exactly which
 * deliverable the student acknowledged and when.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SignatureApplyBlock } from "@/components/signature/SignatureApplyBlock";
import { SkipStep } from "@/components/forms/SkipStep";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DeliverableTableSchema, DeliverableRow } from "@/types";

interface Props {
  formTemplateId: string;
  formTemplateId2: string;
  schema: unknown;
  signatoryRoles: Array<{ role: string; label: string }>;
  existingData: Record<string, unknown> | null;
  existingStatus: string;
  existingSignatures: Record<string, string>;
  priorSignatures: Record<string, string>;
  acknowledgedRowIds: string[];
  studentId: string;
  onComplete: () => void;
}

function DeliverableRowCard({
  row,
  isAcknowledged,
  onAcknowledge,
  disabled,
}: {
  row: DeliverableRow;
  isAcknowledged: boolean;
  onAcknowledge: (rowId: string) => Promise<void>;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acking, setAcking] = useState(false);

  async function handleAck() {
    if (isAcknowledged || disabled) return;
    setAcking(true);
    try {
      await onAcknowledge(row.id);
    } finally {
      setAcking(false);
    }
  }

  return (
    <motion.div
      variants={listItem}
      className={cn(
        "rounded-2xl border-2 overflow-hidden transition-all duration-200",
        isAcknowledged
          ? "border-success/30 bg-success-light/20"
          : "border-surface-border bg-white"
      )}
    >
      {/* Row header */}
      <button
        type="button"
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* S.No badge */}
        <span
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
            isAcknowledged ? "bg-success text-white" : "bg-brand-50 text-brand"
          )}
        >
          {isAcknowledged ? <CheckCircle2 className="w-4 h-4" /> : row.sno}
        </span>

        <div className="flex-1 min-w-0">
          {/* Deliverable name */}
          <p className="text-sm font-semibold text-ink leading-snug whitespace-pre-line">
            {row.deliverable}
          </p>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
        )}
      </button>

      {/* Expandable key points */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-border pt-3">
              <p className="text-xs text-ink-muted font-semibold uppercase tracking-wide mb-2">
                Key Points / Inclusions
              </p>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                {row.keyPoints}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Acknowledge tap target */}
      <div className={cn("border-t", isAcknowledged ? "border-success/20" : "border-surface-border")}>
        {isAcknowledged ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-success">
              I have read and understood this
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAck}
            disabled={acking || disabled}
            className={cn(
              "w-full flex items-center gap-2 px-4 py-3",
              "min-h-[52px]", // large touch target
              "text-left text-sm font-medium",
              "transition-colors duration-150",
              "bg-brand-50 hover:bg-brand-100 active:bg-brand-200",
              "text-brand",
              acking && "opacity-60"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded border-2 border-brand/40 flex items-center justify-center shrink-0",
                "transition-all duration-150"
              )}
            />
            <span className="flex-1">
              I have read and understood this deliverable
            </span>
            {acking && (
              <span className="text-xs text-brand/60">Saving…</span>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function DeliverablesTable({
  formTemplateId,
  schema,
  signatoryRoles,
  existingStatus,
  existingSignatures,
  priorSignatures,
  acknowledgedRowIds,
  onComplete,
}: Props) {
  const { rows, declaration, programmeHeader, allowSkip } =
    schema as DeliverableTableSchema;

  const [ackedRows, setAckedRows] = useState<Set<string>>(
    new Set(acknowledgedRowIds)
  );
  const [signatures, setSignatures] = useState<Record<string, string>>(existingSignatures);
  const [submitting, setSubmitting] = useState(false);
  const isAlreadySubmitted = existingStatus === "SUBMITTED";

  const totalRows = rows.length;
  const ackedCount = ackedRows.size;
  const allAcked = ackedCount === totalRows;
  const progressPct = Math.round((ackedCount / totalRows) * 100);

  async function handleAcknowledge(rowId: string) {
    try {
      const res = await fetch("/api/student/form-response/row-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId, rowId }),
      });
      if (!res.ok) throw new Error();
      setAckedRows((prev) => new Set([...prev, rowId]));
    } catch {
      toast.error("Could not save acknowledgment — please try again");
      throw new Error("Ack failed");
    }
  }

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
          data: {
            allRowsAcknowledged: allAcked,
            ...(skipped ? { skipped: true, acknowledgedCount: ackedCount } : {}),
          },
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(skipped ? "Step completed." : "Deliverables acknowledged!");
      onComplete();
    } catch {
      toast.error("Failed to save — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!allAcked) {
      toast.error(`Please acknowledge all ${totalRows} deliverables before proceeding`);
      return;
    }
    const allSigned = signatoryRoles.every((r) => signatures[r.role]);
    if (!allSigned) {
      toast.error("Please complete all signatures");
      return;
    }
    await submit(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Programme header */}
      {programmeHeader && (
        <div className="bg-brand-100 border border-brand-200 rounded-2xl p-4 text-brand-900">
          <p className="text-xs font-medium text-brand-700 uppercase tracking-wider">
            {programmeHeader.label}
          </p>
          <p className="text-lg font-bold mt-1">{programmeHeader.value}</p>
        </div>
      )}

      {/* Sticky progress tracker */}
      <Card padding="sm" className="sticky top-[120px] z-30 border-brand/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink">
            Deliverables Acknowledged
          </span>
          <Badge variant={allAcked ? "success" : "default"}>
            {ackedCount} / {totalRows}
          </Badge>
        </div>
        <div className="h-2 bg-surface-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1.0] }}
          />
        </div>
        {!allAcked && (
          <p className="text-xs text-ink-muted mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Tap each row and check to acknowledge
          </p>
        )}
      </Card>

      {/* Row cards */}
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3"
      >
        {rows.map((row) => (
          <DeliverableRowCard
            key={row.id}
            row={row}
            isAcknowledged={ackedRows.has(row.id)}
            onAcknowledge={handleAcknowledge}
            disabled={isAlreadySubmitted}
          />
        ))}
      </motion.div>

      {/* Declaration */}
      <Card padding="md" className="bg-surface-muted border-none">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
          Student Declaration
        </h4>
        <p className="text-sm text-ink leading-relaxed">{declaration}</p>
      </Card>

      {/* Signatures — apply your saved signature with a single tap */}
      <SignatureApplyBlock
        formTemplateId={formTemplateId}
        signatoryRoles={signatoryRoles}
        masterSignatures={priorSignatures}
        existingSignatures={signatures}
        disabled={isAlreadySubmitted}
        onSigned={mergeSignatures}
      />

      {/* CTA */}
      <Button
        size="lg"
        fullWidth
        onClick={handleSubmit}
        loading={submitting}
        disabled={!allAcked || isAlreadySubmitted}
        iconRight={
          isAlreadySubmitted ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )
        }
        className={cn(
          "mb-8",
          isAlreadySubmitted && "bg-success hover:bg-green-700"
        )}
      >
        {isAlreadySubmitted
          ? "Already Acknowledged — Continue"
          : !allAcked
          ? `Acknowledge all ${totalRows - ackedCount} remaining rows to continue`
          : "Submit Acknowledgment & Continue"}
      </Button>

      {allowSkip && !isAlreadySubmitted && !allAcked && (
        <SkipStep onSkip={() => submit(true)} disabled={submitting} />
      )}
    </div>
  );
}
