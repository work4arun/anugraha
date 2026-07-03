import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ResetPasswordClient } from "@/components/student/ResetPasswordClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set your password" };

export default async function ResetPasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    redirect("/login");
  }

  const firstName = (session.user.name ?? "").split(" ")[0];
  return <ResetPasswordClient firstName={firstName} />;
}
