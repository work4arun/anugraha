/**
 * Local file serving route.
 * Serves files from the LOCAL_UPLOAD_DIR when STORAGE_PROVIDER=local.
 * Restricted to authenticated users (student sees their own files; admin sees all).
 * In production with S3, replace upload URLs with direct S3/CDN URLs instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs";
import path from "path";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Students can only access their own files (path starts with their studentId).
  // Exception: college logos ({batchId}/logos/...) are non-sensitive branding
  // and viewable by any authenticated user.
  if (session.user.userType === "student") {
    const requestedOwnerId = params.path[0];
    const category = params.path[1];
    if (category !== "logos" && requestedOwnerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const filePath = path.join(uploadDir, ...params.path);

  // Prevent path traversal
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(filePath);
  if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(resolvedFilePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(resolvedFilePath);
  const ext = path.extname(resolvedFilePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
