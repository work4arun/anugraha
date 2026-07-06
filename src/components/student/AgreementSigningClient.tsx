"use client";

/**
 * Dedicated, forced final induction step: sign every pending agreement.
 *
 * Unlike a passive dashboard widget, this is a full page reached only after
 * every required form step is submitted (see the server page's redirect
 * guard). One agreement is shown at a time — the student must scroll through
 * the whole PDF, fill any admin-placed fields, and draw a FRESH signature
 * (never reused from an earlier form) before the Sign button unlocks. After
 * the last pending agreement is signed, the student is sent on to /review.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, GraduationCap, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { AgreementInlinePreview } from "@/components/agreements/AgreementInlinePreview";
import type { StudentAgreementItem } from "@/lib/agreement";

const ROLE_LABELS: Record<string, string> = {
  student: "Signature of the Student",
  parent: "Signature of the Parent / Guardian",
};
function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? `Signature of the ${role}`;
}

interface Props {
  agreements: StudentAgreementItem[]; // pending ones only, in order
  studentName: string;
  logoUrl: string;
}

export function AgreementSigningClient({ agreements, studentName, logoUrl }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [valuesByAgreement, setValuesByAgreement] = useState<
    Record<string, Record<string, string | boolean>>
  >({});
  const [signaturesByAgreement, setSignaturesByAgreement] = useState<
    Record<string, Record<string, string>>
  >({});
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});
  const [signing, setSigning] = useState(false);

  const current = agreements[index];
  const firstName = (studentName || "").split(" ")[0];
  const isLast = index === agreements.length - 1;

  const values = valuesByAgreement[current.id] ?? {};
  const signatures = signaturesByAgreement[current.id] ?? {};

  function setValue(fieldId: string, v: string | boolean) {
    setValuesByAgreement((prev) => ({
      ...prev,
      [current.id]: { ...prev[current.id], [fieldId]: v },
    }));
  }

  // Seed admin-configured DROPDOWN defaults once per agreement. Without this
  // a required dropdown with a pre-selected option (set up in the agreement
  // editor) still starts blank here, forcing the student to manually reselect
  // it and quietly adding to what's blocking the Sign button.
  useEffect(() => {
    setValuesByAgreement((prev) => {
      if (prev[current.id]) return prev;
      const seeded: Record<string, string | boolean> = {};
      for (const f of current.inputFields) {
        if (f.fieldType === "DROPDOWN" && f.defaultValue && f.options.includes(f.defaultValue)) {
          seeded[f.id] = f.defaultValue;
        }
      }
      if (Object.keys(seeded).length === 0) return prev;
      return { ...prev, [current.id]: seeded };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  // Stable per-agreement callback — recreated only when the agreement itself
  // changes, not on every keystroke. AgreementInlinePreview's effect that
  // fetches and renders the PDF depends on this function's identity; an
  // inline arrow here would make it re-run (and re-fetch/re-render the whole
  // PDF from scratch) on every unrelated state change in this component.
  const handleReadThrough = useCallback(() => {
    setReadIds((r) => (r[current.id] ? r : { ...r, [current.id]: true }));
  }, [current.id]);
  function setSignature(role: string, dataUrl: string) {
    setSignaturesByAgreement((prev) => ({
      ...prev,
      [current.id]: { ...prev[current.id], [role]: dataUrl },
    }));
  }

  const missingFields = current.inputFields.filter((f) => {
    if (!f.required) return false;
    // Auto-filled fields come from the student's record, not manual entry.
    if (f.autofillKey) return false;
    const v = values[f.id];
    return f.fieldType === "CHECKBOX" ? v !== true : !String(v ?? "").trim();
  });
  const missingRoles = current.roles.filter((r) => !signatures[r]);
  const hasRead = !!readIds[current.id];
  const canSign = hasRead && missingFields.length === 0 && missingRoles.length === 0;

  // Tell the student exactly what's still blocking the button — a silently
  // disabled CTA with no explanation reads as "broken" even when it's working
  // as intended (e.g. a second signer's role, or a field further down the
  // page, still needs attention).
  const blockers: string[] = [];
  if (!hasRead) blockers.push("Scroll through the whole agreement above");
  if (missingFields.length > 0) {
    blockers.push(
      `Complete: ${missingFields.map((f) => f.label || "required field").join(", ")}`
    );
  }
  if (missingRoles.length > 0) {
    blockers.push(`Sign as: ${missingRoles.map(roleLabel).join(", ")}`);
  }

  async function handleSign() {
    if (!canSign || signing) return;
    setSigning(true);
    try {
      const payloadValues: Record<string, string | boolean> = {};
      for (const f of current.inputFields) {
        payloadValues[f.id] =
          f.fieldType === "CHECKBOX" ? values[f.id] === true : String(values[f.id] ?? "").trim();
      }
      const res = await fetch(`/api/student/agreements/${current.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues, signatures }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not sign the agreement");
        return;
      }
      toast.success(`${current.name} signed`);
      if (isLast) {
        router.push("/review");
        router.refresh();
      } else {
        setIndex((i) => i + 1);
      }
    } catch {
      toast.error("Could not sign the agreement. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors -ml-1"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-muted font-medium">
              Agreement {index + 1} of {agreements.length} · Final step
            </p>
            <p className="text-sm font-semibold text-ink truncate">{current.name}</p>
          </div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="College logo"
              className="max-h-11 max-w-[190px] w-auto object-contain shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-brand" />
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1.0] }}
            className="px-4 py-6 pb-36"
          >
            {firstName && (
              <p className="text-sm text-ink-muted mb-4">
                Hey <span className="font-semibold text-brand">{firstName}</span> 👋 — please read{" "}
                <span className="font-medium text-ink">{current.name}</span> in full, then sign
                below.
              </p>
            )}

            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Agreement document
              </p>
              <a
                href={current.originalPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand font-medium min-h-[44px] flex items-center px-1"
              >
                Open in new tab
              </a>
            </div>
            <AgreementInlinePreview
              url={current.originalPdfUrl}
              maxHeight={480}
              onReadThrough={handleReadThrough}
            />
            {!hasRead && (
              <p className="mt-1.5 text-center text-[11px] text-ink-muted">
                Scroll to the end of the agreement above to continue.
              </p>
            )}

            {current.inputFields.length > 0 && (
              <div className="mt-5 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Details
                </p>
                {current.inputFields.map((f) =>
                  f.fieldType === "CHECKBOX" ? (
                    <label
                      key={f.id}
                      className="flex items-start gap-2.5 text-sm text-ink select-none cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={values[f.id] === true}
                        onChange={(e) => setValue(f.id, e.target.checked)}
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
                        onChange={(e) => setValue(f.id, e.target.value)}
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
                  ) : f.autofillKey ? (
                    <label key={f.id} className="block">
                      <span className="text-xs font-medium text-ink-muted">
                        {f.label || "Text"}
                      </span>
                      <input
                        type="text"
                        value={f.autofillValue ?? ""}
                        readOnly
                        aria-readonly
                        placeholder="—"
                        className="mt-1 w-full text-sm border border-surface-border rounded-lg px-3 py-2 bg-surface-subtle text-ink-muted cursor-not-allowed"
                      />
                      <span className="mt-1 block text-[11px] text-ink-muted">
                        Filled in automatically from your details.
                      </span>
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
                        onChange={(e) => setValue(f.id, e.target.value)}
                        maxLength={200}
                        className="mt-1 w-full text-sm border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
                      />
                    </label>
                  )
                )}
              </div>
            )}

            {current.roles.length > 0 && (
              <div className="mt-6 flex flex-col gap-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {hasRead
                    ? "Sign below"
                    : "Sign below (unlocks once you've read the agreement above)"}
                </p>
                {current.roles.map((role) => (
                  <SignatureCanvas
                    key={`${current.id}_${role}`}
                    label={roleLabel(role)}
                    required
                    disabled={!hasRead}
                    onConfirm={(dataUrl) => setSignature(role, dataUrl)}
                    onClear={() => setSignature(role, "")}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky bottom CTA */}
      <div className="bottom-action-bar">
        {!canSign && !signing && blockers.length > 0 && (
          <p className="text-xs text-warning text-center mb-2 px-2">
            {blockers.join(" · ")}
          </p>
        )}
        <Button
          size="lg"
          fullWidth
          onClick={handleSign}
          disabled={!canSign || signing}
          icon={
            signing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileSignature className="w-5 h-5" />
            )
          }
        >
          {signing ? "Signing…" : isLast ? "Sign & Finish" : "Sign & Continue"}
        </Button>
      </div>
    </div>
  );
}
