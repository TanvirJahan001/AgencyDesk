/**
 * lib/firebase/admin.ts
 *
 * Firebase ADMIN SDK — runs on the server only (API routes, Server Components,
 * middleware).  Never import this file from client components.
 *
 * Supports two credential strategies (set exactly one in .env.local):
 *   A) FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON — full JSON string of the key file
 *   B) Individual fields: FIREBASE_ADMIN_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY
 */

import {
  initializeApp,
  getApps,
  getApp,
  cert,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function buildCredential(): ServiceAccount {
  // Option A: full JSON blob
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) as ServiceAccount & { private_key?: string };
    // Vercel stores \n as literal backslash-n — convert to real newlines
    if (sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    return sa;
  }

  // Option B: individual env vars
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. " +
      "Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON or the three individual vars in .env.local."
    );
  }

  return { projectId, clientEmail, privateKey };
}

// Singleton
const adminApp: App =
  getApps().length
    ? getApp()
    : initializeApp({ credential: cert(buildCredential()) });

const adminAuth: Auth           = getAuth(adminApp);
const adminDb: Firestore        = getFirestore(adminApp);

export { adminApp, adminAuth, adminDb };
