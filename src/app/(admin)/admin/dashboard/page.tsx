import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "admin") {
    redirect("/admin/login");
  }

  // Load batch stats
  const batches = await prisma.batch.findMany({
    where: { isActive: true },
    include: {
      institution: { select: { code: true, name: true } },
      students: {
        select: { status: true, completionPct: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const batchStats = batches.map((b) => {
    const total = b.students.length;
    const completed = b.students.filter((s) => s.status === "COMPLETED").length;
    const inProgress = b.students.filter((s) => s.status === "IN_PROGRESS").length;
    const notStarted = b.students.filter((s) => s.status === "NOT_STARTED").length;
    return {
      batchId: b.id,
      batchName: b.name,
      course: b.course,
      institutionCode: b.institution.code,
      total,
      notStarted,
      inProgress,
      completed,
      completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Overall totals
  const totalStudents = await prisma.student.count();
  const completedStudents = await prisma.student.count({ where: { status: "COMPLETED" } });
  const inProgressStudents = await prisma.student.count({ where: { status: "IN_PROGRESS" } });

  const adminData = {
    adminName: session.user.name ?? "Admin",
    adminRole: session.user.role ?? "STAFF",
    batchStats,
    totals: {
      students: totalStudents,
      completed: completedStudents,
      inProgress: inProgressStudents,
      notStarted: totalStudents - completedStudents - inProgressStudents,
    },
  };

  return <AdminDashboardClient data={adminData} />;
}
