"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { slugify } from "@/lib/utils";
import { listContainer, listItem } from "@/lib/motion";

type TemplateType =
  | "REGISTRATION"
  | "ACKNOWLEDGMENT"
  | "DELIVERABLES_TABLE"
  | "DOCUMENT_UPLOAD";

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  version: number;
  assignedCount: number;
  schema: Record<string, unknown>;
  signatoryRoles: Array<{ role: string; label: string }>;
}

// ── small helpers ────────────────────────────────────────────────────────────

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
      {children}
    </h2>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function AdminTemplateEditorClient({ template }: { template: TemplateData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where "Back" should return to — the batch that opened this editor, or the templates list.
  const returnTo = searchParams.get("returnTo") || "/admin/templates";
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");

  // Type-specific state
  const [fields, setFields] = useState<
    Array<{ id: string; label: string; type: string; required: boolean; options: string }>
  >(
    (((template.schema.fields as unknown[]) ?? []) as Array<Record<string, unknown>>).map((f) => ({
      id: String(f.id ?? ""),
      label: String(f.label ?? ""),
      type: String(f.type ?? "text"),
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? (f.options as string[]).join(", ") : "",
    }))
  );

  const [clauses, setClauses] = useState<string[]>(
    ((template.schema.clauses as string[]) ?? []).slice()
  );
  const [ackText, setAckText] = useState(String(template.schema.acknowledgmentText ?? ""));

  const [rows, setRows] = useState<
    Array<{ id: string; deliverable: string; keyPoints: string }>
  >(
    (((template.schema.rows as unknown[]) ?? []) as Array<Record<string, unknown>>).map((r, i) => ({
      id: String(r.id ?? `row-${i + 1}`),
      deliverable: String(r.deliverable ?? ""),
      keyPoints: String(r.keyPoints ?? ""),
    }))
  );
  const [programmeValue, setProgrammeValue] = useState(
    String(
      (template.schema.programmeHeader as Record<string, unknown> | undefined)?.value ?? ""
    )
  );
  const [declaration, setDeclaration] = useState(String(template.schema.declaration ?? ""));

  const [docs, setDocs] = useState<
    Array<{ id: string; label: string; required: boolean; accept: string; maxSizeMB: number }>
  >(
    (((template.schema.documents as unknown[]) ?? []) as Array<Record<string, unknown>>).map((d, i) => ({
      id: String(d.id ?? `doc-${i + 1}`),
      label: String(d.label ?? ""),
      required: Boolean(d.required),
      accept: String(d.accept ?? "image/jpeg,image/png,application/pdf"),
      maxSizeMB: Number(d.maxSizeMB ?? 5),
    }))
  );
  const [allowSkip, setAllowSkip] = useState(Boolean(template.schema.allowSkip));

  // ── build schema for save ──────────────────────────────────────────────────

  function buildSchema(): Record<string, unknown> {
    switch (template.type) {
      case "REGISTRATION":
        return {
          ...template.schema,
          allowSkip,
          fields: fields.map((f) => ({
            id: f.id || slugify(f.label).replace(/-/g, "_"),
            label: f.label,
            type: f.type,
            required: f.required,
            ...(f.type === "radio" || f.type === "select"
              ? {
                  options: f.options
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                }
              : {}),
          })),
        };
      case "ACKNOWLEDGMENT":
        return {
          ...template.schema,
          allowSkip,
          clauses: clauses.map((c) => c.trim()).filter(Boolean),
          acknowledgmentText: ackText,
        };
      case "DELIVERABLES_TABLE":
        return {
          ...template.schema,
          allowSkip,
          programmeHeader: {
            label: "Programme",
            value: programmeValue,
          },
          rows: rows.map((r, i) => ({
            id: r.id || `row-${i + 1}`,
            sno: i + 1,
            deliverable: r.deliverable,
            keyPoints: r.keyPoints,
          })),
          declaration,
        };
      case "DOCUMENT_UPLOAD":
        return {
          ...template.schema,
          allowSkip,
          documents: docs.map((d, i) => ({
            id: d.id || `doc-${i + 1}`,
            type: d.id || `doc-${i + 1}`,
            label: d.label,
            required: d.required,
            accept: d.accept,
            maxSizeMB: d.maxSizeMB,
          })),
        };
      default:
        return template.schema;
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          schema: buildSchema(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Template saved");
      router.refresh();
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-surface-muted pb-28">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(returnTo)}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-ink truncate">{name || "Untitled template"}</p>
            <p className="text-xs text-ink-muted">
              {template.type.replace(/_/g, " ")} · v{template.version} ·{" "}
              {template.assignedCount} batch(es)
            </p>
          </div>
          <Badge variant="default">{template.type.replace(/_/g, " ")}</Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
          {template.assignedCount > 1 && (
            <motion.div variants={listItem}>
              <Card padding="sm" className="bg-accent-50 border border-accent/20">
                <p className="text-sm text-ink">
                  This template is shared by{" "}
                  <span className="font-semibold">{template.assignedCount} batches</span>. Editing it
                  changes the step for all of them. To customise just one batch, use{" "}
                  <span className="font-medium">“Customise for this batch”</span> on the batch page.
                </p>
              </Card>
            </motion.div>
          )}

          {/* Meta */}
          <motion.div variants={listItem}>
            <SectionTitle>Template Details</SectionTitle>
            <Card padding="md" className="flex flex-col gap-4">
              <Input id="tpl-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                id="tpl-desc"
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional short description"
              />
              <label className="flex items-start gap-2.5 text-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowSkip}
                  onChange={(e) => setAllowSkip(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Allow students to skip this step</span>
                  <span className="block text-xs text-ink-muted mt-0.5">
                    Students can complete the step without filling everything in.
                    Skipped submissions are flagged so you can follow up.
                  </span>
                </span>
              </label>
            </Card>
          </motion.div>

          {/* Type-specific editor */}
          {template.type === "REGISTRATION" && (
            <motion.div variants={listItem}>
              <SectionTitle>Form Fields</SectionTitle>
              <div className="flex flex-col gap-3">
                {fields.map((f, i) => (
                  <Card key={i} padding="md" className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-ink-faint" />
                      <span className="text-xs font-semibold text-ink-muted">Field {i + 1}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => setFields(move(fields, i, i - 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => setFields(move(fields, i, i + 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-error-light text-error" aria-label="Delete field"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <Input id={`f-label-${i}`} label="Label" value={f.label} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm text-ink-muted">Type</label>
                      <select
                        value={f.type}
                        onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                        className="px-3 py-2 rounded-lg border border-surface-border text-sm bg-white"
                      >
                        {["text", "tel", "email", "number", "date", "radio", "select", "checkbox"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        <input type="checkbox" checked={f.required} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />
                        Required
                      </label>
                    </div>
                    {(f.type === "radio" || f.type === "select") && (
                      <Input id={`f-opts-${i}`} label="Options (comma-separated)" value={f.options} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} placeholder="e.g. Male, Female, Other" />
                    )}
                  </Card>
                ))}
                <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setFields([...fields, { id: "", label: "", type: "text", required: false, options: "" }])}>
                  Add field
                </Button>
              </div>
            </motion.div>
          )}

          {template.type === "ACKNOWLEDGMENT" && (
            <>
              <motion.div variants={listItem}>
                <SectionTitle>Clauses</SectionTitle>
                <div className="flex flex-col gap-3">
                  {clauses.map((c, i) => (
                    <Card key={i} padding="sm" className="flex gap-2 items-start">
                      <span className="text-xs font-bold text-brand mt-2 shrink-0">{i + 1}.</span>
                      <textarea
                        value={c}
                        onChange={(e) => setClauses(clauses.map((x, j) => (j === i ? e.target.value : x)))}
                        rows={2}
                        className="flex-1 px-3 py-2 rounded-lg border border-surface-border text-sm resize-y"
                      />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => setClauses(move(clauses, i, i - 1))} className="p-1 rounded hover:bg-surface-subtle text-ink-muted" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => setClauses(move(clauses, i, i + 1))} className="p-1 rounded hover:bg-surface-subtle text-ink-muted" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => setClauses(clauses.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-error-light text-error" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </Card>
                  ))}
                  <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setClauses([...clauses, ""])}>
                    Add clause
                  </Button>
                </div>
              </motion.div>
              <motion.div variants={listItem}>
                <SectionTitle>Acknowledgment Text</SectionTitle>
                <Card padding="md">
                  <textarea value={ackText} onChange={(e) => setAckText(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-surface-border text-sm resize-y" />
                </Card>
              </motion.div>
            </>
          )}

          {template.type === "DELIVERABLES_TABLE" && (
            <>
              <motion.div variants={listItem}>
                <SectionTitle>Programme</SectionTitle>
                <Card padding="md">
                  <Input id="prog" label="Programme name" value={programmeValue} onChange={(e) => setProgrammeValue(e.target.value)} placeholder="e.g. R-Smart Engineering Intellect" />
                </Card>
              </motion.div>
              <motion.div variants={listItem}>
                <SectionTitle>Deliverable Rows</SectionTitle>
                <div className="flex flex-col gap-3">
                  {rows.map((r, i) => (
                    <Card key={r.id} padding="md" className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-brand-50 text-brand text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-xs font-semibold text-ink-muted">Deliverable</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => setRows(move(rows, i, i - 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => setRows(move(rows, i, i + 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-error-light text-error" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <Input id={`d-name-${i}`} label="Name" value={r.deliverable} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, deliverable: e.target.value } : x)))} />
                      <div>
                        <label className="text-sm font-medium text-ink mb-1.5 block">Key points / inclusions</label>
                        <textarea value={r.keyPoints} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, keyPoints: e.target.value } : x)))} rows={4} className="w-full px-3 py-2 rounded-lg border border-surface-border text-sm resize-y" placeholder="One point per line" />
                      </div>
                    </Card>
                  ))}
                  <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setRows([...rows, { id: `row-${Date.now()}`, deliverable: "", keyPoints: "" }])}>
                    Add deliverable row
                  </Button>
                </div>
              </motion.div>
              <motion.div variants={listItem}>
                <SectionTitle>Declaration</SectionTitle>
                <Card padding="md">
                  <textarea value={declaration} onChange={(e) => setDeclaration(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-surface-border text-sm resize-y" />
                </Card>
              </motion.div>
            </>
          )}

          {template.type === "DOCUMENT_UPLOAD" && (
            <motion.div variants={listItem}>
              <SectionTitle>Required Documents</SectionTitle>
              <div className="flex flex-col gap-3">
                {docs.map((d, i) => (
                  <Card key={i} padding="md" className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink-muted">Document {i + 1}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => setDocs(move(docs, i, i - 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => setDocs(move(docs, i, i + 1))} className="p-1.5 rounded-lg hover:bg-surface-subtle text-ink-muted" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => setDocs(docs.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-error-light text-error" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <Input id={`doc-label-${i}`} label="Label" value={d.label} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        <input type="checkbox" checked={d.required} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        Max size (MB)
                        <input type="number" min={1} max={25} value={d.maxSizeMB} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, maxSizeMB: Number(e.target.value) } : x)))} className="w-20 px-2 py-1 rounded-lg border border-surface-border text-sm" />
                      </label>
                    </div>
                  </Card>
                ))}
                <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setDocs([...docs, { id: `doc-${Date.now()}`, label: "", required: true, accept: "image/jpeg,image/png,application/pdf", maxSizeMB: 5 }])}>
                  Add document
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Sticky save bar */}
      <div className="bottom-action-bar">
        <Button size="lg" fullWidth loading={saving} onClick={handleSave} icon={<Save className="w-5 h-5" />}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
