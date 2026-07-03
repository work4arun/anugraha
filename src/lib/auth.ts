import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const student = await prisma.student.findUnique({
          where: { username: credentials.username.trim().toUpperCase() },
          include: { batch: { include: { institution: true } } },
        });

        if (!student) return null;

        const valid = await bcrypt.compare(credentials.password, student.passwordHash);
        if (!valid) return null;

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });

        if (!admin || !admin.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!valid) return null;

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
      }
      return token;
    },

    async session({ session, token }) {
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
