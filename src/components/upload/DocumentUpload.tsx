"use client";

/**
 * DocumentUpload — mobile-first, camera-first file upload component.
 *
 * Mobile: tapping the upload area triggers the device camera as primary
 * capture method (capture="environment"), with a "Choose file" fallback.
 *
 * Features:
 *  - Animated upload progress bar
 *  - Image / PDF preview after upload
 *  - Retry / replace button
 *  - File type + size validation before upload
 *  - Graceful error states
 */

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  File,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn, formatBytes } from "@/lib/utils";
import { uploadSuccess } from "@/lib/motion";

interface DocumentUploadProps {
  documentId: string;
  label: string;
  hint?: string;
  required?: boolean;
  accept?: string; // MIME types, e.g. "image/jpeg,image/png,application/pdf"
  maxSizeMB?: number;
  existingUrl?: string | null;
  onUploadComplete?: (url: string, fileName: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function DocumentUpload({
  documentId,
  label,
  hint,
  required,
  accept = "image/jpeg,image/png,application/pdf",
  maxSizeMB = 5,
  existingUrl,
  onUploadComplete,
  disabled = false,
  className,
}: DocumentUploadProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>(
    existingUrl ? "success" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl ?? null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);

  // ── Validation ─────────────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File too large. Maximum size is ${maxSizeMB} MB (this file is ${formatBytes(file.size)}).`;
    }
    const acceptedTypes = accept.split(",").map((t) => t.trim());
    const isAccepted = acceptedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });
    if (!isAccepted) {
      return `Unsupported file type. Please upload ${accept.replace(/application\//g, "").replace(/image\//g, "").toUpperCase()}.`;
    }
    return null;
  }

  // ── Upload ─────────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMsg(validationError);
        setUploadState("error");
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      setUploadState("uploading");
      setProgress(0);
      setErrorMsg("");

      // Preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }

      // Simulate progress then POST
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 85));
      }, 150);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentId", documentId);

        const res = await fetch("/api/student/document", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Upload failed");
        }

        const data = await res.json();
        setUploadState("success");
        onUploadComplete?.(data.data.url, file.name);
      } catch (err) {
        clearInterval(progressInterval);
        setProgress(0);
        setUploadState("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Upload failed — please try again"
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, accept, maxSizeMB]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function retry() {
    setUploadState("idle");
    setPreviewUrl(null);
    setErrorMsg("");
    setProgress(0);
  }

  const mobile = isMobile();

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Label */}
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      </div>
      {hint && <p className="text-xs text-ink-muted -mt-1">{hint}</p>}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="sr-only"
        onChange={handleInputChange}
        aria-label={`Camera capture for ${label}`}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleInputChange}
        aria-label={`File picker for ${label}`}
      />

      {/* Upload zone */}
      <AnimatePresence mode="wait">
        {/* ── Idle ── */}
        {uploadState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border-2 border-dashed border-surface-border bg-surface-muted"
          >
            {/* Mobile: camera first */}
            {mobile ? (
              <div className="flex flex-col gap-3 p-5">
                <div className="flex flex-col items-center text-center gap-2 pb-2">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-brand" />
                  </div>
                  <p className="text-sm font-medium text-ink">Add document</p>
                  <p className="text-xs text-ink-muted">
                    Take a photo or pick from your gallery
                  </p>
                </div>
                <Button
                  size="lg"
                  fullWidth
                  variant="primary"
                  onClick={() => cameraInputRef.current?.click()}
                  icon={<Camera className="w-5 h-5" />}
                  disabled={disabled}
                >
                  Open Camera
                </Button>
                <Button
                  size="md"
                  fullWidth
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<FileUp className="w-4 h-4" />}
                  disabled={disabled}
                >
                  Choose from Files
                </Button>
              </div>
            ) : (
              /* Desktop: drag area */
              <button
                type="button"
                className="w-full p-8 flex flex-col items-center gap-3 hover:bg-brand-50/30 transition-colors rounded-2xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center">
                  <FileUp className="w-6 h-6 text-brand" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-ink">
                    Click to upload
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {accept.split(",").map((a) => a.split("/")[1]).join(", ").toUpperCase()} · max {maxSizeMB} MB
                  </p>
                </div>
              </button>
            )}
          </motion.div>
        )}

        {/* ── Uploading ── */}
        {uploadState === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-brand/30 bg-brand-50 p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <File className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{fileName}</p>
                <p className="text-xs text-ink-muted">{formatBytes(fileSize)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-brand/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "linear" }}
              />
            </div>
            <p className="text-xs text-brand mt-2 font-medium">
              Uploading… {progress}%
            </p>
          </motion.div>
        )}

        {/* ── Success ── */}
        {uploadState === "success" && (
          <motion.div
            key="success"
            variants={uploadSuccess}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border-2 border-success/30 bg-success-light overflow-hidden"
          >
            {/* Preview */}
            {previewUrl && (
              <div className="relative w-full h-40 bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`Preview of ${label}`}
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => window.open(previewUrl, "_blank")}
                  className="absolute bottom-2 right-2 bg-black/50 text-white rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View full
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 p-4">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-success">Uploaded</p>
                {fileName && (
                  <p className="text-xs text-success/70 truncate mt-0.5">{fileName}</p>
                )}
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retry}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  className="text-success hover:bg-success/10"
                >
                  Replace
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {uploadState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-error/30 bg-error-light p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-error">Upload failed</p>
                <p className="text-xs text-error/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={retry}
              icon={<RefreshCw className="w-4 h-4" />}
              fullWidth
            >
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
