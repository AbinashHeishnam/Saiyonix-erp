import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type FirebaseFcmWebConfig = {
  firebaseConfig: FirebaseWebConfig;
  vapidKey: string | null;
};

let configPromise: Promise<FirebaseFcmWebConfig> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  }) as Promise<T>;
}

async function fetchFirebaseWebConfig(apiOrigin: string): Promise<FirebaseFcmWebConfig> {
  const url = `${apiOrigin.replace(/\/$/, "")}/api/v1/notifications/fcm/web-config`;
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const json = (await res.json()) as { success?: boolean; data?: unknown; message?: string };
  if (!res.ok || !json?.data) {
    throw new Error("Failed to fetch Firebase web config");
  }

  const data = json.data as { firebaseConfig?: unknown; vapidKey?: unknown };
  if (!data?.firebaseConfig) {
    throw new Error("Firebase web config response missing firebaseConfig");
  }

  const vapidKey = typeof data.vapidKey === "string" && data.vapidKey.trim() ? data.vapidKey.trim() : null;
  console.log("[FCM FRONTEND] VAPID:", vapidKey, "len=", vapidKey?.length ?? 0);

  return {
    firebaseConfig: data.firebaseConfig as FirebaseWebConfig,
    vapidKey,
  };
}

export async function getFirebaseMessaging(apiOrigin: string): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const supported = await isSupported().catch(() => false);
      if (!supported) return null;

      if (!configPromise) {
        configPromise = withTimeout(fetchFirebaseWebConfig(apiOrigin), 10000, "Fetch Firebase web config");
      }
      const { firebaseConfig } = await configPromise;

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }

  return messagingPromise;
}

export async function getFirebaseVapidKey(apiOrigin: string): Promise<string | null> {
  if (!configPromise) {
    configPromise = withTimeout(fetchFirebaseWebConfig(apiOrigin), 10000, "Fetch Firebase web config");
  }
  const config = await configPromise;
  return config.vapidKey;
}
