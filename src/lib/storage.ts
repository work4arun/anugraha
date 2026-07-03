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
  category: "documents" | "signatures" | "photos" | "pdfs" | "logos"
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
