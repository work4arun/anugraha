"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";

import { DocumentUpload } from "@/components/upload/DocumentUpload";
import { Button } from "@/components/ui/Button";
import { listContainer, listItem } from "@/lib/motion";
import type { DocumentUploadSchema } from "@/types";

interface Props {
  formTemplateId: string;
  schema: unknown;
  existingDocuments: Array<{
    id: string;
    type: string;
    fileUrl: string;
    fileName: string;
    uploadStatus: string;
  }>;
  studentId: string;
  onComplete: () => void;
}

export function DocumentUploadForm({
  formTemplateId,
  schema,
  existingDocuments,
  onComplete,
}: Props) {
  const { documents } = schema as DocumentUploadSchema;

  const existingMap = Object.fromEntries(
    existingDocuments.map((d) => [d.type, { url: d.fileUrl, name: d.fileName }])
  );

  const [uploadedMap, setUploadedMap] = useState<Record<string, string>>(
    Object.fromEntries(
      existingDocuments
        .filter((d) => d.uploadStatus === "UPLOADED")
        .map((d) => [d.type, d.fileUrl])
    )
  );

  const [submitting, setSubmitting] = useState(false);

  const requiredDocs = documents.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => !!uploadedMap[d.id]);
  const uploadedCount = requiredDocs.filter((d) => !!uploadedMap[d.id]).length;

  function handleUploadComplete(docId: string, url: string) {
    setUploadedMap((prev) => ({ ...prev, [docId]: url }));
  }

  async function handleContinue() {
    if (!allRequiredUploaded) {
      toast.error("Please upload all required documents before continuing");
      return;
    }
    setSubmitting(true);
    try {
      // Mark the form response as submitted
      const res = await fetch("/api/student/form-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId,
          data: { uploadedDocTypes: Object.keys(uploadedMap) },
          status: "SUBMITTED",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Documents uploaded successfully!");
      onComplete();
    } catch {
      toast.error("Failed to proceed — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-ink">Document Upload</h2>
        <p className="text-sm text-ink-muted mt-1">
          Upload clear, legible scans or photos.{" "}
          {uploadedCount} of {requiredDocs.length} required documents uploaded.
        </p>

        {/* Progress */}
        <div className="mt-3 h-2 bg-surface-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand rounded-full"
            animate={{
              width: `${requiredDocs.length ? (uploadedCount / requiredDocs.length) * 100 : 0}%`,
            }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1.0] }}
          />
        </div>
      </div>

      {/* Document upload cards */}
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5"
      >
        {documents.map((doc) => (
          <motion.div key={doc.id} variants={listItem}>
            <DocumentUpload
              documentId={doc.id}
              label={doc.label}
              hint={doc.hint}
              required={doc.required}
              accept={doc.accept}
              maxSizeMB={doc.maxSizeMB}
              existingUrl={existingMap[doc.id]?.url ?? null}
              onUploadComplete={(url) => handleUploadComplete(doc.id, url)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <Button
        size="lg"
        fullWidth
        onClick={handleContinue}
        loading={submitting}
        disabled={!allRequiredUploaded}
        iconRight={
          allRequiredUploaded ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )
        }
        className="mb-8"
      >
        {allRequiredUploaded
          ? "Continue to Review"
          : `${requiredDocs.length - uploadedCount} document(s) remaining`}
      </Button>
    </div>
  );
}
