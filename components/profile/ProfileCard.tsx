/**
 * components/profile/ProfileCard.tsx
 *
 * Shared profile page card for all roles.
 * Shows name, email, role badge, and a password change form.
 * Logout button calls the auth hook.
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Shield,
  Lock,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  admin:    { label: "Admin",    color: "bg-blue-100 text-blue-800"   },
  employee: { label: "Employee", color: "bg-green-100 text-green-800" },
  ceo:      { label: "CEO",      color: "bg-purple-100 text-purple-800" },
};

interface ProfileCardProps {
  name:  string;
  email: string;
  role:  UserRole;
}

export default function ProfileCard({ name, email, role }: ProfileCardProps) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwLoading,  setPwLoading]  = useState(false);
  const [pwMsg,      setPwMsg]      = useState<{ type: "success" | "error"; text: string } | null>(null);

  const roleInfo = ROLE_LABELS[role] ?? { label: role, color: "bg-slate-100 text-slate-700" };

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (newPw.length < 8) {
      setPwMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (json.success) {
        setPwMsg({ type: "success", text: "Password changed successfully." });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setPwMsg({ type: "error", text: json.error ?? "Password change failed." });
      }
    } catch {
      setPwMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Identity card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
            <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", roleInfo.color)}>
              {roleInfo.label}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center gap-3 py-3">
            <User className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Full Name</p>
              <p className="text-sm font-medium text-slate-900">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Email Address</p>
              <p className="text-sm font-medium text-slate-900">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <Shield className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Role</p>
              <p className="text-sm font-medium text-slate-900">{roleInfo.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          {pwMsg && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg p-3 text-sm",
              pwMsg.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
            )}>
              {pwMsg.type === "success"
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              {pwMsg.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="input"
              placeholder="Enter current password"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="input"
              placeholder="Repeat new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="btn-primary w-full justify-center"
          >
            {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {pwLoading ? "Saving…" : "Change Password"}
          </button>
        </form>
      </div>

      {/* Logout */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </div>
  );
}
