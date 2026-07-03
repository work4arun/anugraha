import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      regNo: true,
      email: true,
      mobile: true,
      photoUrl: true,
      status: true,
      completionPct: true,
      pdfUrl: true,
    },
  });

  if (!student) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: student });
}
