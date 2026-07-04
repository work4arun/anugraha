"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Save, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { TransportSelect, type TransportValue } from "@/components/forms/TransportSelect";
import { listContainer, listItem } from "@/lib/motion";
import type { RegistrationSchema, FieldDefinition } from "@/types";

interface Props {
  formTemplateId: string;
  schema: unknown;
  signatoryRoles: Array<{ role: string; label: string }>;
  existingData: Record<string, unknown> | null;
  existingSignatures: Record<string, string>;
  priorSignatures: Record<string, string>;
  studentId: string;
  batchCourse?: string;
  onComplete: () => void;
}

export function RegistrationForm({
  formTemplateId,
  schema,
  signatoryRoles,
  existingData,
  existingSignatures,
  priorSignatures,
  studentId,
  batchCourse,
  onComplete,
}: Props) {
  const { fields, declaration } = schema as RegistrationSchema;
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatures, setSignatures] = useState<Record<string, string>>(existingSignatures);

  // Prefill the course from the student's batch (still editable).
  const initialData: Record<string, unknown> = { ...(existingData ?? {}) };
  if (batchCourse && !initialData.course) initialData.course = batchCourse;

  // Prefill any date field flagged `defaultToday` with today's date (ISO).
  const today = new Date().toISOString().slice(0, 10);
  for (const field of (schema as RegistrationSchema).fields) {
    if (field.type === "date" && field.defaultToday && !initialData[field.id]) {
      initialData[field.id] = today;
    }
  }

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: initialData,
  });

  const watchedValues = watch();
  const transportRequired = watchedValues["transport_required"] as boolean;

  // ── Autosave ────────────────────────────────────────────────────────────

  const autosave = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch("/api/student/form-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formTemplateId, data, status: "DRAFT" }),
        });
      } catch {
        // silent autosave failure
      }
    },
    [formTemplateId]
  );

  // ── Signature handler ────────────────────────────────────────────────────

  async function handleSignature(role: string, dataUrl: string) {
    try {
      const res = await fetch("/api/student/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId, role, dataUrl }),
      });
      if (!res.ok) throw new Error("Failed to save signature");
      setSignatures((prev) => ({ ...prev, [role]: dataUrl }));
      toast.success("Signature saved");
    } catch {
      toast.error("Could not save signature — please try again");
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(data: Record<string, unknown>) {
    const allSigned = signatoryRoles.every((r) => signatures[r.role]);
    if (!allSigned) {
      toast.error("Please complete all required signatures before proceeding");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/student/form-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formTemplateId, data, status: "SUBMITTED" }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Registration form saved!");
      onComplete();
    } catch {
      toast.error("Failed to save — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function renderField(field: FieldDefinition) {
    if (field.type === "section_header") {
      return (
        <motion.div key={field.id} variants={listItem} className="pt-2 -mb-1">
          <h3 className="text-sm font-semibold text-brand border-b border-brand/20 pb-2">
            {field.label}
          </h3>
        </motion.div>
      );
    }

    // Conditional display
    if (field.showWhen) {
      const conditionValue = watchedValues[field.showWhen.field];
      if (conditionValue !== field.showWhen.value) return null;
    }

    if (field.type === "radio") {
      return (
        <motion.div key={field.id} variants={listItem}>
          <label className="text-sm font-medium text-ink mb-2 block">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <Controller
            name={field.id}
            control={control}
            rules={{ required: field.required ? `${field.label} is required` : false }}
            render={({ field: f }) => (
              <RadioGroup
                name={field.id}
                options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                value={f.value as string}
                onChange={f.onChange}
                error={errors[field.id]?.message as string}
              />
            )}
          />
        </motion.div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <motion.div key={field.id} variants={listItem}>
          <Controller
            name={field.id}
            control={control}
            render={({ field: f }) => (
              <Checkbox
                label={field.label}
                description={field.hint}
                checked={!!f.value}
                onChange={(e) => f.onChange(e.target.checked)}
              />
            )}
          />
        </motion.div>
      );
    }

    if (field.type === "transport_select") {
      return (
        <motion.div key={field.id} variants={listItem}>
          <Controller
            name={field.id}
            control={control}
            rules={{
              validate: (v: unknown) => {
                if (!field.required) return true;
                const val = (v as TransportValue) ?? {};
                if (!val.route) return "Please select your bus route";
                if (!val.boardingPoint) return "Please select your boarding point";
                return true;
              },
            }}
            render={({ field: f }) => (
              <TransportSelect
                label={field.label}
                routes={field.routes ?? []}
                required={field.required}
                value={f.value as TransportValue | null}
                onChange={f.onChange}
                error={errors[field.id]?.message as string}
              />
            )}
          />
        </motion.div>
      );
    }

    if (field.type === "date") {
      return (
        <motion.div key={field.id} variants={listItem}>
          <Input
            id={field.id}
            label={field.label}
            type="date"
            readOnly={field.readOnly}
            required={field.required}
            hint={field.hint}
            error={errors[field.id]?.message as string}
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
            })}
          />
        </motion.div>
      );
    }

    return (
      <motion.div key={field.id} variants={listItem}>
        <Input
          id={field.id}
          label={field.label}
          type={
            field.type === "tel"
              ? "tel"
              : field.type === "email"
              ? "email"
              : field.type === "number"
              ? "number"
              : "text"
          }
          inputMode={field.inputMode as React.InputHTMLAttributes<HTMLInputElement>["inputMode"]}
          maxLength={field.maxLength}
          placeholder={field.hint}
          readOnly={field.readOnly && field.id !== "course"}
          required={field.required}
          hint={field.hint}
          error={errors[field.id]?.message as string}
          {...register(field.id, {
            required: field.required ? `${field.label} is required` : false,
            pattern: field.pattern
              ? { value: new RegExp(field.pattern), message: `Invalid ${field.label.toLowerCase()}` }
              : undefined,
            // Phone fields: validate the last 10 digits form a valid Indian
            // mobile (starts 6–9), tolerating spaces / +91 prefixes.
            validate:
              field.type === "tel"
                ? (value: unknown) => {
                    const raw = value == null ? "" : String(value).trim();
                    if (!raw) return field.required ? `${field.label} is required` : true;
                    const digits = raw.replace(/\D/g, "");
                    return (
                      /^[6-9]\d{9}$/.test(digits.slice(-10)) ||
                      "Enter a valid 10-digit mobile number"
                    );
                  }
                : undefined,
          })}
        />
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4"
      >
        {fields.map((field) => renderField(field))}

        {/* Declaration */}
        <motion.div variants={listItem}>
          <Card padding="md" className="bg-surface-muted border-none">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Declaration
            </h4>
            <p className="text-sm text-ink leading-relaxed">{declaration}</p>
          </Card>
        </motion.div>

        {/* Signatures */}
        {signatoryRoles.map((sr) => (
          <motion.div key={sr.role} variants={listItem}>
            <SignatureCanvas
              label={sr.label}
              required
              existingSignatureUrl={
                signatures[sr.role] ?? priorSignatures[sr.role] ?? null
              }
              onConfirm={(dataUrl) => handleSignature(sr.role, dataUrl)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Actions */}
      <div className="flex gap-3 pb-8">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => handleSubmit((d) => autosave(d))()}
          loading={saving}
          icon={<Save className="w-4 h-4" />}
        >
          Save
        </Button>
        <Button
          type="submit"
          size="md"
          loading={submitting}
          fullWidth
          iconRight={<ArrowRight className="w-4 h-4" />}
        >
          Submit & Continue
        </Button>
      </div>
    </form>
  );
}
