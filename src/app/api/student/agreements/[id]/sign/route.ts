/**
 * POST /api/student/agreements/[id]/sign
 *
 * Stamps the student's (and parent's) captured signatures onto the agreement
 * PDF at the admin-placed fields, saves the completed PDF, and records it.
 *
 * The student must already have signatures on file (captured with the existing
 * signature flow). Roles are taken from the agreement's placed fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stampAgreement, collectStudentSignatures } from "@/lib/agreement";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const studentId = session.user.id;

  try {
    const agreement = await prisma.agreementTemplate.findUnique({
      where: { id: params.id },
      include: { fields: true },
    });
    if (!agreement) {
      return NextResponse.json({ success: false, error: "Agreement not found" }, { status: 404 });
    }
    // The agreement must belong to the student's own batch.
    if (agreement.batchId !== session.user.batchId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const roles = Array.from(new Set(agreement.fields.map((f) => f.signerRole)));
    if (roles.length === 0) {
      return NextResponse.json(
        { success: false, error: "This agreement has no signature fields yet" },
        { status: 409 }
      );
    }

    const signers = await collectStudentSignatures(studentId, roles);
    if (signers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_SIGNATURE",
          error: "Please add your signature first, then sign the agreement.",
        },
        { status: 409 }
      );
    }

    const { url, stamped } = await stampAgreement(studentId, agreement.id, signers);
    const signedRoles = new Set(signers.map((s) => s.role));
    const allSigned = roles.every((r) => signedRoles.has(r));

    const record = await prisma.signedAgreement.upsert({
      where: {
        studentId_agreementTemplateId: {
          studentId,
          agreementTemplateId: agreement.id,
        },
      },
      update: {
        signedPdfUrl: url,
        status: allSigned ? "COMPLETED" : "PARTIAL",
        signedAt: new Date(),
      },
      create: {
        studentId,
        agreementTemplateId: agreement.id,
        signedPdfUrl: url,
        status: allSigned ? "COMPLETED" : "PARTIAL",
        signedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        studentId,
        actorType: "student",
        action: "AGREEMENT_SIGNED",
        entityType: "SignedAgreement",
        entityId: record.id,
        metadata: { agreementTemplateId: agreement.id, stamped, status: record.status },
      },
    });

    return NextResponse.json({
      success: true,
      data: { url, status: record.status, stamped },
    });
  } catch (error) {
    console.error("[agreement sign]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
