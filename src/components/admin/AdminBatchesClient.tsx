"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { ArrowLeft, Plus, Users, FileText, GraduationCap, ChevronRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  name: string;
  course: string;
  academicYear: string;
  isActive: boolean;
  institutionCode: string;
  studentCount: number;
  formCount: number;
}

export function AdminBatchesClient({
  batches,
  institutions,
}: {
  batches: Batch[];
  institutions: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink flex-1">Batch Management</h1>
          <Button
            size="sm"
            onClick={() => router.push("/admin/batches/new")}
            icon={<Plus className="w-4 h-4" />}
          >
            New Batch
          </Button>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="min-h-[44px] px-2 text-ink-muted hover:text-ink transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-4 md:grid-cols-2"
        >
          {batches.length === 0 && (
            <motion.div variants={listItem} className="col-span-2 text-center py-20 text-ink-muted">
              No batches yet. Create your first batch.
            </motion.div>
          )}

          {batches.map((batch) => (
            <motion.div
              key={batch.id}
              variants={listItem}
              onClick={() => router.push(`/admin/batches/${batch.id}`)}
              className={cn(
                "bg-white rounded-2xl border-2 border-surface-border",
                "hover:border-brand/30 hover:shadow-card",
                "p-5 cursor-pointer transition-all"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={batch.isActive ? "success" : "muted"} dot>
                      {batch.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="default">{batch.institutionCode}</Badge>
                  </div>
                  <h3 className="font-semibold text-ink">{batch.name}</h3>
                  <p className="text-sm text-ink-muted">{batch.course} · {batch.academicYear}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-ink-faint shrink-0 mt-1" />
              </div>

              <div className="flex gap-4 text-xs text-ink-muted">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {batch.studentCount} students
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {batch.formCount} forms
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
