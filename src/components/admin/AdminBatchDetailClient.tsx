"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  CircleDashed,
  Upload,
  Download,
  Eye,
  FileDown,
  Pencil,
  Copy,
  Trash2,
  Plus,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StudentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LOCKED";

interface Student {
  id: string;
  regNo: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  status: StudentStatus;
  completionPct: number;
  lastLoginAt: string | null;
  pdfUrl?: string | null;
}

interface BatchData {
  id: string;
  name: string;
  course: string;
  academicYear: string;
  isActive: boolean;
  logoUrl?: string | null;
  institution: { code: string; fullName: string };
  formAssignments: Array<{
    id: string;
    order: number;
    stepSlug: string;
    required: boolean;
    formTemplate: { id: string; name: string; type: string };
  }>;
  students: Student[];
}

const statusConfig: Record<StudentStatus, { label: string; variant: "success" | "warning" | "muted" | "default" }> = {
  COMPLETED:   { label: "Completed",   variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  NOT_STARTED: { label: "Not Started", variant: "muted"   },
  LOCKED:      { label: "Locked",      variant: "default" },
};

export function AdminBatchDetailClient({
  batch,
  canManage,
}: {
  batch: BatchData;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(batch.logoUrl ?? null);
  const [search, setSearch] = useState("");

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("Logo is too large — please keep it under 1 MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setLogoBusy(true);
      try {
        const res = await fetch(`/api/admin/batches/${batch.id}/logo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setLogoUrl(data.data.url);
        toast.success("Logo updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not upload logo");
      } finally {
        setLogoBusy(false);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    setLogoBusy(true);
    try {
      const res = await fetch(`/api/admin/batches/${batch.id}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setLogoUrl(null);
      toast.success("Logo removed");
    } catch {
      toast.error("Could not remove logo");
    } finally {
      setLogoBusy(false);
    }
  }
  const [assignOpen, setAssignOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [busy, setBusy] = useState(false);

  const assignedTemplateIds = new Set(batch.formAssignments.map((a) => a.formTemplate.id));

  async function openAssign() {
    setAssignOpen((v) => !v);
    if (availableTemplates.length === 0) {
      try {
        const res = await fetch("/api/admin/templates");
        const data = await res.json();
        if (res.ok) {
          setAvailableTemplates(
            (data.data as Array<{ id: string; name: string; type: string }>).map((t) => ({
              id: t.id,
              name: t.name,
              type: t.type,
            }))
          );
        }
      } catch {
        toast.error("Could not load templates");
      }
    }
  }

  async function assignTemplate() {
    if (!selectedTemplate) {
      toast.error("Pick a form to assign");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/batches/${batch.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId: selectedTemplate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Form assigned to this batch");
      setSelectedTemplate("");
      setAssignOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign form");
    } finally {
      setBusy(false);
    }
  }

  async function customiseForBatch(assignmentId: string, name: string) {
    setBusy(true);
    try {
      const a = batch.formAssignments.find((x) => x.id === assignmentId);
      const res = await fetch(`/api/admin/templates/${a?.formTemplate.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, name: `${name} — ${batch.name}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Private copy created for this batch — opening editor");
      router.push(`/admin/templates/${data.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not customise");
      setBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/batches/${batch.id}/assignments?assignmentId=${assignmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success("Step removed from batch");
      router.refresh();
    } catch {
      toast.error("Could not remove step");
    } finally {
      setBusy(false);
    }
  }

  const filtered = batch.students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.regNo.toLowerCase().includes(search.toLowerCase())
  );

  const completed   = batch.students.filter((s) => s.status === "COMPLETED").length;
  const inProgress  = batch.students.filter((s) => s.status === "IN_PROGRESS").length;
  const notStarted  = batch.students.filter((s) => s.status === "NOT_STARTED").length;
  const total       = batch.students.length;

  // ── CSV bulk upload ────────────────────────────────────────────────────────

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch("/api/admin/students/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ batchId: batch.id, students: results.data }),
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          toast.success(`${data.data?.created ?? "?"} students imported`);
          router.refresh();
        } catch {
          toast.error("Failed to import students — check CSV format");
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      },
      error: () => {
        toast.error("Invalid CSV file");
        setUploading(false);
      },
    });
  }

  function exportCsv() {
    const rows = batch.students.map((s) => ({
      "Reg No": s.regNo,
      "Name": s.name,
      "Email": s.email ?? "",
      "Mobile": s.mobile ?? "",
      "Status": s.status,
      "Completion %": s.completionPct,
      "Last Login": s.lastLoginAt ?? "Never",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.id}_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/batches")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-ink truncate">{batch.name}</p>
            <p className="text-xs text-ink-muted">{batch.institution.fullName}</p>
          </div>
          {!canManage && (
            <Badge variant="muted">
              <Lock className="w-3 h-3 mr-1 inline" />
              View only
            </Badge>
          )}
          <Badge variant={batch.isActive ? "success" : "muted"} dot>
            {batch.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-6"
        >
          {!canManage && (
            <motion.div
              variants={listItem}
              className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-light px-4 py-3"
            >
              <Lock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-ink">
                This batch was created by another admin. You can view its data and export the
                roster, but editing is restricted to its creator and super admins.
              </p>
            </motion.div>
          )}

          {/* Stats row */}
          <motion.div variants={listItem} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total",       value: total,      icon: Users,         color: "bg-brand-50 text-brand" },
              { label: "Completed",   value: completed,  icon: CheckCircle2,  color: "bg-success-light text-success" },
              { label: "In Progress", value: inProgress, icon: Clock,         color: "bg-warning-light text-warning" },
              { label: "Not Started", value: notStarted, icon: CircleDashed,  color: "bg-surface-subtle text-ink-muted" },
            ].map((s) => (
              <Card key={s.label} padding="sm" className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-ink">{s.value}</p>
                  <p className="text-xs text-ink-muted">{s.label}</p>
                </div>
              </Card>
            ))}
          </motion.div>

          {/* College logo */}
          <motion.div variants={listItem}>
            <Card padding="md">
              <CardHeader>
                <CardTitle>College Logo</CardTitle>
              </CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-surface-border bg-surface-muted flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Batch logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-xs text-ink-faint text-center px-2">No logo yet</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink">
                    Shown to students in this batch on their induction screens (in place of the default icon).
                  </p>
                  <p className="text-xs text-ink-muted mt-1.5">
                    <span className="font-medium text-ink">Recommended:</span> square PNG with a
                    transparent background, <span className="font-medium text-ink">512 × 512 px</span>{" "}
                    (min 256 × 256). PNG, JPG, WEBP or SVG · max 1 MB. A wide wordmark also works —
                    keep it near 800 × 240 px.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={handleLogoUpload}
                  />
                  {canManage && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" loading={logoBusy} icon={<Upload className="w-4 h-4" />} onClick={() => logoInputRef.current?.click()}>
                        {logoUrl ? "Replace logo" : "Upload logo"}
                      </Button>
                      {logoUrl && (
                        <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={removeLogo} disabled={logoBusy}>
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Form assignments */}
          <motion.div variants={listItem}>
            <Card padding="md">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Induction Steps for this Batch</CardTitle>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={openAssign}>
                        Assign form
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              {assignOpen && (
                <div className="mb-3 p-3 rounded-xl bg-surface-muted border border-surface-border flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-surface-border text-sm bg-white"
                  >
                    <option value="">Choose an existing form…</option>
                    {availableTemplates
                      .filter((t) => !assignedTemplateIds.has(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.type.replace(/_/g, " ")})
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy} onClick={assignTemplate}>Add step</Button>
                    <Button size="sm" variant="ghost" onClick={() => router.push("/admin/templates")}>
                      New form
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {batch.formAssignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
                    <span className="w-6 h-6 rounded-md bg-brand-50 text-brand text-xs font-bold flex items-center justify-center shrink-0">
                      {a.order}
                    </span>
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">{a.formTemplate.name}</span>
                    <Badge variant="muted" className="text-xs hidden sm:inline-flex">{a.formTemplate.type.replace(/_/g, " ")}</Badge>
                    {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => router.push(`/admin/templates/${a.formTemplate.id}`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50"
                        aria-label="Edit form"
                        title="Edit this form"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => customiseForBatch(a.id, a.formTemplate.name)}
                        disabled={busy}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-accent hover:bg-accent-50"
                        aria-label="Customise for this batch"
                        title="Make a private copy for this batch"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeAssignment(a.id)}
                        disabled={busy}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light"
                        aria-label="Remove step"
                        title="Remove this step from the batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    )}
                  </div>
                ))}
                {batch.formAssignments.length === 0 && (
                  <p className="text-sm text-ink-muted py-4 text-center">
                    No form steps yet — use “Assign form” to add one.
                  </p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Student roster actions */}
          <motion.div variants={listItem}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-ink flex-1">
                Student Roster ({total})
              </h2>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="w-4 h-4" />}
                onClick={exportCsv}
              >
                Export CSV
              </Button>
              {canManage && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    className="sr-only"
                    onChange={handleCsvUpload}
                  />
                  <Button
                    size="sm"
                    icon={<Upload className="w-4 h-4" />}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Bulk Import
                  </Button>
                </>
              )}
            </div>

            {/* CSV format hint */}
            <p className="text-xs text-ink-muted mb-3">
              CSV columns: <code className="bg-surface-subtle px-1 rounded">name, reg_no, email, mobile</code>
              {" "}· optional: <code className="bg-surface-subtle px-1 rounded">username, password</code>.
              These import straight into <span className="font-medium">this batch</span>. To load many
              batches at once, use{" "}
              <button onClick={() => router.push("/admin/students/import")} className="text-brand font-medium underline">Import Students</button>.
            </p>

            {/* Search */}
            <input
              type="search"
              placeholder="Search by name or reg no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-surface-border mb-4 text-sm focus:border-brand focus:outline-none"
            />
          </motion.div>

          {/* Student table */}
          <motion.div variants={listItem} className="flex flex-col gap-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-ink-muted text-sm">
                {search ? "No students match your search" : "No students in this batch yet"}
              </div>
            )}

            {filtered.map((student) => {
              const cfg = statusConfig[student.status];
              return (
                <div
                  key={student.id}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-surface-border p-4 hover:border-brand/30 transition-all"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-brand font-bold text-sm">
                    {student.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{student.name}</p>
                    <p className="text-xs text-ink-muted">{student.regNo}</p>
                  </div>

                  {/* Progress */}
                  <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                    <div className="w-20 h-1.5 bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full transition-all duration-500"
                        style={{ width: `${student.completionPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-muted">{student.completionPct}%</span>
                  </div>

                  {/* Status badge */}
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => router.push(`/admin/students/${student.id}`)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50 transition-colors"
                      aria-label="View student"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {student.pdfUrl && (
                      <a
                        href={student.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50 transition-colors"
                        aria-label="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
