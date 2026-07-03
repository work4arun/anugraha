"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertTriangle, FileDown, Eye, Flag, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { StudentProfile } from "@/types";

interface Props {
  profile: StudentProfile;
  documents: Array<{
    id: string;
    type: string;
    label: string;
    fileUrl: string;
    reviewStatus: string;
    reviewNote?: string | null;
  }>;
}

export function AdminStudentDetailClient({ profile, documents }: Props) {
  const router = useRouter();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: profile.id }),
      });
      if (!res.ok) throw new Error();
      toast.success("PDF generated");
      router.refresh();
    } catch {
      toast.error("PDF generation failed");
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
            variant="secondary"
            onClick={generatePdf}
            icon={<FileDown className="w-4 h-4" />}
          >
            Generate PDF
          </Button>
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
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

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
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50"
                        >
                          <Eye className="w-4 h-4" />
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
    </div>
  );
}
