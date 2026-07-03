"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Institution {
  id: string;
  code: string;
  fullName: string;
}
interface Template {
  id: string;
  name: string;
  type: string;
}

export function AdminBatchNewClient({
  institutions,
  templates,
}: {
  institutions: Institution[];
  templates: Template[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Ordered list of selected template ids
  const [selected, setSelected] = useState<string[]>(templates.map((t) => t.id));

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!institutionId || !name.trim() || !course.trim() || !academicYear.trim()) {
      toast.error("Fill in institution, name, course and academic year");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          name: name.trim(),
          course: course.trim(),
          department: department.trim() || undefined,
          academicYear: academicYear.trim(),
          isActive,
          templateIds: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Batch created");
      router.push(`/admin/batches/${data.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create batch");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted pb-28">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/batches")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink">New Batch</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
          <motion.div variants={listItem}>
            <Card padding="md" className="flex flex-col gap-4">
              <CardHeader><CardTitle>Batch details</CardTitle></CardHeader>

              <div>
                <label className="text-sm font-medium text-ink mb-1.5 block">Institution</label>
                <select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-border text-sm bg-white"
                >
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>{i.code} — {i.fullName}</option>
                  ))}
                </select>
              </div>

              <Input id="b-name" label="Batch name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RTC B.E./B.Tech 2026–27" required />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input id="b-course" label="Course" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. B.E. / B.Tech" required />
                <Input id="b-year" label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="e.g. 2026-27" required />
              </div>
              <Input id="b-dept" label="Department (optional)" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Computer Science" />

              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active (students in this batch can log in and start)
              </label>
            </Card>
          </motion.div>

          <motion.div variants={listItem}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink">Induction steps</h2>
              <span className="text-xs text-ink-muted">{selected.length} selected</span>
            </div>
            {templates.length === 0 ? (
              <Card padding="md">
                <p className="text-sm text-ink-muted">
                  No form templates yet. You can create the batch now and add steps later from the batch page,
                  or build forms under Templates first.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map((t) => {
                  const idx = selected.indexOf(t.id);
                  const on = idx !== -1;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors",
                        on ? "border-brand bg-brand-50" : "border-surface-border bg-white hover:border-brand/30"
                      )}
                    >
                      <GripVertical className="w-4 h-4 text-ink-faint shrink-0" />
                      <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0", on ? "bg-brand text-brand-900" : "bg-surface-subtle text-ink-muted")}>
                        {on ? idx + 1 : "–"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-ink block truncate">{t.name}</span>
                        <span className="text-xs text-ink-muted">{t.type.replace(/_/g, " ")}</span>
                      </span>
                      {on && <Check className="w-4 h-4 text-brand shrink-0" />}
                    </button>
                  );
                })}
                <p className="text-xs text-ink-muted mt-1">
                  Steps are numbered in the order you select them. You can reorder or change these later on the batch page.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </main>

      <div className="bottom-action-bar">
        <Button size="lg" fullWidth loading={saving} onClick={handleCreate} icon={<Check className="w-5 h-5" />}>
          Create batch
        </Button>
      </div>
    </div>
  );
}
