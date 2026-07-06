"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertTriangle, FileDown, Eye, Flag, ThumbsUp, KeyRound, Download, FileText, RotateCcw, Undo2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { listContainer, listItem } from "@/lib/motion";
import { cn, generatePassword } from "@/lib/utils";
import type { StudentProfile } from "@/types";

interface AgreementSummary {
  id: string;
  name: string;
  status: string;
  signedAt?: string | null;
}

interface Props {
  profile: StudentProfile;
  canManage?: boolean;
  pdfUrl?: string | null;
  pdfGeneratedAt?: string | null;
  documents: Array<{
    id: string;
    type: string;
    label: string;
    fileUrl: string;
    reviewStatus: string;
    reviewNote?: string | null;
  }>;
  agreements?: AgreementSummary[];
}

export function AdminStudentDetailClient({ profile, canManage = false, pdfUrl, pdfGeneratedAt, documents, agreements = [] }: Props) {
  const router = useRouter();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(pdfUrl ?? null);

  // Reset-form confirmation state
  const [resetTarget, setResetTarget] = useState<StudentProfile["steps"][number] | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Reset-all-forms confirmation state
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [resetAllBusy, setResetAllBusy] = useState(false);

  // Reset-agreement confirmation state
  const [resetAgreementTarget, setResetAgreementTarget] = useState<AgreementSummary | null>(null);
  const [resetAgreementBusy, setResetAgreementBusy] = useState(false);

  // Delete-student confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const submittedStepCount = profile.steps.filter((s) => s.status === "completed").length;
  // Agreements are the last step of induction — the final PDF can't be
  // generated while any of these is still awaiting the student's signature.
  const pendingAgreements = agreements.filter((a) => a.status !== "COMPLETED");

  async function confirmResetAllForms() {
    setResetAllBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${profile.id}/reset-all`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("All forms reopened for the student");
      setResetAllOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset forms");
    } finally {
      setResetAllBusy(false);
    }
  }

  async function confirmResetForm() {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${profile.id}/reset-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId: resetTarget.formTemplateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${resetTarget.name}" reopened for the student`);
      setResetTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset form");
    } finally {
      setResetBusy(false);
    }
  }

  async function confirmResetAgreement() {
    if (!resetAgreementTarget) return;
    setResetAgreementBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${profile.id}/reset-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementTemplateId: resetAgreementTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${resetAgreementTarget.name}" reopened for the student`);
      setResetAgreementTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset agreement");
    } finally {
      setResetAgreementBusy(false);
    }
  }

  async function saveStudentPassword() {
    if (pwValue.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${profile.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Student password updated");
      setPwOpen(false);
      setPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setPwBusy(false);
    }
  }

  async function reviewDoc(docId: string, status: "APPROVED" | "FLAGGED", note?: string) {
    setReviewingId(docId);
    try {
      await fetch(`/api/admin/documents/${docId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      toast.success(`Document ${status.toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Review action failed");
    } finally {
      setReviewingId(null);
    }
  }

  async function generatePdf() {
    // Open the tab synchronously so it isn't blocked as a popup, then point it
    // at the freshly generated PDF once the request resolves.
    const previewWindow = window.open("", "_blank");
    setPdfBusy(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error);
      const url = data.data?.url as string | undefined;
      if (url) {
        setCurrentPdfUrl(url);
        if (previewWindow) previewWindow.location.href = url;
      } else {
        previewWindow?.close();
      }
      toast.success("PDF generated — preview opened");
      router.refresh();
    } catch (err) {
      previewWindow?.close();
      toast.error(err instanceof Error && err.message ? err.message : "PDF generation failed");
    } finally {
      setPdfBusy(false);
    }
  }

  function previewPdf() {
    if (currentPdfUrl) window.open(currentPdfUrl, "_blank");
  }

  async function confirmDeleteStudent() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${profile.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Student deleted");
      router.push(`/admin/batches/${profile.batch.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete student");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink truncate">{profile.name}</p>
            <p className="text-xs text-ink-muted">{profile.regNo}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setPwValue(""); setPwOpen(true); }}
            icon={<KeyRound className="w-4 h-4" />}
          >
            Reset Password
          </Button>
          {submittedStepCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setResetAllOpen(true)}
              icon={<Undo2 className="w-4 h-4" />}
            >
              Reset All Forms
            </Button>
          )}
          {currentPdfUrl && (
            <Button
              size="sm"
              variant="ghost"
              onClick={previewPdf}
              icon={<FileText className="w-4 h-4" />}
              title={
                pdfGeneratedAt
                  ? `Last generated ${new Date(pdfGeneratedAt).toLocaleString()}`
                  : "Preview the generated PDF"
              }
            >
              Preview PDF
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={generatePdf}
            loading={pdfBusy}
            disabled={pendingAgreements.length > 0}
            icon={<FileDown className="w-4 h-4" />}
            title={
              pendingAgreements.length > 0
                ? `Waiting on ${pendingAgreements.length} agreement${pendingAgreements.length === 1 ? "" : "s"} to be signed: ${pendingAgreements.map((a) => a.name).join(", ")}`
                : undefined
            }
          >
            {currentPdfUrl ? "Regenerate PDF" : "Generate PDF"}
          </Button>
          {canManage && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:text-error hover:bg-error-light transition-colors shrink-0"
              aria-label="Delete student"
              title="Delete student"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-5"
        >
          {/* Summary card */}
          <motion.div variants={listItem}>
            <Card padding="md" className="flex items-center gap-5">
              <ProgressRing pct={profile.completionPct} size={72} />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-ink">{profile.name}</h2>
                <p className="text-sm text-ink-muted">{profile.regNo} · {profile.batch.course}</p>
                <p className="text-xs text-ink-faint">{profile.batch.institution.fullName}</p>
                <div className="flex gap-2 mt-2">
                  <Badge
                    variant={
                      profile.status === "COMPLETED" ? "success" :
                      profile.status === "IN_PROGRESS" ? "warning" : "muted"
                    }
                    dot
                  >
                    {profile.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Steps */}
          <motion.div variants={listItem}>
            <Card padding="md">
              <CardHeader><CardTitle>Induction Steps</CardTitle></CardHeader>
              <div className="flex flex-col gap-2">
                {profile.steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
                    {step.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                    )}
                    <span className="text-sm text-ink flex-1">{step.name}</span>
                    <Badge variant={step.status === "completed" ? "success" : "muted"}>
                      {step.status === "completed" ? "Done" : step.status.replace("_", " ")}
                    </Badge>
                    {step.status === "completed" && (
                      <button
                        onClick={() => setResetTarget(step)}
                        title="Reset form — let the student correct and resubmit"
                        aria-label="Reset form"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Agreements */}
          {agreements.length > 0 && (
            <motion.div variants={listItem}>
              <Card padding="md">
                <CardHeader><CardTitle>Agreements</CardTitle></CardHeader>
                <div className="flex flex-col gap-2">
                  {agreements.map((agreement) => (
                    <div key={agreement.id} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
                      {agreement.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                      )}
                      <span className="text-sm text-ink flex-1">{agreement.name}</span>
                      <Badge variant={agreement.status === "COMPLETED" ? "success" : agreement.status === "PARTIAL" ? "warning" : "muted"}>
                        {agreement.status}
                      </Badge>
                      {agreement.status !== "PENDING" && (
                        <button
                          onClick={() => setResetAgreementTarget(agreement)}
                          title="Reset agreement — let the student correct and re-sign"
                          aria-label="Reset agreement"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light shrink-0"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Documents review */}
          {documents.length > 0 && (
            <motion.div variants={listItem}>
              <Card padding="md">
                <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
                <div className="flex flex-col gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2",
                        doc.reviewStatus === "APPROVED" ? "border-success/30 bg-success-light/10" :
                        doc.reviewStatus === "FLAGGED"  ? "border-error/30 bg-error-light/10" :
                        "border-surface-border"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{doc.label}</p>
                        <Badge
                          variant={
                            doc.reviewStatus === "APPROVED" ? "success" :
                            doc.reviewStatus === "FLAGGED"  ? "error" : "muted"
                          }
                          className="mt-1"
                        >
                          {doc.reviewStatus}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View"
                          aria-label="View document"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <a
                          href={doc.fileUrl}
                          download={doc.label}
                          title="Download"
                          aria-label="Download document"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {doc.reviewStatus !== "APPROVED" && (
                          <button
                            onClick={() => reviewDoc(doc.id, "APPROVED")}
                            disabled={reviewingId === doc.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-success hover:bg-success-light"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                        )}
                        {doc.reviewStatus !== "FLAGGED" && (
                          <button
                            onClick={() => reviewDoc(doc.id, "FLAGGED", "Please re-upload a clearer copy")}
                            disabled={reviewingId === doc.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Reset student password modal */}
      {pwOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !pwBusy && setPwOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">Reset student password</h3>
            <p className="text-sm text-ink-muted mb-4">
              Set a new login password for <span className="font-medium text-ink">{profile.name}</span>{" "}
              ({profile.regNo}). They can log in with it immediately.
            </p>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  id="student-pw"
                  type="text"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  hint="Minimum 6 characters"
                  autoFocus
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => setPwValue(generatePassword(10))}>
                Generate
              </Button>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setPwOpen(false)} disabled={pwBusy}>
                Cancel
              </Button>
              <Button onClick={saveStudentPassword} loading={pwBusy} icon={<KeyRound className="w-4 h-4" />}>
                Save password
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset form confirmation modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !resetBusy && setResetTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-error-light flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-error" />
              </div>
              <h3 className="text-base font-semibold text-ink">Reset form</h3>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              This reopens <span className="font-medium text-ink">{resetTarget.name}</span> for{" "}
              <span className="font-medium text-ink">{profile.name}</span> to correct and resubmit.
              Their typed answers are kept, but their signature for this form is cleared so they
              re-sign the corrected version.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={resetBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmResetForm}
                loading={resetBusy}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Reset form
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset all forms confirmation modal */}
      {resetAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !resetAllBusy && setResetAllOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-error-light flex items-center justify-center">
                <Undo2 className="w-4 h-4 text-error" />
              </div>
              <h3 className="text-base font-semibold text-ink">Reset all forms</h3>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              This reopens all {submittedStepCount} submitted form{submittedStepCount === 1 ? "" : "s"} for{" "}
              <span className="font-medium text-ink">{profile.name}</span> so they can modify anything,
              undoing final submission. Typed answers are kept, but all signatures for this student
              are cleared so corrected forms are re-signed.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setResetAllOpen(false)} disabled={resetAllBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmResetAllForms}
                loading={resetAllBusy}
                icon={<Undo2 className="w-4 h-4" />}
              >
                Reset all forms
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Reset agreement confirmation modal */}
      {resetAgreementTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !resetAgreementBusy && setResetAgreementTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-error-light flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-error" />
              </div>
              <h3 className="text-base font-semibold text-ink">Reset agreement</h3>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              This reopens <span className="font-medium text-ink">{resetAgreementTarget.name}</span> for{" "}
              <span className="font-medium text-ink">{profile.name}</span> to correct and re-sign.
              Their signed copy is cleared, so they'll need to fill in and sign the agreement again.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setResetAgreementTarget(null)} disabled={resetAgreementBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmResetAgreement}
                loading={resetAgreementBusy}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Reset agreement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete student modal */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !deleteBusy && setDeleteOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-error-light flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-error" />
              </div>
              <h3 className="text-base font-semibold text-ink">Delete student</h3>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              This permanently removes <span className="font-medium text-ink">{profile.name}</span>{" "}
              ({profile.regNo}) along with their form responses, signatures, uploaded documents and
              signed agreements. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeleteStudent}
                loading={deleteBusy}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete student
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
