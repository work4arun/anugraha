"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Edit2,
  FileDown,
  ChevronRight,
  GraduationCap,
  ArrowLeft,
  FileSignature,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ReviewData {
  student: {
    id: string;
    name: string;
    regNo: string;
    email?: string | null;
    mobile?: string | null;
    photoUrl?: string | null;
    pdfUrl?: string | null;
  };
  batch: {
    name: string;
    course: string;
    academicYear: string;
    institution: { code: string; fullName: string; primaryColor: string };
  };
  steps: Array<{
    id: string;
    order: number;
    stepSlug: string;
    name: string;
    type: string;
    required: boolean;
    status: string;
    data: unknown;
    signatures: Array<{ role: string; url: string }>;
  }>;
  documents: Array<{
    id: string;
    type: string;
    label: string;
    fileUrl: string;
    fileName: string;
    uploadStatus: string;
    reviewStatus: string;
  }>;
  allSubmitted: boolean;
  agreements: Array<{ id: string; name: string; status: string }>;
  agreementsPending: Array<{ id: string; name: string }>;
}

export function ReviewClient({ reviewData }: { reviewData: ReviewData }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const { student, batch, steps, documents, allSubmitted, agreements, agreementsPending } = reviewData;
  const hasPendingAgreements = agreementsPending.length > 0;
  const readyForPdf = allSubmitted && !hasPendingAgreements;

  async function handleFinalSubmit() {
    setGenerating(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "PDF generation failed");
      toast.success("Anugraha 2026 form is ready! Redirecting…");
      router.push("/complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF — please try again");
    } finally {
      setGenerating(false);
    }
  }

  const incompleteRequired = steps.filter(
    (s) => s.required && s.status !== "SUBMITTED"
  );
  const firstName = student.name.split(" ")[0];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Review Your Induction</p>
            <p className="text-xs text-ink-muted">{student.regNo}</p>
          </div>
          <GraduationCap className="w-5 h-5 text-brand" />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-36">
        {/* Status banner */}
        {!allSubmitted ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-warning-light border border-warning/30 rounded-2xl p-4 mb-5"
          >
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">
                Almost there, {firstName} — {incompleteRequired.length} step(s) left
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                Complete all required steps before final submission
              </p>
            </div>
          </motion.div>
        ) : hasPendingAgreements ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-warning-light border border-warning/30 rounded-2xl p-4 mb-5"
          >
            <FileSignature className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">
                One last step, {firstName} — sign your agreement{agreementsPending.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                Head back to your dashboard to sign before the final PDF can be generated
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-success-light border border-success/30 rounded-2xl p-4 mb-5"
          >
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">
                Amazing work, {firstName} — all steps complete! 🎉
              </p>
              <p className="text-xs text-success/80 mt-0.5">
                Review everything below and tap &quot;Confirm &amp; Generate PDF&quot;
              </p>
            </div>
          </motion.div>
        )}

        {/* Student summary card */}
        <Card padding="md" className="mb-5">
          <div className="flex items-center gap-4">
            {student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photoUrl}
                alt={student.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-surface-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-brand">
                  {student.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-ink text-base">{student.name}</p>
              <p className="text-sm text-ink-muted">{student.regNo}</p>
              <p className="text-xs text-ink-faint mt-0.5">
                {batch.course} · {batch.academicYear}
              </p>
              <p className="text-xs text-ink-faint">{batch.institution.fullName}</p>
            </div>
          </div>
        </Card>

        {/* Steps checklist */}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
          Steps Summary
        </h2>

        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3 mb-5"
        >
          {steps.map((step) => (
            <motion.div
              key={step.id}
              variants={listItem}
              className={cn(
                "flex items-center gap-3 p-4 rounded-2xl border-2",
                step.status === "SUBMITTED"
                  ? "border-success/30 bg-success-light/10"
                  : step.required
                  ? "border-warning/30 bg-warning-light/20"
                  : "border-surface-border bg-white"
              )}
            >
              {step.status === "SUBMITTED" ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{step.name}</p>
                <Badge
                  variant={step.status === "SUBMITTED" ? "success" : "warning"}
                  dot
                  className="mt-1"
                >
                  {step.status === "SUBMITTED" ? "Completed" : "Incomplete"}
                </Badge>
              </div>
              {step.status !== "SUBMITTED" && (
                <button
                  onClick={() => router.push(`/induction/${step.stepSlug}`)}
                  className="flex items-center gap-1 text-xs text-brand font-medium min-h-[44px] px-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Agreements — the final step, signed on the dashboard */}
        {agreements.length > 0 && (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
              Agreements (final step)
            </h2>
            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3 mb-5"
            >
              {agreements.map((a) => {
                const done = a.status === "COMPLETED";
                return (
                  <motion.div
                    key={a.id}
                    variants={listItem}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2",
                      done ? "border-success/30 bg-success-light/10" : "border-warning/30 bg-warning-light/20"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    ) : (
                      <FileSignature className="w-5 h-5 text-warning shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{a.name}</p>
                      <Badge variant={done ? "success" : "warning"} dot className="mt-1">
                        {done ? "Signed" : a.status === "PARTIAL" ? "Partially signed" : "Awaiting signature"}
                      </Badge>
                    </div>
                    {!done && (
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-1 text-xs text-brand font-medium min-h-[44px] px-2"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        Sign
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}

        {/* Documents summary */}
        {documents.length > 0 && (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
              Uploaded Documents
            </h2>
            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-2 mb-6"
            >
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  variants={listItem}
                  className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-white"
                >
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{doc.label}</p>
                    <p className="text-xs text-ink-muted truncate">{doc.fileName}</p>
                  </div>
                  <Badge variant={doc.reviewStatus === "APPROVED" ? "success" : "muted"}>
                    {doc.reviewStatus === "APPROVED" ? "Approved" : "Pending review"}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </main>

      {/* Sticky bottom CTA */}
      <div className="bottom-action-bar">
        {readyForPdf ? (
          <Button
            size="lg"
            fullWidth
            onClick={handleFinalSubmit}
            loading={generating}
            icon={<FileDown className="w-5 h-5" />}
          >
            {generating ? "Generating PDF…" : "Confirm & Generate PDF"}
          </Button>
        ) : !allSubmitted ? (
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              const first = incompleteRequired[0];
              if (first) router.push(`/induction/${first.stepSlug}`);
            }}
            iconRight={<ChevronRight className="w-5 h-5" />}
            variant="secondary"
          >
            Complete {incompleteRequired.length} remaining step(s)
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            onClick={() => router.push("/dashboard")}
            icon={<FileSignature className="w-5 h-5" />}
            variant="secondary"
          >
            Sign {agreementsPending.length} agreement{agreementsPending.length === 1 ? "" : "s"} to finish
          </Button>
        )}
      </div>
    </div>
  );
}
