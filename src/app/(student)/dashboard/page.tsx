import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getStudentProfile } from "@/lib/student";
import { DashboardClient } from "@/components/student/DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Induction" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    redirect("/login");
  }

  const profile = await getStudentProfile(session.user.id);
  if (!profile) {
    redirect("/login");
  }

  // Redirect to password reset if required
  if (profile.mustResetPassword) {
    redirect("/reset-password");
  }

  return <DashboardClient profile={profile} />;
}
