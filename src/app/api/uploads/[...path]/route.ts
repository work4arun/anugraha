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

  // A student may read: their own files ({studentId}/...), any college logo
  // ({batchId}/logos/...), and the original agreement PDF for their own batch
  // ({batchId}/agreements/...). Other students' files — including signed
  // agreements stored under another studentId — stay private. Admins see all.
  if (session.user.userType === "student") {
    const requestedOwnerId = params.path[0];
    const category = params.path[1];
    const allowed =
      category === "logos" ||
      requestedOwnerId === session.user.id ||
      (category === "agreements" && requestedOwnerId === session.user.batchId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const filePath = path.join(uploadDir, ...params.path);

  // Prevent path traversal. Note: a plain startsWith() would also match
  // sibling directories (e.g. "/srv/uploads-x" matches "/srv/uploads"), so
  // compare via path.relative instead.
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(filePath);
  const rel = path.relative(resolvedUploadDir, resolvedFilePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.promises.readFile(resolvedFilePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  // SVG can carry scripts — never render it inline in our origin.
  // CSP sandbox + attachment disposition neutralises stored-XSS via uploads.
  const isSvg = ext === ".svg";

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Preview PDFs/images in the browser tab instead of forcing a download
      // (except SVG, which is downloaded rather than executed).
      "Content-Disposition": `${isSvg ? "attachment" : "inline"}; filename="${path.basename(resolvedFilePath)}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
