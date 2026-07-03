import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    redirect("/login");
  }
  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10">{children}</div>
    </>
  );
}
