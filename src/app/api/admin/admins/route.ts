/**
 * /api/admin/admins  —  admin account management (SUPER_ADMIN only)
 *   GET   — list all admin accounts
 *   POST  — create a new admin login
 *           body: { name, email, password, role?, institutionId? }
 *
 * Only a SUPER_ADMIN may call these. Other roles receive 403.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/authz";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      institution: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: admins });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json(
      { success: false, error: "Only a super admin can create admin logins" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      institutionId?: string | null;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const role = (body.role ?? "STAFF") as Role;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email and password are required" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "An admin with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        institutionId: body.institutionId || null,
        createdById: session.user.id,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    // Audit logging is best-effort — a logging hiccup must never turn a
    // successful admin creation into a 500 (which would leave the account
    // created but report failure, so a retry then says "already exists").
    try {
      await prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          actorType: "admin",
          action: "ADMIN_CREATED",
          entityType: "Admin",
          entityId: admin.id,
          metadata: { email, role },
        },
      });
    } catch (auditErr) {
      console.warn("[admins POST] audit log failed:", auditErr);
    }

    return NextResponse.json({ success: true, data: admin });
  } catch (error) {
    // A concurrent/double submit can slip past the findUnique check above and
    // hit the unique-email constraint (Prisma P2002). Report it as a clean
    // "already exists" instead of a generic 500.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, error: "An admin with this email already exists" },
        { status: 409 }
      );
    }
    console.error("[admins POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
