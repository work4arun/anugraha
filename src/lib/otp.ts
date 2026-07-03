/**
 * OTP helpers for signature authentication.
 * The plain OTP is only ever sent over SMS — we store and compare a SHA-256 hash.
 */

import crypto from "crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

/** Cryptographically-strong numeric OTP, left-padded to OTP_LENGTH. */
export function generateOtp(length = OTP_LENGTH): string {
  const n = crypto.randomInt(0, 10 ** length);
  return n.toString().padStart(length, "0");
}

/** SHA-256 hash of an OTP, salted with a server secret. */
export function hashOtp(code: string): string {
  const secret =
    process.env.OTP_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-otp-secret";
  return crypto.createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

/** Keep only the last 10 digits (Indian mobile) for comparison. */
export function normalizeMobile(mobile: string): string {
  return (mobile ?? "").replace(/\D/g, "").slice(-10);
}

/** Mask a mobile for display, e.g. "••••••3210". */
export function maskMobile(mobile: string): string {
  const digits = normalizeMobile(mobile);
  if (digits.length < 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}
