import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminReportsClient } from "@/components/admin/AdminReportsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Batch Reports" };

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    redirect("/admin/login");
  }

  const batches = await prisma.batch.findMany({
    where: { isActive: true },
    include: {
      institution: { select: { code: true, name: true } },
      students: { select: { status: true, completionPct: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const batchStats = batches.map((b) => {
    const total = b.students.length;
    const completed = b.students.filter((s) => s.status === "COMPLETED").length;
    const inProgress = b.students.filter((s) => s.status === "IN_PROGRESS").length;
    const locked = b.students.filter((s) => s.status === "LOCKED").length;
    const notStarted = total - completed - inProgress - locked;
    const avgCompletion =
      total > 0
        ? Math.round(b.students.reduce((sum, s) => sum + (s.completionPct ?? 0), 0) / total)
        : 0;
    return {
      batchId: b.id,
      batchName: b.name,
      course: b.course,
      institutionCode: b.institution.code,
      total,
      notStarted,
      inProgress,
      completed,
      locked,
      avgCompletion,
      completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Institution split (e.g. RTC vs RGU)
  const institutionMap = new Map<
    string,
    { code: string; name: string; students: number; completed: number }
  >();
  for (const b of batches) {
    const key = b.institution.code;
    const entry =
      institutionMap.get(key) ??
      { code: b.institution.code, name: b.institution.name, students: 0, completed: 0 };
    entry.students += b.students.length;
    entry.completed += b.students.filter((s) => s.status === "COMPLETED").length;
    institutionMap.set(key, entry);
  }

  const totals = batchStats.reduce(
    (acc, b) => ({
      students: acc.students + b.total,
      completed: acc.completed + b.completed,
      inProgress: acc.inProgress + b.inProgress,
      notStarted: acc.notStarted + b.notStarted,
      locked: acc.locked + b.locked,
    }),
    { students: 0, completed: 0, inProgress: 0, notStarted: 0, locked: 0 },
  );

  return (
    <AdminReportsClient
      data={{
        adminName: session.user.name ?? "Admin",
        adminRole: session.user.role ?? "STAFF",
        generatedAt: new Date().toISOString(),
        totals,
        batchStats,
        institutions: Array.from(institutionMap.values()),
      }}
    />
  );
}
