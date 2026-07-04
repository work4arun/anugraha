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
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
  const [dupId, setDupId] = useState<string | null>(null);

  const templates = batches.filter((b) => b.isTemplate);
  const regular = batches.filter((b) => !b.isTemplate);

  async function duplicate(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDupId(id);
    try {
      const res = await fetch(`/api/admin/batches/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Batch created from template — opening it");
      router.push(`/admin/batches/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate batch");
      setDupId(null);
    }
  }

  function BatchCard({ batch, template }: { batch: Batch; template?: boolean }) {
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
            <h3 className="font-semibold text-ink truncate">{batch.name}</h3>
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
              loading={dupId === batch.id}
              icon={<Copy className="w-4 h-4" />}
              onClick={(e) => duplicate(e, batch.id)}
            >
              {template ? "Use / Duplicate" : "Duplicate"}
            </Button>
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
    </div>
  );
}
