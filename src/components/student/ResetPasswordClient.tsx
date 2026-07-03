"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { listContainer, listItem } from "@/lib/motion";

interface FormValues {
  password: string;
  confirm: string;
}

export function ResetPasswordClient({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>();

  const password = watch("password");

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/student/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update password");
      toast.success("Password updated — welcome aboard!");
      router.replace("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm"
      >
        <motion.div variants={listItem} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-4">
            <KeyRound className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            {firstName ? `Hey ${firstName} 👋` : "Welcome 👋"}
          </h1>
          <p className="text-sm text-ink-muted mt-1.5">
            For your security, please set a new password to continue.
          </p>
        </motion.div>

        <motion.div
          variants={listItem}
          className="bg-white rounded-2xl border border-surface-border shadow-card-md p-6"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              id="password"
              type="password"
              label="New Password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              hint="Use 8+ characters with a letter and a number"
              error={errors.password?.message}
              required
              {...register("password", {
                required: "Please choose a password",
                minLength: { value: 8, message: "At least 8 characters" },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
                  message: "Include at least one letter and one number",
                },
              })}
            />

            <Input
              id="confirm"
              type="password"
              label="Confirm Password"
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              error={errors.confirm?.message}
              required
              {...register("confirm", {
                required: "Please confirm your password",
                validate: (v) => v === password || "Passwords do not match",
              })}
            />

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              className="mt-2"
              iconRight={<ArrowRight className="w-5 h-5" />}
            >
              Set password & continue
            </Button>
          </form>
        </motion.div>

        <motion.p
          variants={listItem}
          className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint mt-5"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Your password is encrypted and never shared.
        </motion.p>
      </motion.div>
    </div>
  );
}
