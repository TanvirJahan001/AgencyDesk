/**
 * contexts/AuthContext.tsx — Client-side Authentication Context
 *
 * Provides the current user's auth state to every Client Component
 * in the tree.  Wraps Firebase onAuthStateChanged so components can
 * react to sign-in / sign-out without prop-drilling.
 *
 * Usage:
 *   const { user, role, loading, signOut } = useAuth();
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import type { UserRole, AppUser } from "@/types";

// ── Types ─────────────────────────────────────────────────────

interface AuthState {
  /** Firebase Auth user object (null when signed out) */
  user: User | null;
  /** Firestore profile for the signed-in user */
  profile: AppUser | null;
  /** Role shortcut — avoids profile?.role everywhere */
  role: UserRole | null;
  /** True while the initial auth check is running */
  loading: boolean;
  /** Sign the user out and clear the server session cookie */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user:    null,
  profile: null,
  role:    null,
  loading: true,
  signOut: async () => {},
});

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [role,    setRole]    = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Fetch the Firestore profile to get the role
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data() as AppUser;
            setProfile(data);
            setRole(data.role);
          } else {
            // User exists in Auth but not in Firestore — default to employee
            setProfile(null);
            setRole("employee");
          }
        } catch {
          setProfile(null);
          setRole(null);
        }
      } else {
        setProfile(null);
        setRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign-out: clear Firebase + server cookie, then redirect
  const handleSignOut = useCallback(async () => {
    try {
      // 1. Clear the server-side session cookie
      await fetch("/api/auth/session", { method: "DELETE" });

      // 2. Sign out of Firebase client SDK
      await firebaseSignOut(auth);

      // 3. Redirect to login
      router.replace("/login");
    } catch (err) {
      console.error("Sign-out failed:", err);
      // Force redirect even on error
      router.replace("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, profile, role, loading, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
