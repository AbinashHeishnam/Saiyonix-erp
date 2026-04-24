import { deleteToken, getToken, onMessage } from "firebase/messaging";
import toast from "react-hot-toast";

import { API_ORIGIN } from "./api/client";
import { registerFcmToken, unregisterFcmToken } from "./api/notifications";
import { getFirebaseMessaging, getFirebaseVapidKey } from "../lib/firebase";

const STORAGE_KEY = "saiyonix:fcmToken";
const VAPID_KEY_STORAGE_KEY = "saiyonix:fcmVapidKey";
const SW_RELOAD_SESSION_KEY = "saiyonix:fcm:reloadedForSwControl";

function isSecurePushContext() {
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const trimmed = base64Url.trim();
  if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
    throw new Error("VAPID key contains invalid characters (expected base64url)");
  }
  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function logInfo(...args: unknown[]) {
  console.info("[FCM]", ...args);
}

function logWarn(...args: unknown[]) {
  console.warn("[FCM]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[FCM]", ...args);
}

function getStoredVapidKey() {
  try {
    return localStorage.getItem(VAPID_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredVapidKey(vapidKey: string) {
  try {
    localStorage.setItem(VAPID_KEY_STORAGE_KEY, vapidKey);
  } catch {
    // ignore
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration> {
  const swUrl = "/firebase-messaging-sw.js";
  const expectedSwPath = "/firebase-messaging-sw.js";

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const meta = registrations.map((r) => ({
      scope: r.scope,
      active: r.active?.scriptURL || "",
      waiting: r.waiting?.scriptURL || "",
      installing: r.installing?.scriptURL || "",
    }));
    logInfo("SW registrations", { count: registrations.length, registrations: meta });

    const isFcmSw = (r: ServiceWorkerRegistration) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      return url.includes(expectedSwPath);
    };

    const fcmRegs = registrations.filter(isFcmSw);
    const keep =
      fcmRegs.find((r) => new URL(r.scope).pathname === "/") ||
      fcmRegs[0] ||
      null;

    const toUnregister = registrations.filter((r) => r !== keep);
    if (toUnregister.length > 0) {
      logWarn("Unregistering extra service workers (keeping only the FCM SW at scope=/ when possible)", {
        keepScope: keep?.scope ?? "none",
        removeScopes: toUnregister.map((r) => r.scope),
      });
      await Promise.allSettled(toUnregister.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }

  const registration = await navigator.serviceWorker.register(swUrl, {
    scope: "/",
    updateViaCache: "none",
  });

  logInfo("SW registered", {
    url: swUrl,
    scope: registration.scope,
    controller: !!navigator.serviceWorker.controller,
  });

  // If the page is not controlled yet, a reload is required for the SW to take control.
  // Do it once per tab session to avoid infinite loops.
  if (!navigator.serviceWorker.controller) {
    const alreadyReloaded = sessionStorage.getItem(SW_RELOAD_SESSION_KEY) === "1";
    if (!alreadyReloaded) {
      sessionStorage.setItem(SW_RELOAD_SESSION_KEY, "1");
      logInfo("First load, reloading for SW control");
      window.location.reload();
    }
    throw new Error("FCM_SW_RELOAD_REQUIRED");
  }

  sessionStorage.removeItem(SW_RELOAD_SESSION_KEY);
  return registration;
}

export async function initFcmPush(): Promise<
  | { enabled: true }
  | {
      enabled: false;
      reason:
        | "NO_SW"
        | "NO_NOTIFICATION"
        | "INSECURE_CONTEXT"
        | "PERMISSION_DENIED"
        | "UNSUPPORTED"
        | "NO_VAPID"
        | "RELOAD_REQUIRED"
        | "TOKEN_FAILED"
        | "REGISTER_FAILED";
    }
> {
  if (!("serviceWorker" in navigator)) return { enabled: false, reason: "NO_SW" };
  if (!("Notification" in window)) return { enabled: false, reason: "NO_NOTIFICATION" };
  if (!isSecurePushContext()) return { enabled: false, reason: "INSECURE_CONTEXT" };
  if (!("PushManager" in window)) return { enabled: false, reason: "UNSUPPORTED" };

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return { enabled: false, reason: "PERMISSION_DENIED" };

  const vapidKey = ((await getFirebaseVapidKey(API_ORIGIN)) || "").trim();
  if (!vapidKey) return { enabled: false, reason: "NO_VAPID" };

  logInfo("VAPID key loaded", { length: vapidKey.length, source: "backend", vapidKey });
  if (!vapidKey || vapidKey.length < 80) {
    throw new Error("Invalid VAPID key at runtime");
  }

  // Register SW (may trigger one-time reload). Do not wait for controller events.
  let registration: ServiceWorkerRegistration;
  try {
    registration = await registerFcmServiceWorker();
  } catch (err) {
    if (err instanceof Error && err.message === "FCM_SW_RELOAD_REQUIRED") {
      return { enabled: false, reason: "RELOAD_REQUIRED" };
    }
    logError("SW registration failed", err);
    return { enabled: false, reason: "REGISTER_FAILED" };
  }

  // Messaging is initialized once inside getFirebaseMessaging().
  const messaging = await getFirebaseMessaging(API_ORIGIN);
  if (!messaging) return { enabled: false, reason: "UNSUPPORTED" };

  // If the VAPID key changed since last run, existing push subscriptions can become invalid
  // and will cause subscribe()/getToken() to fail. Clean up before proceeding.
  const previousVapidKey = getStoredVapidKey();
  if (previousVapidKey && previousVapidKey !== vapidKey) {
    logWarn("VAPID key changed; clearing previous subscription/token", {
      previousLength: previousVapidKey.length,
      currentLength: vapidKey.length,
    });

    try {
      const existingSub = await registration.pushManager.getSubscription();
      await existingSub?.unsubscribe();
    } catch (err) {
      logWarn("Failed to unsubscribe previous PushSubscription", err);
    }

    try {
      await deleteToken(messaging);
    } catch (err) {
      logWarn("Failed to delete previous FCM token", err);
    }

    const previousToken = getStoredToken();
    if (previousToken) {
      void unregisterFcmToken(previousToken).catch(() => {});
      clearStoredToken();
    }
  }

  // Ensure a valid PushSubscription exists (helps diagnose key conversion issues separately from FCM).
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);
  if (applicationServerKey.length !== 65) {
    throw new Error(`Invalid applicationServerKey length: ${applicationServerKey.length} (expected 65)`);
  }
  logInfo("pushManager.subscribe (pre)", {
    vapidLen: vapidKey.length,
    appServerKeyLen: applicationServerKey.length,
  });

  try {
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });
  } catch (err) {
    // Most common cause: an old PushSubscription created with a different VAPID key.
    // Unsubscribe once and retry deterministically.
    const name = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
    logWarn("pushManager.subscribe failed", { name, err });

    try {
      const existing = await registration.pushManager.getSubscription();
      await existing?.unsubscribe();
    } catch (unsubscribeErr) {
      logWarn("Failed to unsubscribe after subscribe() error", unsubscribeErr);
    }

    try {
      await deleteToken(messaging);
    } catch (deleteErr) {
      logWarn("Failed to delete token after subscribe() error", deleteErr);
    }

    try {
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    } catch (err2) {
      logError("pushManager.subscribe failed (after cleanup)", err2);
      return { enabled: false, reason: "REGISTER_FAILED" };
    }
  }

  let token = "";
  try {
    token =
      (await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })) ?? "";
  } catch (err) {
    logError("getToken failed", err);
    return { enabled: false, reason: "TOKEN_FAILED" };
  }

  if (!token) return { enabled: false, reason: "TOKEN_FAILED" };
  logInfo("getToken success", { tokenPreview: `${token.slice(0, 10)}…${token.slice(-10)}` });

  const previous = getStoredToken();
  if (previous && previous !== token) {
    void unregisterFcmToken(previous).catch(() => {});
  }

  try {
    await registerFcmToken(token);
  } catch (err) {
    logError("Backend token register failed", err);
    return { enabled: false, reason: "REGISTER_FAILED" };
  }

  setStoredToken(token);
  setStoredVapidKey(vapidKey);

  onMessage(messaging, (payload) => {
    logInfo("Foreground message", payload);
    const title = payload.notification?.title ?? "Notification";
    const body = payload.notification?.body ?? (payload.data?.message as string | undefined) ?? "";
    toast(`${title}${body ? ` — ${body}` : ""}`);
  });

  return { enabled: true };
}

export async function teardownFcmPushOnLogout(): Promise<void> {
  const token = getStoredToken();
  if (!token) return;

  try {
    await unregisterFcmToken(token);
  } catch {
    // ignore
  }

  try {
    const messaging = await getFirebaseMessaging(API_ORIGIN);
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch {
    // ignore
  }

  clearStoredToken();
}
