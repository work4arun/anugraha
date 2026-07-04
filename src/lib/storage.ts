/**
 * Storage abstraction layer.
 *
 * STORAGE_PROVIDER=local  → saves to LOCAL_UPLOAD_DIR (default: ./uploads)
 * STORAGE_PROVIDER=s3     → uploads to S3-compatible (MinIO / AWS / Cloudflare R2)
 *
 * All public methods work identically regardless of provider.
 * Swap STORAGE_PROVIDER in .env to migrate to S3 without touching call sites.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

type UploadResult = {
  url: string;      // Public/accessible URL
  key: string;      // Storage key (path on disk or S3 object key)
  size: number;
  mimeType: string;
};

// ── Local provider ─────────────────────────────────────────────────────────

async function localUpload(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const fullPath = path.join(uploadDir, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    url: `/api/uploads/${key}`,
    key,
    size: buffer.length,
    mimeType,
  };
}

async function localDelete(key: string): Promise<void> {
  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const fullPath = path.join(uploadDir, key);
  try {
    await fs.unlink(fullPath);
  } catch {
    // ignore not-found
  }
}

// ── S3 provider ────────────────────────────────────────────────────────────

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: !!process.env.S3_ENDPOINT, // required for MinIO
    });
  }
  return s3Client;
}

async function s3Upload(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  const bucket = process.env.S3_BUCKET ?? "mydayone";
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const baseUrl = process.env.S3_PUBLIC_URL ?? `https://${bucket}.s3.amazonaws.com`;
  return {
    url: `${baseUrl}/${key}`,
    key,
    size: buffer.length,
    mimeType,
  };
}

async function s3Delete(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET ?? "mydayone";
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ── Public API ─────────────────────────────────────────────────────────────

function buildKey(studentId: string, category: string, filename: string): string {
  const ext = path.extname(filename);
  const hash = crypto.randomBytes(6).toString("hex");
  const sanitized = path
    .basename(filename, ext)
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 40);
  return `${studentId}/${category}/${sanitized}_${hash}${ext}`;
}

export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  studentId: string,
  category: "documents" | "signatures" | "photos" | "pdfs" | "logos" | "agreements"
): Promise<UploadResult> {
  const key = buildKey(studentId, category, originalFilename);
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "s3") {
    return s3Upload(buffer, key, mimeType);
  }
  return localUpload(buffer, key, mimeType);
}

export async function deleteFile(key: string): Promise<void> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "s3") {
    return s3Delete(key);
  }
  return localDelete(key);
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ── Read-back helpers ───────────────────────────────────────────────────────

// Map a stored `url` back to its storage key. Local URLs look like
// `/api/uploads/<key>`; S3 URLs look like `<baseUrl>/<key>`.
function keyFromUrl(url: string): string {
  if (url.startsWith("/api/uploads/")) {
    return url.slice("/api/uploads/".length);
  }

  // S3-style: strip the origin + leading slash, best-effort.
  let key: string;
  try {
    const u = new URL(url);
    key = u.pathname.replace(/^\/+/, "");
  } catch {
    key = url.replace(/^\/+/, "");
  }

  // Path-style S3 endpoints (e.g. MinIO: http://host/<bucket>/<key>) include
  // the bucket name in the path. The object key must NOT contain it, so strip
  // a leading "<bucket>/" segment when present.
  if ((process.env.STORAGE_PROVIDER ?? "local") === "s3") {
    const bucket = process.env.S3_BUCKET ?? "mydayone";
    if (key === bucket) key = "";
    else if (key.startsWith(bucket + "/")) key = key.slice(bucket.length + 1);
  }

  return key;
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export function mimeFromKey(key: string): string {
  return MIME_BY_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

// Read a stored object's raw bytes given its public url or key.
export async function readFileBuffer(urlOrKey: string): Promise<Buffer> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  const key = keyFromUrl(urlOrKey);

  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET ?? "mydayone";
    const client = getS3Client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  return fs.readFile(path.join(uploadDir, key));
}

/**
 * Resolve a stored image url/key into a self-contained base64 data URI.
 *
 * PDF generation renders HTML through Puppeteer's `setContent`, which has no
 * page origin — so relative urls like `/api/uploads/...` can never load and
 * would stall `networkidle0` until timeout. Embedding images as data URIs makes
 * the document self-contained and the render instant.
 *
 * Returns null when the source can't be read, so callers can omit the image
 * rather than fail the whole PDF.
 */
export async function resolveToDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const key = keyFromUrl(url);
    const buffer = await readFileBuffer(url);
    const mime = mimeFromKey(key);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (err) {
    // Surface the reason (missing file, wrong S3 key, path drift) instead of
    // silently rendering a blank image in the PDF.
    const provider = process.env.STORAGE_PROVIDER ?? "local";
    const where =
      provider === "s3"
        ? `bucket "${process.env.S3_BUCKET ?? "mydayone"}" key "${keyFromUrl(url)}"`
        : `${process.env.LOCAL_UPLOAD_DIR ?? "./uploads"}/${keyFromUrl(url)}`;
    console.warn(
      `[resolveToDataUri] provider=${provider} could not read "${url}" (${where}):`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
