import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes without conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Format date to dd MMM yyyy */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format date to ISO string without time */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as ISO date string */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Generate a slug from a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Mask Aadhaar number — show only last 4 digits */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return "****";
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
}

/**
 * Generate a random password using a CSPRNG (Web Crypto — available in
 * Node 18.17+ and browsers). Math.random() is predictable and must not be
 * used for credentials. Uses rejection sampling to avoid modulo bias.
 */
export function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const maxValid = Math.floor(256 / chars.length) * chars.length; // reject biased tail
  let password = "";
  const buf = new Uint8Array(length * 2);
  while (password.length < length) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte < maxValid) {
        password += chars.charAt(byte % chars.length);
        if (password.length === length) break;
      }
    }
  }
  return password;
}

/** Calculate completion percentage from a list of step statuses */
export function calcCompletionPct(
  steps: Array<{ required: boolean; submitted: boolean }>
): number {
  const required = steps.filter((s) => s.required);
  if (required.length === 0) return 100;
  const done = required.filter((s) => s.submitted).length;
  return Math.round((done / required.length) * 100);
}

/** PDF filename convention */
export function pdfFilename(regNo: string, name: string): string {
  const cleanName = name.replace(/[^a-z0-9]/gi, "_").slice(0, 30);
  return `${regNo}_${cleanName}_Anugraha2026.pdf`;
}

/**
 * Normalize a Prisma `Json` value that may have been accidentally double-encoded
 * (i.e. stored as a JSON *string* via JSON.stringify() before insert).
 * Returns a real JS value (object/array), falling back to `fallback` on failure.
 *
 * This makes the app resilient to older seed data where `signatoryRoles` was
 * stored as a string instead of an array.
 */
export function normalizeJson<T = unknown>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** IP address from request headers (for audit logs) */
export function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
