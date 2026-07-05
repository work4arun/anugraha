"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PenLine,
  CheckSquare,
  CalendarDays,
  Type,
  List,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

// pdf.js worker (matches the pinned pdfjs-dist version).
const PDF_WORKER_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type SignerRole = "student" | "parent";
type FieldType = "SIGNATURE" | "CHECKBOX" | "DATE" | "TEXT" | "DROPDOWN";

interface Field {
  key: string;          // stable client id
  signerRole: SignerRole;
  fieldType: FieldType;
  label: string;        // prompt for TEXT/CHECKBOX/DROPDOWN (e.g. "Full name")
  required: boolean;
  options: string[];    // DROPDOWN only
  defaultValue: string; // DROPDOWN only ("" = no default)
  page: number;         // 1-based
  x: number;            // normalized 0..1, top-left origin
  y: number;
  width: number;
  height: number;
}

interface AgreementData {
  id: string;
  name: string;
  batchId: string;
  originalPdfUrl: string;
  pageCount: number;
  fields: Array<{
    id: string;
    signerRole: string;
    fieldType?: string;
    label?: string | null;
    required?: boolean;
    options?: string[];
    defaultValue?: string | null;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

const ROLE_STYLE: Record<SignerRole, { label: string; bg: string; border: string; text: string }> = {
  student: { label: "Student", bg: "rgba(37,138,221,0.18)", border: "#258ADD", text: "#0C447C" },
  parent: { label: "Parent / Guardian", bg: "rgba(99,153,34,0.18)", border: "#639922", text: "#27500A" },
};

const TYPE_META: Record<FieldType, { label: string; defaultW: number; defaultH: number; minW: number; minH: number }> = {
  SIGNATURE: { label: "Signature", defaultW: 0.25, defaultH: 0.08, minW: 0.05, minH: 0.03 },
  CHECKBOX:  { label: "Checkbox",  defaultW: 0.035, defaultH: 0.025, minW: 0.015, minH: 0.012 },
  DATE:      { label: "Date signed", defaultW: 0.16, defaultH: 0.035, minW: 0.06, minH: 0.02 },
  TEXT:      { label: "Text", defaultW: 0.25, defaultH: 0.04, minW: 0.06, minH: 0.02 },
  DROPDOWN:  { label: "Dropdown", defaultW: 0.2, defaultH: 0.04, minW: 0.06, minH: 0.02 },
};

function typeIcon(t: FieldType, className: string) {
  switch (t) {
    case "SIGNATURE": return <PenLine className={className} />;
    case "CHECKBOX": return <CheckSquare className={className} />;
    case "DATE": return <CalendarDays className={className} />;
    case "TEXT": return <Type className={className} />;
    case "DROPDOWN": return <List className={className} />;
  }
}

function asFieldType(v: unknown): FieldType {
  return v === "CHECKBOX" || v === "DATE" || v === "TEXT" || v === "DROPDOWN"
    ? v
    : "SIGNATURE";
}

let _keySeq = 0;
const nextKey = () => `f${Date.now()}_${_keySeq++}`;

export function AgreementEditorClient({
  agreement,
  canManage,
}: {
  agreement: AgreementData;
  canManage: boolean;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<unknown>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [fields, setFields] = useState<Field[]>(
    agreement.fields.map((f) => ({
      key: nextKey(),
      signerRole: (f.signerRole === "parent" ? "parent" : "student") as SignerRole,
      fieldType: asFieldType(f.fieldType),
      label: f.label ?? "",
      required: f.required !== false,
      options: f.options ?? [],
      defaultValue: f.defaultValue ?? "",
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    }))
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ── Load the PDF once ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        const doc = await pdfjs.getDocument({ url: agreement.originalPdfUrl }).promise;
        if (cancelled) return;
        pdfRef.current = doc;
        setReady(true);
      } catch (err) {
        console.error("[agreement editor] pdf load failed", err);
        toast.error("Could not load the PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agreement.originalPdfUrl]);

  // ── Render the current page ────────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    const doc = pdfRef.current as {
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
      }>;
    } | null;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const pdfPage = await doc.getPage(page);
    const container = canvas.parentElement;
    const maxWidth = Math.min(container?.clientWidth ?? 800, 900);
    const base = pdfPage.getViewport({ scale: 1 });
    const scale = maxWidth / base.width;
    const viewport = pdfPage.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setCanvasSize({ w: viewport.width, h: viewport.height });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderTaskRef.current?.cancel();
    const task = pdfPage.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch {
      /* render cancelled on page change — ignore */
    }
  }, [page]);

  useEffect(() => {
    if (ready) renderPage();
  }, [ready, page, renderPage]);

  // ── Drag / resize ──────────────────────────────────────────────────────────
  const dragRef = useRef<{
    key: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  function beginDrag(
    e: React.MouseEvent,
    field: Field,
    mode: "move" | "resize"
  ) {
    if (!canManage) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      key: field.key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      origW: field.width,
      origH: field.height,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", endDrag);
  }

  const onDragMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    const size = { w: canvasRef.current?.width ?? 0, h: canvasRef.current?.height ?? 0 };
    if (!d || !size.w || !size.h) return;
    const dx = (e.clientX - d.startX) / size.w;
    const dy = (e.clientY - d.startY) / size.h;

    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== d.key) return f;
        if (d.mode === "move") {
          const x = Math.min(Math.max(d.origX + dx, 0), 1 - f.width);
          const y = Math.min(Math.max(d.origY + dy, 0), 1 - f.height);
          return { ...f, x, y };
        }
        const meta = TYPE_META[f.fieldType];
        const width = Math.min(Math.max(d.origW + dx, meta.minW), 1 - f.x);
        const height = Math.min(Math.max(d.origH + dy, meta.minH), 1 - f.y);
        return { ...f, width, height };
      })
    );
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", endDrag);
  }, [onDragMove]);

  function addField(role: SignerRole, fieldType: FieldType = "SIGNATURE") {
    const meta = TYPE_META[fieldType];
    const key = nextKey();
    setFields((prev) => [
      ...prev,
      {
        key,
        signerRole: role,
        fieldType,
        label: "",
        required: true,
        options: fieldType === "DROPDOWN" ? ["Option 1", "Option 2"] : [],
        defaultValue: "",
        page,
        x: 0.35,
        y: 0.45,
        width: meta.defaultW,
        height: meta.defaultH,
      },
    ]);
    setSelectedKey(key);
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
    setSelectedKey((k) => (k === key ? null : k));
  }

  function updateField(key: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function save() {
    const emptyDropdown = fields.find(
      (f) => f.fieldType === "DROPDOWN" && f.options.filter((o) => o.trim()).length === 0
    );
    if (emptyDropdown) {
      setSelectedKey(emptyDropdown.key);
      toast.error("Every dropdown needs at least one option");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agreements/${agreement.id}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map((f) => ({
            signerRole: f.signerRole,
            fieldType: f.fieldType,
            label: f.label || undefined,
            required: f.required,
            options: f.fieldType === "DROPDOWN" ? f.options : undefined,
            defaultValue:
              f.fieldType === "DROPDOWN" && f.defaultValue ? f.defaultValue : undefined,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      toast.success(`Saved ${data.data.count} field${data.data.count === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const pageFields = fields.filter((f) => f.page === page);
  const counts = {
    student: fields.filter((f) => f.signerRole === "student").length,
    parent: fields.filter((f) => f.signerRole === "parent").length,
  };

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/admin/batches/${agreement.batchId}`)}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
            aria-label="Back to batch"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink truncate">{agreement.name}</p>
            <p className="text-xs text-ink-muted">
              {counts.student} student · {counts.parent} parent field(s)
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={save} loading={saving} icon={<Save className="w-4 h-4" />}>
              Save
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {canManage && (
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => addField("student", "SIGNATURE")}
                style={{ borderColor: ROLE_STYLE.student.border, color: ROLE_STYLE.student.text }}
              >
                Student signature
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => addField("parent", "SIGNATURE")}
                style={{ borderColor: ROLE_STYLE.parent.border, color: ROLE_STYLE.parent.text }}
              >
                Parent signature
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<CheckSquare className="w-4 h-4" />}
                onClick={() => addField("student", "CHECKBOX")}
              >
                Checkbox
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<CalendarDays className="w-4 h-4" />}
                onClick={() => addField("student", "DATE")}
              >
                Date signed
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Type className="w-4 h-4" />}
                onClick={() => addField("student", "TEXT")}
              >
                Text
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<List className="w-4 h-4" />}
                onClick={() => addField("student", "DROPDOWN")}
              >
                Dropdown
              </Button>
              <span className="text-xs text-ink-muted ml-auto">
                Drag to move; drag the corner to resize. Date fields auto-fill on signing.
              </span>
            </div>

            {/* Properties for the selected TEXT/CHECKBOX/DROPDOWN field */}
            {(() => {
              const sel = fields.find((f) => f.key === selectedKey);
              if (
                !sel ||
                (sel.fieldType !== "TEXT" &&
                  sel.fieldType !== "CHECKBOX" &&
                  sel.fieldType !== "DROPDOWN")
              )
                return null;
              return (
                <div className="rounded-xl border border-surface-border bg-white px-3 py-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-ink flex items-center gap-1">
                      {typeIcon(sel.fieldType, "w-3.5 h-3.5")}
                      {TYPE_META[sel.fieldType].label} field
                    </span>
                    <input
                      type="text"
                      value={sel.label}
                      onChange={(e) => updateField(sel.key, { label: e.target.value })}
                      placeholder={
                        sel.fieldType === "TEXT"
                          ? "Label, e.g. Full name"
                          : sel.fieldType === "DROPDOWN"
                          ? "Label, e.g. Blood group"
                          : "Label, e.g. I agree to the terms"
                      }
                      className="flex-1 min-w-[200px] text-sm border border-surface-border rounded-lg px-2 py-1.5"
                      maxLength={120}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted select-none">
                      <input
                        type="checkbox"
                        checked={sel.required}
                        onChange={(e) => updateField(sel.key, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>

                  {sel.fieldType === "DROPDOWN" && (
                    <div className="border-t border-surface-border pt-2 space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                        Options
                      </p>
                      {sel.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const options = [...sel.options];
                              options[i] = e.target.value;
                              updateField(sel.key, { options });
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 text-sm border border-surface-border rounded-lg px-2 py-1"
                            maxLength={120}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (i === 0) return;
                              const options = [...sel.options];
                              [options[i - 1], options[i]] = [options[i], options[i - 1]];
                              updateField(sel.key, { options });
                            }}
                            disabled={i === 0}
                            className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center disabled:opacity-30"
                            aria-label="Move option up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (i === sel.options.length - 1) return;
                              const options = [...sel.options];
                              [options[i], options[i + 1]] = [options[i + 1], options[i]];
                              updateField(sel.key, { options });
                            }}
                            disabled={i === sel.options.length - 1}
                            className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center disabled:opacity-30"
                            aria-label="Move option down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const removed = sel.options[i];
                              const options = sel.options.filter((_, j) => j !== i);
                              updateField(sel.key, {
                                options,
                                // Clear the default if its option was removed.
                                defaultValue:
                                  sel.defaultValue === removed ? "" : sel.defaultValue,
                              });
                            }}
                            className="w-7 h-7 rounded-lg border border-surface-border flex items-center justify-center text-error"
                            aria-label="Remove option"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Plus className="w-3.5 h-3.5" />}
                          onClick={() =>
                            updateField(sel.key, { options: [...sel.options, ""] })
                          }
                          disabled={sel.options.length >= 50}
                        >
                          Add option
                        </Button>
                        <label className="flex items-center gap-2 text-xs text-ink-muted">
                          Default:
                          <select
                            value={sel.defaultValue}
                            onChange={(e) =>
                              updateField(sel.key, { defaultValue: e.target.value })
                            }
                            className="text-sm border border-surface-border rounded-lg px-2 py-1 bg-white"
                          >
                            <option value="">No default</option>
                            {sel.options
                              .filter((o) => o.trim())
                              .map((o, i) => (
                                <option key={`${o}_${i}`} value={o}>
                                  {o}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-surface-border disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-ink-muted">
            Page {page} of {agreement.pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(agreement.pageCount, p + 1))}
            disabled={page >= agreement.pageCount}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-surface-border disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* PDF canvas + overlay */}
        <div className="flex justify-center">
          <div className="relative inline-block shadow-card rounded-lg overflow-hidden bg-white">
            <canvas ref={canvasRef} className="block" />
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ width: canvasSize.w, height: canvasSize.h }}
            >
              {pageFields.map((f) => {
                const s = ROLE_STYLE[f.signerRole];
                const isSelected = f.key === selectedKey;
                const tag =
                  f.fieldType === "SIGNATURE"
                    ? s.label
                    : f.label || TYPE_META[f.fieldType].label;
                return (
                  <div
                    key={f.key}
                    onMouseDown={(e) => {
                      setSelectedKey(f.key);
                      beginDrag(e, f, "move");
                    }}
                    className="absolute select-none"
                    style={{
                      left: f.x * canvasSize.w,
                      top: f.y * canvasSize.h,
                      width: f.width * canvasSize.w,
                      height: f.height * canvasSize.h,
                      background: s.bg,
                      border: `${isSelected ? 2 : 1.5}px ${f.fieldType === "SIGNATURE" ? "solid" : "dashed"} ${s.border}`,
                      borderRadius: 4,
                      cursor: canManage ? "move" : "default",
                      boxShadow: isSelected ? `0 0 0 2px ${s.bg}` : undefined,
                    }}
                  >
                    <span
                      className="absolute top-0 left-0 px-1 text-[10px] font-medium flex items-center gap-0.5 whitespace-nowrap overflow-hidden max-w-full"
                      style={{ color: s.text }}
                    >
                      {typeIcon(f.fieldType, "w-2.5 h-2.5 shrink-0")}
                      {tag}
                      {f.fieldType !== "SIGNATURE" && f.fieldType !== "DATE" && f.required ? " *" : ""}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => removeField(f.key)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-surface-border flex items-center justify-center text-error"
                          aria-label="Remove field"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div
                          onMouseDown={(e) => beginDrag(e, f, "resize")}
                          className="absolute bottom-0 right-0 w-3 h-3"
                          style={{ cursor: "nwse-resize", background: s.border }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {!ready && (
              <div className="p-16 text-center text-sm text-ink-muted">Loading PDF…</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
