"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  FileText,
  ClipboardList,
  Table2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { backdropVariants, modalVariants, listContainer, listItem } from "@/lib/motion";

type TemplateType =
  | "REGISTRATION"
  | "ACKNOWLEDGMENT"
  | "DELIVERABLES_TABLE"
  | "DOCUMENT_UPLOAD";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  version: number;
  assignedCount: number;
}

const typeIcon: Record<TemplateType, typeof FileText> = {
  REGISTRATION: FileText,
  ACKNOWLEDGMENT: ClipboardList,
  DELIVERABLES_TABLE: Table2,
  DOCUMENT_UPLOAD: Upload,
};

const TYPE_OPTIONS: { value: TemplateType; label: string; hint: string }[] = [
  { value: "REGISTRATION", label: "Registration / custom form", hint: "Collect fields like a form" },
  { value: "ACKNOWLEDGMENT", label: "Acknowledgment", hint: "Clauses to read & accept" },
  { value: "DELIVERABLES_TABLE", label: "Deliverables table", hint: "Rows acknowledged individually" },
  { value: "DOCUMENT_UPLOAD", label: "Document upload", hint: "Request files to upload" },
];

export function AdminTemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TemplateType>("REGISTRATION");

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Template created");
      router.push(`/admin/templates/${data.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create template");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1">
            <p className="text-base font-semibold text-ink">Form Templates</p>
            <p className="text-xs text-ink-muted">Create and customise forms & requests</p>
          </div>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
            New form
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            const Icon = typeIcon[t.type] ?? FileText;
            return (
              <motion.div key={t.id} variants={listItem}>
                <Card padding="md" className="h-full flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Badge variant="default" className="text-[10px]">{t.type.replace(/_/g, " ")}</Badge>
                      <h3 className="font-semibold text-ink mt-1.5">{t.name}</h3>
                      {t.description && <p className="text-sm text-ink-muted mt-0.5">{t.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-border">
                    <span className="text-xs text-ink-muted">v{t.version} · {t.assignedCount} batch(es)</span>
                    <Button size="sm" variant="ghost" icon={<Pencil className="w-4 h-4" />} onClick={() => router.push(`/admin/templates/${t.id}`)}>
                      Edit
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {templates.length === 0 && (
          <div className="text-center py-16 text-ink-muted text-sm">
            No templates yet. Create your first form or request.
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 bg-black/40 z-50" onClick={() => !creating && setOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6 pointer-events-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-ink">New form / request</h2>
                  <button onClick={() => !creating && setOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex flex-col gap-4">
                  <Input id="new-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hostel Preference Form" required />
                  <Input id="new-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                  <div>
                    <label className="text-sm font-medium text-ink mb-2 block">Type</label>
                    <div className="flex flex-col gap-2">
                      {TYPE_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setType(o.value)}
                          className={`text-left px-3 py-2.5 rounded-xl border-2 transition-colors ${type === o.value ? "border-brand bg-brand-50" : "border-surface-border hover:border-brand/30"}`}
                        >
                          <span className="text-sm font-medium text-ink block">{o.label}</span>
                          <span className="text-xs text-ink-muted">{o.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button size="lg" fullWidth loading={creating} onClick={handleCreate} icon={<Plus className="w-5 h-5" />}>
                    Create & edit
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
