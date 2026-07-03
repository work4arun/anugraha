import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";

// POST /api/student/document — upload a document file
// Body: FormData with fields: file (File), documentId (string)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== "student") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const studentId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentId = formData.get("documentId") as string | null;

    if (!file || !documentId) {
      return NextResponse.json(
        { success: false, error: "file and documentId are required" },
        { status: 400 }
      );
    }

    // Validate size (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large (max 10 MB)" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload
    const { url, key } = await uploadFile(
      buffer,
      file.name,
      file.type,
      studentId,
      "documents"
    );

    // Create/update document record
    const existing = await prisma.document.findFirst({
      where: { studentId, documentType: documentId },
    });

    const doc = existing
      ? await prisma.document.update({
          where: { id: existing.id },
          data: {
            fileUrl: url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            uploadStatus: "UPLOADED",
            reviewStatus: "PENDING",
            reviewedBy: null,
            reviewNote: null,
            reviewedAt: null,
            updatedAt: new Date(),
          },
        })
      : await prisma.document.create({
          data: {
            studentId,
            documentType: documentId,
            label: documentId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            fileUrl: url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            uploadStatus: "UPLOADED",
          },
        });

    return NextResponse.json({ success: true, data: { url, id: doc.id } });
  } catch (error) {
    console.error("[document POST]", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}

// Serve local uploads at /api/uploads/[...path]
// (For S3 provider, remove this and use signed URLs)
// Add a separate route at /api/uploads/[...path]/route.ts if using local storage
