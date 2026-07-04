import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves files saved by the local storage provider (STORAGE_PROVIDER=local),
// which returns URLs shaped like `/api/uploads/<id>/<category>/<file>`.
// When STORAGE_PROVIDER=s3, files are served directly by the bucket and this
// route is never hit.

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Key layout: <ownerId>/<category>/<filename>. A student may read: their own
  // files (ownerId === their id), any batch logo, and the original agreement
  // PDF for their own batch (ownerId === their batchId). Other students' files
  // (including signed agreements under another studentId) stay private. Admins
  // may access anything.
  const [ownerId, category] = params.key;
  if (session.user.userType === "student") {
    const allowed =
      category === "logos" ||
      ownerId === session.user.id ||
      (category === "agreements" && ownerId === session.user.batchId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const baseDir = path.resolve(uploadDir);
  const requested = path.resolve(baseDir, params.key.join("/"));

  // Guard against path traversal — the resolved path must stay inside baseDir.
  if (requested !== baseDir && !requested.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let file: Buffer;
  try {
    file = await fs.readFile(requested);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(requested).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // `inline` lets PDFs and images preview in the browser tab instead of
      // forcing a download.
      "Content-Disposition": `inline; filename="${path.basename(requested)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
