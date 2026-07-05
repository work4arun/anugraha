"use client";

/**
 * Student-facing agreements block (dashboard).
 *
 * Lists the batch's active agreements. For each pending one it renders the
 * admin-placed CHECKBOX/TEXT input fields (DocuSign-style; DATE fields are
 * auto-filled server-side) and signs via POST /api/student/agreements/[id]/sign
 * with { values } keyed by field id. Signed agreements show the completed PDF.
 */

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileSignature,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface InputField {
  id: string;
  fieldType: "CHECKBOX" | "TEXT" | "DROPDOWN";
  label: string | null;
  required: boolean;
  options: string[];
  defaultValue: string | null;
  page: number;
}

interface AgreementItem {
  id: string;
  name: string;
  pageCount: number;
  originalPdfUrl: string;
  roles: string[];
  inputFields: InputField[];
  status: "PENDING" | "PARTIAL" | "COMPLETED";
  signedPdfUrl: string | null;
  signedAt: string | null;
}

export function AgreementsCard() {
  const [agreements, setAgreements] = useState<AgreementItem[] | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [signingId, setSigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student/agreements");
      const data = await res.json();
      if (res.ok && data.success) {
        const items: AgreementItem[] = data.data;
        setAgreements(items);
        // Pre-select dropdown defaults (without clobbering anything the
        // student already picked).
        setValues((prev) => {
          const next = { ...prev };
          for (const a of items) {
            for (const f of a.inputFields) {
              if (
                f.fieldType === "DROPDOWN" &&
                f.defaultValue &&
                next[f.id] === undefined
              ) {
                next[f.id] = f.defaultValue;
              }
            }
          }
          return next;
        });
      } else setAgreements([]);
    } catch {
      setAgreements([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sign(agreement: AgreementItem) {
    // Client-side required check for instant feedback (server re-validates).
    const missing = agreement.inputFields.filter((f) => {
      if (!f.required) return false;
      const v = values[f.id];
      return f.fieldType === "CHECKBOX" ? v !== true : !String(v ?? "").trim();
    });
    if (missing.length > 0) {
      toast.error(
        `Please complete: ${missing
          .map(
            (f) =>
              f.label ||
              (f.fieldType === "CHECKBOX"
                ? "checkbox"
                : f.fieldType === "DROPDOWN"
                ? "dropdown"
                : "text field")
          )
          .join(", ")}`
      );
      return;
    }

    setSigningId(agreement.id);
    try {
      const payload: Record<string, string | boolean> = {};
      for (const f of agreement.inputFields) {
        payload[f.id] = f.fieldType === "CHECKBOX" ? values[f.id] === true : String(values[f.id] ?? "").trim();
      }
      const res = await fetch(`/api/student/agreements/${agreement.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === "NO_SIGNATURE") {
          toast.error("Please complete the Registration form (with your signature) first.");
        } else {
          toast.error(data.error || "Could not sign the agreement");
        }
        return;
      }
      toast.success(`${agreement.name} signed`);
      await load();
    } catch {
      toast.error("Could not sign the agreement. Please try again.");
    } finally {
      setSigningId(null);
    }
  }

  // Nothing to show (still loading renders nothing too — the dashboard
  // shouldn't jump for students whose batch has no agreements).
  if (!agreements || agreements.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
        Agreements
      </h2>
      <div className="flex flex-col gap-3">
        {agreements.map((a) => {
          const done = a.status === "COMPLETED";
          return (
            <div
              key={a.id}
              className="rounded-2xl border-2 border-surface-border bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? "bg-success-light" : "bg-brand-50"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <FileSignature className="w-5 h-5 text-brand" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{a.name}</p>
                  <Badge variant={done ? "success" : "warning"} dot className="mt-1">
                    {done ? "Signed" : a.status === "PARTIAL" ? "Partially signed" : "Awaiting your signature"}
                  </Badge>
                </div>
                <a
                  href={done && a.signedPdfUrl ? a.signedPdfUrl : a.originalPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-brand font-medium shrink-0 min-h-[44px] px-1"
                >
                  View <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {!done && (
                <>
                  {a.inputFields.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-surface-border pt-3">
                      {a.inputFields.map((f) =>
                        f.fieldType === "CHECKBOX" ? (
                          <label
                            key={f.id}
                            className="flex items-start gap-2.5 text-sm text-ink select-none cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={values[f.id] === true}
                              onChange={(e) =>
                                setValues((v) => ({ ...v, [f.id]: e.target.checked }))
                              }
                              className="mt-0.5 w-4 h-4 accent-brand"
                            />
                            <span>
                              {f.label || "I agree"}
                              {f.required && <span className="text-error"> *</span>}
                            </span>
                          </label>
                        ) : f.fieldType === "DROPDOWN" ? (
                          <label key={f.id} className="block">
                            <span className="text-xs font-medium text-ink-muted">
                              {f.label || "Select an option"}
                              {f.required && <span className="text-error"> *</span>}
                            </span>
                            <select
                              value={String(values[f.id] ?? "")}
                              onChange={(e) =>
                                setValues((v) => ({ ...v, [f.id]: e.target.value }))
                              }
                              className="mt-1 w-full text-sm border border-surface-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-brand"
                            >
                              <option value="">— Select —</option>
                              {f.options.map((o, i) => (
                                <option key={`${o}_${i}`} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <label key={f.id} className="block">
                            <span className="text-xs font-medium text-ink-muted">
                              {f.label || "Text"}
                              {f.required && <span className="text-error"> *</span>}
                            </span>
                            <input
                              type="text"
                              value={String(values[f.id] ?? "")}
                              onChange={(e) =>
                                setValues((v) => ({ ...v, [f.id]: e.target.value }))
                              }
                              maxLength={200}
                              className="mt-1 w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
                            />
                          </label>
                        )
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    fullWidth
                    className="mt-3"
                    onClick={() => sign(a)}
                    disabled={signingId !== null}
                    icon={
                      signingId === a.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSignature className="w-4 h-4" />
                      )
                    }
                  >
                    {signingId === a.id ? "Signing…" : "Sign agreement"}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
