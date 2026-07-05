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

    // Validate type — whitelist only. SVG is deliberately excluded: it can
    // contain scripts and would be a stored-XSS vector when previewed inline.
    const ALLOWED: Record<string, string[]> = {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    };
    const extMatch = /\.[a-z0-9]+$/i.exec(file.name);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    if (!ALLOWED[file.type] || !ALLOWED[file.type].includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Only PDF, JPG, PNG or WEBP files are allowed" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload
    const { url } = await uploadFile(
      buffer,
      file.name,
      file.type,
      studentId,
      "documents"
    );

    // Create/update document record. Atomic upsert on the (studentId,
    // documentType) unique key — no findFirst/create race on double-click.
    const doc = await prisma.document.upsert({
      where: {
        studentId_documentType: { studentId, documentType: documentId },
      },
      update: {
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
      create: {
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
