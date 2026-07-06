/**
 * GET /api/student/agreements
 * Lists the active agreements for the signed-in student's batch, along with the
 * student's signing status and the completed PDF url (when signed).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentAgreementsDetailed } from "@/lib/agreement";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const studentId = session.user.id;
  const batchId = session.user.batchId;
  if (!batchId) {
    return NextResponse.json({ success: true, data: [] });
  }

  const data = await getStudentAgreementsDetailed(studentId, batchId);
  return NextResponse.json({ success: true, data });
}
