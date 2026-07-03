import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateStudentPdf } from "@/lib/pdf";

// POST /api/pdf — generate the consolidated PDF for the authenticated student
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Students can only generate their own PDF; admins can generate any
  let studentId: string;
  if (session.user.userType === "student") {
    studentId = session.user.id;
  } else if (session.user.userType === "admin") {
    const body = await req.json().catch(() => ({}));
    studentId = body.studentId;
    if (!studentId) {
      return NextResponse.json({ success: false, error: "studentId required" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateStudentPdf(studentId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[pdf POST]", error);
    return NextResponse.json(
      { success: false, error: "PDF generation failed" },
      { status: 500 }
    );
  }
}
