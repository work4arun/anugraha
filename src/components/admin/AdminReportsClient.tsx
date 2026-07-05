"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Clock,
  CircleDashed,
  Shield,
  ChevronLeft,
  Printer,
  Building2,
  GraduationCap,
} from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listContainer, listItem, statCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ── Palette (from tailwind.config) ───────────────────────────────────────────
const C = {
  completed: "#16A34A",
  inProgress: "#D97706",
  notStarted: "#9CA3AF",
  locked: "#DC2626",
  brand: "#4E9A2F",
  track: "#E5E7EB",
};

interface BatchStat {
  batchId: string;
  batchName: string;
  course: string;
  institutionCode: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  locked: number;
  avgCompletion: number;
  completionPct: number;
}

interface ReportData {
  adminName: string;
  adminRole: string;
  generatedAt: string;
  totals: {
    students: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    locked: number;
  };
  batchStats: BatchStat[];
  institutions: { code: string; name: string; students: number; completed: number }[];
}

// ── Donut chart ──────────────────────────────────────────────────────────────
function Donut({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 70;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative w-[180px] h-[180px] shrink-0">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke={C.track} strokeWidth="20" />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circ;
          const el = (
            <motion.circle
              key={i}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${circ - len}`}
              initial={{ strokeDashoffset: -offset + circ }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1], delay: 0.2 + i * 0.12 }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-ink">{centerLabel}</span>
        <span className="text-xs text-ink-muted">{centerSub}</span>
      </div>
    </div>
  );
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
    <motion.div variants={statCountUp} custom={index} transition={{ delay: index * 0.06 }}>
      <Card padding="md" className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-ink">{value.toLocaleString()}</p>
          <p className="text-xs text-ink-muted">{label}</p>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Stacked bar for one batch ────────────────────────────────────────────────
function StackedBar({ batch }: { batch: BatchStat }) {
  const total = batch.total || 1;
  const parts = [
    { value: batch.completed, color: C.completed },
    { value: batch.inProgress, color: C.inProgress },
    { value: batch.locked, color: C.locked },
    { value: batch.notStarted, color: C.notStarted },
  ];
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-border">
      {parts.map((p, i) =>
        p.value > 0 ? (
          <motion.div
            key={i}
            style={{ backgroundColor: p.color }}
            initial={{ width: 0 }}
            animate={{ width: `${(p.value / total) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.2 }}
          />
        ) : null,
      )}
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm text-ink">{label}</span>
      <span className="text-sm font-semibold text-ink ml-auto tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

export function AdminReportsClient({ data }: { data: ReportData }) {
  const router = useRouter();
  const t = data.totals;
  const overallPct = t.students > 0 ? Math.round((t.completed / t.students) * 100) : 0;

  const kpis = [
    { label: "Total Students", value: t.students, icon: Users, color: "bg-brand-50 text-brand" },
    { label: "Completed", value: t.completed, icon: CheckCircle2, color: "bg-success-light text-success" },
    { label: "In Progress", value: t.inProgress, icon: Clock, color: "bg-warning-light text-warning" },
    { label: "Not Started", value: t.notStarted, icon: CircleDashed, color: "bg-surface-subtle text-ink-muted" },
  ];

  const segments = [
    { value: t.completed, color: C.completed },
    { value: t.inProgress, color: C.inProgress },
    { value: t.locked, color: C.locked },
    { value: t.notStarted, color: C.notStarted },
  ];

  const generated = new Date(data.generatedAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Batch Reports</p>
              <p className="text-xs text-ink-muted">{data.adminName} · {data.adminRole.replace("_", " ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/dashboard")}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Dashboard
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              icon={<Printer className="w-4 h-4" />}
            >
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-8">
          <motion.div variants={listItem} className="flex items-end justify-between">
            <h1 className="text-lg font-bold text-ink">Induction Completion Report</h1>
            <span className="text-xs text-ink-muted">Generated {generated}</span>
          </motion.div>

          {/* KPI cards */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map((k, i) => (
                <StatCard key={k.label} {...k} index={i} />
              ))}
            </div>
          </section>

          {/* Donut + legend */}
          <motion.section variants={listItem}>
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <Donut
                  segments={segments}
                  centerLabel={`${overallPct}%`}
                  centerSub="completed"
                />
                <div className="flex-1 w-full flex flex-col gap-3">
                  <LegendDot color={C.completed} label="Completed" value={t.completed} />
                  <LegendDot color={C.inProgress} label="In Progress" value={t.inProgress} />
                  {t.locked > 0 && <LegendDot color={C.locked} label="Locked" value={t.locked} />}
                  <LegendDot color={C.notStarted} label="Not Started" value={t.notStarted} />
                  <div className="h-px bg-surface-border my-1" />
                  <LegendDot color={C.brand} label="Total Students" value={t.students} />
                </div>
              </div>
            </Card>
          </motion.section>

          {/* Institution split */}
          {data.institutions.length > 0 && (
            <motion.section variants={listItem}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
                By Institution
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.institutions.map((inst) => {
                  const pct = inst.students > 0 ? Math.round((inst.completed / inst.students) * 100) : 0;
                  return (
                    <Card key={inst.code} padding="md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-accent-50 text-accent flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{inst.name}</p>
                          <p className="text-xs text-ink-muted">{inst.students.toLocaleString()} students</p>
                        </div>
                        <Badge variant="default" className="ml-auto">{pct}%</Badge>
                      </div>
                      <div className="h-2.5 bg-surface-border rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #4E9A2F, #9AD24D)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, delay: 0.2 }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* Per-batch breakdown */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
              Per-Batch Breakdown
            </h2>
            <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-3">
              {data.batchStats.length === 0 && (
                <motion.div variants={listItem} className="text-center py-12 text-ink-muted text-sm">
                  No active batches yet.
                </motion.div>
              )}
              {data.batchStats.map((b) => (
                <motion.button
                  key={b.batchId}
                  variants={listItem}
                  onClick={() => router.push(`/admin/batches/${b.batchId}`)}
                  className="text-left"
                >
                  <Card padding="md" className="hover:shadow-brand transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{b.batchName}</p>
                        <p className="text-xs text-ink-muted truncate">
                          {b.institutionCode} · {b.course}
                        </p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-sm font-bold text-ink tabular-nums">{b.completionPct}%</p>
                        <p className="text-2xs text-ink-muted">{b.completed}/{b.total} done</p>
                      </div>
                    </div>
                    <StackedBar batch={b} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-2xs text-ink-muted">
                      <span>{b.completed} completed</span>
                      <span>{b.inProgress} in progress</span>
                      {b.locked > 0 && <span>{b.locked} locked</span>}
                      <span>{b.notStarted} not started</span>
                    </div>
                  </Card>
                </motion.button>
              ))}
            </motion.div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
