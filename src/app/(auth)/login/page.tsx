"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LogIn, GraduationCap, Shield } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";
import { listContainer, listItem } from "@/lib/motion";

// ── Schema ─────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1, "Registration number is required").toUpperCase(),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Component ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const result = await signIn("student-credentials", {
        username: data.username,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("password", {
          message: "Invalid registration number or password",
        });
        toast.error("Login failed — please check your credentials");
        return;
      }

      toast.success("Welcome! Loading your induction…");
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col relative">
      <AnimatedBackground />
      {/* ── Header band (green only — no colour mixing) ── */}
      <div className="h-1 bg-gradient-to-r from-brand via-brand-light to-brand relative z-10" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 relative z-10">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          {/* Logo / branding */}
          <motion.div variants={listItem} className="text-center mb-8">
            {/* Replace this placeholder with the actual Rathinam logo SVG/image */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-4">
              <GraduationCap className="w-8 h-8 text-brand" />
            </div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Rathinam <span className="text-brand">Anugraha 2026</span>
            </h1>
            <p className="text-sm text-ink-muted mt-2">
              Welcome! Sign in to start your Day One 🌱
            </p>
          </motion.div>

          {/* Login card */}
          <motion.div
            variants={listItem}
            className="bg-white rounded-2xl border border-surface-border shadow-card-md p-6"
          >
            <h2 className="text-lg font-semibold text-ink mb-1">Sign in</h2>
            <p className="text-sm text-ink-muted mb-6">
              Use the credentials issued to you by your institution
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <Input
                id="username"
                label="Registration Number"
                placeholder="e.g. 24CS001"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                error={errors.username?.message}
                required
                {...register("username")}
              />

              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="Enter your password"
                autoComplete="current-password"
                error={errors.password?.message}
                required
                {...register("password")}
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                className="mt-2"
                icon={<LogIn className="w-5 h-5" />}
              >
                Sign in
              </Button>
            </form>
          </motion.div>

          {/* Helper text */}
          <motion.p
            variants={listItem}
            className="text-center text-xs text-ink-muted mt-5 leading-relaxed px-4"
          >
            Your login credentials were issued by the Admissions Office.
            If you need help, contact your institution&apos;s helpdesk.
          </motion.p>

          {/* Admin link */}
          <motion.div variants={listItem} className="text-center mt-4">
            <a
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-brand transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin / Staff Login
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} Rathinam Group of Institutions
      </footer>
    </div>
  );
}
