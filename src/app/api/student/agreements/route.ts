/**
 * GET /api/student/agreements
 * Lists the active agreements for the signed-in student's batch, along with the
 * student's signing status and the completed PDF url (when signed).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const agreements = await prisma.agreementTemplate.findMany({
    where: { batchId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      fields: {
        select: {
          id: true,
          signerRole: true,
          fieldType: true,
          label: true,
          required: true,
          page: true,
        },
        orderBy: { order: "asc" },
      },
      signedAgreements: { where: { studentId } },
    },
  });

  return NextResponse.json({
    success: true,
    data: agreements.map((a) => {
      const signed = a.signedAgreements[0];
      return {
        id: a.id,
        name: a.name,
        pageCount: a.pageCount,
        originalPdfUrl: a.originalPdfUrl,
        roles: Array.from(
          new Set(a.fields.filter((f) => f.fieldType === "SIGNATURE").map((f) => f.signerRole))
        ),
        // CHECKBOX/TEXT need input from the student at signing time (send
        // them back as `values` keyed by field id); DATE is auto-filled.
        inputFields: a.fields
          .filter((f) => f.fieldType === "CHECKBOX" || f.fieldType === "TEXT")
          .map((f) => ({
            id: f.id,
            fieldType: f.fieldType,
            label: f.label,
            required: f.required,
            page: f.page,
          })),
        status: signed?.status ?? "PENDING",
        signedPdfUrl: signed?.signedPdfUrl ?? null,
        signedAt: signed?.signedAt ?? null,
      };
    }),
  });
}
