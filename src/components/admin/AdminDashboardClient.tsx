"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  Users,
  CheckCircle2,
  Clock,
  CircleDashed,
  Shield,
  LogOut,
  ChevronRight,
  BarChart3,
  Settings,
  GraduationCap,
  Upload,
  ShieldCheck,
} from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listContainer, listItem, statCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface BatchStat {
  batchId: string;
  batchName: string;
  course: string;
  institutionCode: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  completionPct: number;
}

interface AdminData {
  adminName: string;
  adminRole: string;
  batchStats: BatchStat[];
  totals: {
    students: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  index,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      variants={statCountUp}
      custom={index}
      transition={{ delay: index * 0.08 }}
    >
      <Card padding="md" className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <motion.p
            key={value}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.08, duration: 0.4 }}
            className="text-2xl font-bold text-ink"
          >
            {value.toLocaleString()}
          </motion.p>
          <p className="text-xs text-ink-muted">{label}</p>
        </div>
      </Card>
    </motion.div>
  );
}

export function AdminDashboardClient({ data }: { data: AdminData }) {
  const router = useRouter();
  const isSuperAdmin = data.adminRole === "SUPER_ADMIN";

  const stats = [
    { label: "Total Students",  value: data.totals.students,   icon: Users,         color: "bg-brand-50 text-brand" },
    { label: "Completed",       value: data.totals.completed,  icon: CheckCircle2,  color: "bg-success-light text-success" },
    { label: "In Progress",     value: data.totals.inProgress, icon: Clock,         color: "bg-warning-light text-warning" },
    { label: "Not Started",     value: data.totals.notStarted, icon: CircleDashed,  color: "bg-surface-subtle text-ink-muted" },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Anugraha 2026 Admin</p>
              <p className="text-xs text-ink-muted">{data.adminName} · {data.adminRole.replace("_", " ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/batches")}
              icon={<GraduationCap className="w-4 h-4" />}
            >
              Batches
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/templates")}
              icon={<Settings className="w-4 h-4" />}
            >
              Templates
            </Button>
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/admins")}
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Admins
              </Button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors min-h-[44px] px-2"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-8"
        >
          {/* Stat cards */}
          <section>
            <motion.h2 variants={listItem} className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
              Live Overview
            </motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s, i) => (
                <StatCard key={s.label} {...s} index={i} />
              ))}
            </div>
          </section>

          {/* Overall progress */}
          <motion.section variants={listItem}>
            <Card padding="md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Overall Completion</CardTitle>
                  <Badge variant="default">
                    {data.totals.students > 0
                      ? Math.round((data.totals.completed / data.totals.students) * 100)
                      : 0}%
                  </Badge>
                </div>
              </CardHeader>
              <div className="h-3 bg-surface-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #9AD24D, #D2ECA3)" }}
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${data.totals.students > 0
                      ? (data.totals.completed / data.totals.students) * 100
                      : 0}%`
                  }}
                  transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1.0], delay: 0.3 }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-ink-muted">
                <span>{data.totals.completed} completed</span>
                <span>{data.totals.students} total</span>
              </div>
            </Card>
          </motion.section>

          {/* Per-batch breakdown */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <motion.h2 variants={listItem} className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Batch Breakdown
              </motion.h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/batches")}
                iconRight={<ChevronRight className="w-4 h-4" />}
              >
                Manage
              </Button>
            </div>

            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              {data.batchStats.length === 0 && (
                <motion.div variants={listItem} className="text-center py-12 text-ink-muted text-sm">
                  No active batches yet. Create one in Batch Management.
                </motion.div>
              )}

              {data.batchStats.map((batch) => (
                <motion.div
                  key={batch.batchId}
                  variants={listItem}
                  onClick={() => router.push(`/admin/batches/${batch.batchId}`)}
                  className="bg-white rounded-2xl border-2 border-surface-border hover:border-brand/30 hover:shadow-card p-5 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="default">{batch.institutionCode}</Badge>
                      </div>
                      <h3 className="font-semibold text-ink">{batch.batchName}</h3>
                      <p className="text-sm text-ink-muted">{batch.course}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <motion.p
                        key={batch.completionPct}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-bold text-brand"
                      >
                        {batch.completionPct}%
                      </motion.p>
                      <p className="text-xs text-ink-muted">complete</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-surface-border rounded-full overflow-hidden mb-3">
                    <motion.div
                      className="h-full bg-brand rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${batch.completionPct}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1.0] }}
                    />
                  </div>

                  {/* Breakdown row */}
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {batch.completed} done
                    </span>
                    <span className="flex items-center gap-1 text-warning">
                      <Clock className="w-3.5 h-3.5" />
                      {batch.inProgress} in progress
                    </span>
                    <span className="flex items-center gap-1 text-ink-faint">
                      <CircleDashed className="w-3.5 h-3.5" />
                      {batch.notStarted} not started
                    </span>
                    <span className="flex items-center gap-1 text-ink-muted ml-auto">
                      <Users className="w-3.5 h-3.5" />
                      {batch.total} total
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* Quick actions */}
          <motion.section variants={listItem}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => router.push("/admin/batches")}
                icon={<GraduationCap className="w-5 h-5" />}
              >
                Manage Batches
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => router.push("/admin/templates")}
                icon={<Settings className="w-5 h-5" />}
              >
                Form Templates
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => router.push("/admin/students/import")}
                icon={<Upload className="w-5 h-5" />}
              >
                Import Students
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => router.push("/admin/batches")}
                icon={<BarChart3 className="w-5 h-5" />}
              >
                Batch Reports
              </Button>
              {isSuperAdmin && (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => router.push("/admin/admins")}
                  icon={<ShieldCheck className="w-5 h-5" />}
                >
                  Manage Admins
                </Button>
              )}
            </div>
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
