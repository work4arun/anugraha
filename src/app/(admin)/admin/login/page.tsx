"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LogIn, Shield } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { listContainer, listItem } from "@/lib/motion";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type Form = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      const result = await signIn("admin-credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("password", { message: "Invalid email or password" });
        toast.error("Login failed");
        return;
      }

      router.replace("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface-muted">
      <div className="h-1 bg-gradient-to-r from-brand via-brand-light to-brand" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm"
        >
          <motion.div variants={listItem} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 mb-4">
              <Shield className="w-7 h-7 text-brand" />
            </div>
            <h1 className="text-2xl font-bold text-ink">Admin Portal</h1>
            <p className="text-sm text-ink-muted mt-1">
Rathinam Anugraha 2026 — Staff Access
            </p>
          </motion.div>

          <motion.div
            variants={listItem}
            className="bg-white rounded-2xl border border-surface-border shadow-card-md p-6"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <Input
                id="email"
                type="email"
                label="Email Address"
                placeholder="admin@rathinam.in"
                autoComplete="email"
                error={errors.email?.message}
                required
                {...register("email")}
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
              <Button type="submit" size="lg" fullWidth loading={loading} icon={<LogIn className="w-5 h-5" />}>
                Sign In
              </Button>
            </form>
          </motion.div>

          <motion.div variants={listItem} className="text-center mt-4">
            <a href="/login" className="text-xs text-ink-faint hover:text-brand transition-colors">
              ← Student Login
            </a>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
