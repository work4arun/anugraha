"use client";

/**
 * SignatureOtpBlock — authenticate-to-sign for forms AFTER the Registration form.
 *
 * Instead of drawing/uploading again, the student's signature captured on the
 * Registration form is loaded and applied once they verify a one-time password
 * sent to their registered mobile. The parent's signature is auto-reused in the
 * same step. Any signatory role that has no saved signature (e.g. an authorised
 * signatory) falls back to a draw pad.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, Smartphone, CheckCircle2, PenLine, Info } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";

interface Role {
  role: string;
  label: string;
}

interface Props {
  formTemplateId: string;
  signatoryRoles: Role[];
  masterSignatures: Record<string, string>; // role -> url (from Registration)
  existingSignatures: Record<string, string>; // already applied on this form
  disabled?: boolean;
  onSigned: (partial: Record<string, string>) => void;
}

export function SignatureOtpBlock({
  formTemplateId,
  signatoryRoles,
  masterSignatures,
  existingSignatures,
  disabled = false,
  onSigned,
}: Props) {
  const rolesWithMaster = signatoryRoles.filter((r) => masterSignatures[r.role]);
  const rolesNeedingDraw = signatoryRoles.filter(
    (r) => !masterSignatures[r.role]
  );

  const alreadyApplied = rolesWithMaster.every((r) => existingSignatures[r.role]);

  const [stage, setStage] = useState<"idle" | "sent" | "done">(
    alreadyApplied ? "done" : "idle"
  );
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const noMaster = rolesWithMaster.length === 0;

  async function sendOtp() {
    setSending(true);
    try {
      const res = await fetch("/api/student/signature/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send OTP");
      setMasked(data.data?.maskedMobile ?? null);
      setDevCode(data.data?.devCode ?? null);
      setStage("sent");
      toast.success(`OTP sent to ${data.data?.maskedMobile ?? "your mobile"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (code.trim().length < 4) {
      toast.error("Enter the OTP you received");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/student/signature/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTemplateId,
          code: code.trim(),
          roles: rolesWithMaster.map((r) => r.role),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      onSigned(data.data?.signatures ?? {});
      setStage("done");
      toast.success("Signature applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDrawConfirm(role: string, dataUrl: string) {
    try {
      const res = await fetch("/api/student/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId, role, dataUrl }),
      });
      if (!res.ok) throw new Error();
      onSigned({ [role]: dataUrl });
      toast.success("Signature saved");
    } catch {
      toast.error("Could not save signature");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Roles backed by a saved signature → OTP authentication */}
      {rolesWithMaster.length > 0 && (
        <Card padding="md" className="border-brand/20">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-brand" />
            <h4 className="text-sm font-semibold text-ink">Authenticate to sign</h4>
          </div>

          {/* Loaded signatures preview */}
          <p className="text-xs text-ink-muted mb-2">
            Your saved signature will be applied to this form:
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {rolesWithMaster.map((r) => (
              <div key={r.role} className="flex flex-col items-center gap-1">
                <div className="w-28 h-14 bg-white rounded-lg border border-surface-border overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingSignatures[r.role] ?? masterSignatures[r.role]}
                    alt={`${r.label} signature`}
                    className="max-w-full max-h-full object-contain p-1"
                  />
                </div>
                <span className="text-[11px] text-ink-muted">{r.label}</span>
              </div>
            ))}
          </div>

          {stage === "done" ? (
            <div className="flex items-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Signature applied and verified
            </div>
          ) : disabled ? (
            <p className="text-xs text-ink-muted">Signing is closed for this submitted form.</p>
          ) : stage === "idle" ? (
            <Button
              size="md"
              onClick={sendOtp}
              loading={sending}
              icon={<Smartphone className="w-4 h-4" />}
              fullWidth
            >
              Send OTP to my registered mobile
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-ink-muted">
                Enter the 6-digit OTP sent to <span className="font-medium text-ink">{masked}</span>.
              </p>
              {devCode && (
                <div className="flex items-center gap-1.5 text-[11px] text-accent-dark bg-accent-50 rounded-lg px-2.5 py-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Dev mode (no SMS gateway): your OTP is <span className="font-mono font-semibold">{devCode}</span>
                </div>
              )}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter OTP"
                className="w-full px-4 py-3 rounded-xl border-2 border-surface-border text-center text-lg tracking-[0.4em] font-semibold focus:border-brand focus:outline-none"
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={sendOtp} loading={sending}>
                  Resend
                </Button>
                <Button size="md" onClick={verifyOtp} loading={verifying} fullWidth icon={<ShieldCheck className="w-4 h-4" />}>
                  Verify &amp; sign
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* No saved signature yet → guide back to Registration */}
      {noMaster && rolesNeedingDraw.length === signatoryRoles.length && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-warning-light border border-warning/30 rounded-2xl p-4"
          >
            <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Add your signature first</p>
              <p className="text-xs text-warning/80 mt-0.5">
                Please complete and sign the <span className="font-medium">Student Registration Form</span>.
                After that, you can sign every other form using a quick OTP — no re-signing needed.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Roles without a saved signature (e.g. authorised signatory) → draw pad */}
      {rolesNeedingDraw.length > 0 && !(noMaster && rolesNeedingDraw.length === signatoryRoles.length) && (
        <div className="flex flex-col gap-4">
          {rolesNeedingDraw.map((r) => (
            <div key={r.role}>
              <div className="flex items-center gap-1.5 mb-1">
                <PenLine className="w-3.5 h-3.5 text-ink-muted" />
                <span className="text-xs text-ink-muted">This signature is not on file — please sign below.</span>
              </div>
              <SignatureCanvas
                label={r.label}
                required
                existingSignatureUrl={existingSignatures[r.role] ?? null}
                onConfirm={(dataUrl) => handleDrawConfirm(r.role, dataUrl)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
