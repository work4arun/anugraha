"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Users,
  FileText,
  ChevronRight,
  LogOut,
  Lock,
  Copy,
  Sparkles,
  Trash2,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  name: string;
  course: string;
  academicYear: string;
  isActive: boolean;
  isTemplate: boolean;
  institutionCode: string;
  studentCount: number;
  formCount: number;
  ownerName: string | null;
  canManage: boolean;
}

export function AdminBatchesClient({
  batches,
}: {
  batches: Batch[];
  institutions: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [dupTarget, setDupTarget] = useState<Batch | null>(null);
  const [dupName, setDupName] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<Batch | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renamedNames, setRenamedNames] = useState<Record<string, string>>({});

  const templates = batches.filter((b) => b.isTemplate && !deletedIds.has(b.id));
  const regular = batches.filter((b) => !b.isTemplate && !deletedIds.has(b.id));

  function openDuplicate(e: React.MouseEvent, batch: Batch) {
    e.stopPropagation();
    setDupName(`Copy of ${renamedNames[batch.id] ?? batch.name}`);
    setDupTarget(batch);
  }

  function openDelete(e: React.MouseEvent, batch: Batch) {
    e.stopPropagation();
    setDeleteConfirmText("");
    setDeleteTarget(batch);
  }

  function openRename(e: React.MouseEvent, batch: Batch) {
    e.stopPropagation();
    setRenameValue(renamedNames[batch.id] ?? batch.name);
    setRenameTarget(batch);
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Batch name can't be empty");
      return;
    }
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/admin/batches/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRenamedNames((prev) => ({ ...prev, [renameTarget.id]: trimmed }));
      toast.success("Batch renamed");
      setRenameTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename batch");
    } finally {
      setRenameBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const expectedName = renamedNames[deleteTarget.id] ?? deleteTarget.name;
    if (deleteConfirmText.trim() !== expectedName) {
      toast.error("Type the batch name exactly as shown to confirm");
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/batches/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Batch deleted");
      setDeletedIds((prev) => new Set(prev).add(deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete batch");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function confirmDuplicate() {
    if (!dupTarget) return;
    if (!dupName.trim()) {
      toast.error("Enter a name for the new batch");
      return;
    }
    setDupBusy(true);
    try {
      const res = await fetch(`/api/admin/batches/${dupTarget.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: dupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Batch created — opening it");
      router.push(`/admin/batches/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate batch");
      setDupBusy(false);
    }
  }

  function BatchCard({ batch, template }: { batch: Batch; template?: boolean }) {
    const displayName = renamedNames[batch.id] ?? batch.name;
    return (
      <motion.div
        variants={listItem}
        onClick={() => router.push(`/admin/batches/${batch.id}`)}
        className={cn(
          "bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all",
          template
            ? "border-accent/30 hover:border-accent/50 hover:shadow-card"
            : "border-surface-border hover:border-brand/30 hover:shadow-card"
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {template ? (
                <Badge variant="default">
                  <Sparkles className="w-3 h-3 mr-1 inline" />
                  Template
                </Badge>
              ) : (
                <Badge variant={batch.isActive ? "success" : "muted"} dot>
                  {batch.isActive ? "Active" : "Inactive"}
                </Badge>
              )}
              <Badge variant="default">{batch.institutionCode}</Badge>
              {!template && !batch.canManage && (
                <Badge variant="muted">
                  <Lock className="w-3 h-3 mr-1 inline" />
                  View only
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-ink truncate">{displayName}</h3>
            <p className="text-sm text-ink-muted">{batch.course} · {batch.academicYear}</p>
          </div>
          {!template && <ChevronRight className="w-5 h-5 text-ink-faint shrink-0 mt-1" />}
        </div>

        <div className="flex items-center gap-4 text-xs text-ink-muted">
          {!template && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {batch.studentCount} students
            </span>
          )}
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {batch.formCount} {template ? "steps" : "forms"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {!template && batch.ownerName && (
              <span className="text-ink-faint">by {batch.ownerName}</span>
            )}
            <Button
              size="sm"
              variant={template ? "primary" : "ghost"}
              loading={dupBusy && dupTarget?.id === batch.id}
              icon={<Copy className="w-4 h-4" />}
              onClick={(e) => openDuplicate(e, batch)}
            >
              {template ? "Use / Duplicate" : "Duplicate"}
            </Button>
            {batch.canManage && (
              <button
                onClick={(e) => openRename(e, batch)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:text-brand hover:bg-brand-50 transition-colors shrink-0"
                aria-label="Rename batch"
                title="Rename batch"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {batch.canManage && (
              <button
                onClick={(e) => openDelete(e, batch)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:text-error hover:bg-error-light transition-colors shrink-0"
                aria-label="Delete batch"
                title="Delete batch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink flex-1">Batch Management</h1>
          <Button
            size="sm"
            onClick={() => router.push("/admin/batches/new")}
            icon={<Plus className="w-4 h-4" />}
          >
            New Batch
          </Button>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="min-h-[44px] px-2 text-ink-muted hover:text-ink transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Sample templates */}
        {templates.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Sample Templates
              </h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Start from a ready-made sample. Duplicating copies its steps, logo and settings into a
              new batch you own — no students carried over.
            </p>
            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="visible"
              className="grid gap-4 md:grid-cols-2"
            >
              {templates.map((batch) => (
                <BatchCard key={batch.id} batch={batch} template />
              ))}
            </motion.div>
          </section>
        )}

        {/* Regular batches */}
        <section>
          {templates.length > 0 && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
              Your Batches
            </h2>
          )}
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-4 md:grid-cols-2"
          >
            {regular.length === 0 && (
              <motion.div variants={listItem} className="col-span-2 text-center py-16 text-ink-muted">
                No batches yet.{templates.length > 0 ? " Duplicate a sample above or create one." : " Create your first batch."}
              </motion.div>
            )}
            {regular.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </motion.div>
        </section>
      </main>

      {/* Duplicate + rename modal */}
      {dupTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !dupBusy && setDupTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">Duplicate batch</h3>
            <p className="text-sm text-ink-muted mb-4">
              Copies steps, logo and settings from{" "}
              <span className="font-medium text-ink">{renamedNames[dupTarget.id] ?? dupTarget.name}</span> into a new batch you own.
              No students are copied.
            </p>
            <Input
              id="dup-name"
              label="New batch name"
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDupTarget(null)} disabled={dupBusy}>
                Cancel
              </Button>
              <Button onClick={confirmDuplicate} loading={dupBusy} icon={<Copy className="w-4 h-4" />}>
                Create batch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename batch modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !renameBusy && setRenameTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">Rename batch</h3>
            <p className="text-sm text-ink-muted mb-4">
              This only changes the batch name — students, forms and settings are unaffected.
            </p>
            <Input
              id="rename-batch-name-list"
              label="Batch name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setRenameTarget(null)} disabled={renameBusy}>
                Cancel
              </Button>
              <Button onClick={confirmRename} loading={renameBusy} icon={<Pencil className="w-4 h-4" />}>
                Save name
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete batch modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">Delete batch</h3>
            <p className="text-sm text-ink-muted mb-4">
              This permanently deletes{" "}
              <span className="font-medium text-ink">{renamedNames[deleteTarget.id] ?? deleteTarget.name}</span> and its form
              assignments. This cannot be undone.
            </p>

            {deleteTarget.studentCount > 0 ? (
              <p className="text-sm text-error bg-error-light rounded-xl px-3 py-2 mb-4">
                This batch has {deleteTarget.studentCount} student
                {deleteTarget.studentCount === 1 ? "" : "s"}. Remove all students before you can
                delete it.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-muted mb-3">
                  To confirm, type the batch name exactly (case-sensitive):{" "}
                  <span className="font-semibold text-ink">{renamedNames[deleteTarget.id] ?? deleteTarget.name}</span>
                </p>
                <Input
                  id="delete-confirm-name-list"
                  label="Batch name"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleteBusy}
                disabled={
                  deleteTarget.studentCount > 0 ||
                  deleteConfirmText.trim() !== (renamedNames[deleteTarget.id] ?? deleteTarget.name)
                }
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete batch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
