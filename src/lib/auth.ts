import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit, clearRateLimit } from "./rateLimit";

/** How often (ms) to re-check an admin's isActive flag against the DB. */
const ADMIN_REVALIDATE_MS = 5 * 60 * 1000;

/** Login throttling: 5 attempts / account and 30 / IP per 15 minutes. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_ACCOUNT = 5;
const MAX_ATTEMPTS_PER_IP = 30;

type AuthorizeReq = { headers?: Record<string, unknown> };

function loginIp(req: AuthorizeReq | undefined): string {
  const fwd = req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return "unknown";
}

/**
 * Throttle a login attempt. Throws (surfaced on the login page) when either
 * the per-account or the per-IP budget is exhausted. Returns the account key
 * so the caller can clear it after a successful login.
 */
function throttleLogin(kind: "student" | "admin", identifier: string, req: AuthorizeReq | undefined): string {
  const accountKey = `login:${kind}:${identifier}`;
  const ipCheck = rateLimit(`login-ip:${loginIp(req)}`, {
    max: MAX_ATTEMPTS_PER_IP,
    windowMs: LOGIN_WINDOW_MS,
  });
  const acctCheck = rateLimit(accountKey, {
    max: MAX_ATTEMPTS_PER_ACCOUNT,
    windowMs: LOGIN_WINDOW_MS,
  });
  if (!ipCheck.ok || !acctCheck.ok) {
    const wait = Math.max(ipCheck.retryAfterSec, acctCheck.retryAfterSec);
    throw new Error(`Too many login attempts. Please try again in ${Math.ceil(wait / 60)} minute(s).`);
  }
  return accountKey;
}

// Extend NextAuth types to include role and userType
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      userType: "student" | "admin";
      batchId?: string;
      regNo?: string;
    };
  }
  interface User {
    id: string;
    role?: string;
    userType: "student" | "admin";
    batchId?: string;
    regNo?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    userType: "student" | "admin";
    batchId?: string;
    regNo?: string;
    /** Set when a deactivated/deleted admin's token is invalidated mid-session. */
    revoked?: boolean;
    /** Last time (epoch ms) the admin's isActive flag was re-checked. */
    adminCheckedAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Student credentials ──────────────────────────────────────────────
    CredentialsProvider({
      id: "student-credentials",
      name: "Student Login",
      credentials: {
        username: { label: "Registration Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = credentials.username.trim().toUpperCase();
        const accountKey = throttleLogin("student", username, req as AuthorizeReq);

        const student = await prisma.student.findUnique({
          where: { username },
          include: { batch: { include: { institution: true } } },
        });

        if (!student) return null;

        const valid = await bcrypt.compare(credentials.password, student.passwordHash);
        if (!valid) return null;

        clearRateLimit(accountKey);

        // Update last login
        await prisma.student.update({
          where: { id: student.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: student.id,
          name: student.name,
          email: student.email ?? undefined,
          image: student.photoUrl ?? undefined,
          userType: "student",
          batchId: student.batchId,
          regNo: student.regNo,
        } satisfies User;
      },
    }),

    // ── Admin credentials ────────────────────────────────────────────────
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const accountKey = throttleLogin("admin", email, req as AuthorizeReq);

        const admin = await prisma.admin.findUnique({
          where: { email },
        });

        if (!admin || !admin.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!valid) return null;

        clearRateLimit(accountKey);

        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          userType: "admin",
          role: admin.role,
        } satisfies User;
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.userType = user.userType;
        token.role = user.role;
        token.batchId = user.batchId;
        token.regNo = user.regNo;
        token.revoked = false;
        token.adminCheckedAt = Date.now();
      }

      // Deactivated admins must lose access before the 8 h JWT expires.
      // Re-check isActive against the DB at most every ADMIN_REVALIDATE_MS.
      if (token.userType === "admin" && !token.revoked) {
        const now = Date.now();
        if (!token.adminCheckedAt || now - token.adminCheckedAt > ADMIN_REVALIDATE_MS) {
          const admin = await prisma.admin.findUnique({
            where: { id: token.id },
            select: { isActive: true, role: true },
          });
          token.adminCheckedAt = now;
          if (!admin || !admin.isActive) {
            token.revoked = true;
          } else {
            token.role = admin.role; // pick up role changes too
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      // A revoked token yields an unauthenticated-looking session: every API
      // guard checks session.user.userType, so all requests get 401.
      if (token.revoked) {
        session.user.id = "";
        session.user.userType = "revoked" as unknown as "admin";
        session.expires = new Date(0).toISOString();
        return session;
      }
      session.user.id = token.id;
      session.user.userType = token.userType;
      session.user.role = token.role;
      session.user.batchId = token.batchId;
      session.user.regNo = token.regNo;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};
