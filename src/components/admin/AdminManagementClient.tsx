"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  UserPlus,
  LogOut,
  KeyRound,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { listContainer, listItem } from "@/lib/motion";
import { generatePassword } from "@/lib/utils";

type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  institutionCode: string | null;
}

const roleBadge: Record<string, "success" | "warning" | "default" | "muted"> = {
  SUPER_ADMIN: "success",
  ADMIN: "warning",
  STAFF: "default",
};

export function AdminManagementClient({
  currentAdminId,
  admins,
  institutions,
}: {
  currentAdminId: string;
  admins: AdminRow[];
  institutions: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [institutionId, setInstitutionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Custom password modal state
  const [pwTarget, setPwTarget] = useState<AdminRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Delete-confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error("Fill in name, email and a password of 8+ characters");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          institutionId: institutionId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Admin login created");
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setInstitutionId("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create admin");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(admin: AdminRow) {
    setRowBusy(admin.id);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(admin.isActive ? "Admin deactivated" : "Admin activated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update admin");
    } finally {
      setRowBusy(null);
    }
  }

  function openPwModal(admin: AdminRow) {
    setPwValue("");
    setPwTarget(admin);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/admins/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete admin");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function savePassword() {
    if (!pwTarget) return;
    if (pwValue.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch(`/api/admin/admins/${pwTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Password updated for ${pwTarget.name}`);
      setPwTarget(null);
      setPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-brand" />
          </div>
          <h1 className="text-base font-semibold text-ink flex-1">Admin Management</h1>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="min-h-[44px] px-2 text-ink-muted hover:text-ink transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-8"
        >
          {/* Create admin */}
          <motion.section variants={listItem}>
            <Card padding="md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand" />
                  <CardTitle>Create Admin Login</CardTitle>
                </div>
              </CardHeader>

              <form onSubmit={createAdmin} className="grid gap-4 md:grid-cols-2">
                <Input
                  id="admin-name"
                  label="Full name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Ramesh"
                />
                <Input
                  id="admin-email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rathinam.in"
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="admin-password" className="text-sm font-medium text-ink">
                    Password <span className="text-error ml-1">*</span>
                  </label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        id="admin-password"
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        hint="Minimum 8 characters"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setPassword(generatePassword(12))}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="admin-role" className="text-sm font-medium text-ink">
                    Role
                  </label>
                  <select
                    id="admin-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-4 py-3 rounded-xl border border-surface-border text-base bg-white min-h-[48px] focus:border-brand focus:outline-none"
                  >
                    <option value="STAFF">Staff — manages own batches</option>
                    <option value="ADMIN">Admin — manages own batches</option>
                    <option value="SUPER_ADMIN">Super Admin — full access</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="admin-institution" className="text-sm font-medium text-ink">
                    Institution (optional)
                  </label>
                  <select
                    id="admin-institution"
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-surface-border text-base bg-white min-h-[48px] focus:border-brand focus:outline-none"
                  >
                    <option value="">None</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.code} — {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" loading={busy} icon={<UserPlus className="w-4 h-4" />}>
                    Create Admin
                  </Button>
                </div>
              </form>
            </Card>
          </motion.section>

          {/* Existing admins */}
          <section>
            <motion.h2
              variants={listItem}
              className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4"
            >
              Admin Accounts ({admins.length})
            </motion.h2>

            <motion.div variants={listContainer} className="flex flex-col gap-3">
              {admins.map((admin) => (
                <motion.div
                  key={admin.id}
                  variants={listItem}
                  className="bg-white rounded-2xl border-2 border-surface-border p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-brand">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink truncate">{admin.name}</p>
                      <Badge variant={roleBadge[admin.role] ?? "default"}>
                        {admin.role.replace("_", " ")}
                      </Badge>
                      {admin.id === currentAdminId && <Badge variant="muted">You</Badge>}
                      {!admin.isActive && <Badge variant="muted">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-ink-muted truncate">{admin.email}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openPwModal(admin)}
                      disabled={rowBusy === admin.id}
                      title="Set password"
                      aria-label="Set password"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-brand-50 transition-colors disabled:opacity-40"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    {admin.id !== currentAdminId && (
                      <>
                        <button
                          onClick={() => toggleActive(admin)}
                          disabled={rowBusy === admin.id}
                          title={admin.isActive ? "Deactivate" : "Activate"}
                          aria-label={admin.isActive ? "Deactivate" : "Activate"}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light transition-colors disabled:opacity-40"
                        >
                          {admin.isActive ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(admin)}
                          disabled={rowBusy === admin.id}
                          title="Delete admin"
                          aria-label="Delete admin"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-error hover:bg-error-light transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </motion.div>
      </main>

      {/* Set-password modal */}
      {pwTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !pwBusy && setPwTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">Set password</h3>
            <p className="text-sm text-ink-muted mb-4">
              Choose a new password for <span className="font-medium text-ink">{pwTarget.name}</span>.
              Share it with them securely.
            </p>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  id="set-pw"
                  type="text"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  hint="Minimum 8 characters"
                  autoFocus
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => setPwValue(generatePassword(12))}>
                Generate
              </Button>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setPwTarget(null)} disabled={pwBusy}>
                Cancel
              </Button>
              <Button onClick={savePassword} loading={pwBusy} icon={<KeyRound className="w-4 h-4" />}>
                Save password
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-error-light flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-error" />
              </div>
              <h3 className="text-base font-semibold text-ink">Delete admin</h3>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              This permanently removes{" "}
              <span className="font-medium text-ink">{deleteTarget.name}</span> ({deleteTarget.email}).
              This cannot be undone. If you only want to block access, deactivate them instead.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleteBusy}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
