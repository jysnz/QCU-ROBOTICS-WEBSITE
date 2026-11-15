"use client";

import { adminFetch } from "./supabase";

/* Browser side of Firebase Cloud Messaging (push). Needs the NEXT_PUBLIC_FIREBASE_* variables and the VAPID key
   (Firebase console, Project settings, Cloud Messaging, Web Push certificates). Without them the bell still works,
   it just can't push to the device. */
// The web config is public by design (it only identifies the project), so it is also the fallback when the variables aren't set.
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDjJPCVdzz8COOUjuPrVnMBy-2nxGNFtGQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "qcu-robotics.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "qcu-robotics",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "qcu-robotics.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "392514017032",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:392514017032:web:47000b0cf5b1941b517ebd",
};
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const TOKEN_KEY = "admin-push-token";

export type PushState = "unconfigured" | "unsupported" | "denied" | "off" | "on";

const configured = () => !!(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && VAPID);
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const saveToken = (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private window */ } };

async function messaging() {
  const [{ initializeApp, getApps, getApp }, { getMessaging, isSupported }] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await isSupported())) return null;
  const app = getApps().length ? getApp() : initializeApp(cfg);
  return getMessaging(app);
}

/** What the "turn on notifications" control should show right now. */
export async function getPushState(): Promise<PushState> {
  if (!configured()) return "unconfigured";
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && readToken() ? "on" : "off";
}

/** Asks the browser for permission (must be called from a click), registers this device with Firebase and with our server. */
export async function enablePush(): Promise<PushState> {
  if (!configured()) return "unconfigured";
  const m = await messaging();
  if (!m) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/admin" });
  await navigator.serviceWorker.ready;
  const { getToken } = await import("firebase/messaging");
  const token = await getToken(m, { vapidKey: VAPID, serviceWorkerRegistration: reg });
  if (!token) return "off";
  await adminFetch("/api/admin/push-token", { method: "POST", body: JSON.stringify({ token }) });
  saveToken(token);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const token = readToken();
  try {
    if (token) await adminFetch("/api/admin/push-token", { method: "DELETE", body: JSON.stringify({ token }) });
    const m = await messaging();
    if (m) { const { deleteToken } = await import("firebase/messaging"); await deleteToken(m); }
  } catch { /* already gone */ }
  saveToken(null);
  return getPushState();
}
