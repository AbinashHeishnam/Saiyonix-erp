import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { getAuthTokens, registerNotificationToken } from "@saiyonix/api";
import { getLastPushToken, setLastPushToken } from "@saiyonix/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let notificationResponseHandler:
  | ((response: Notifications.NotificationResponse) => void | Promise<void>)
  | null = null;

export function setNotificationResponseHandler(
  handler: ((response: Notifications.NotificationResponse) => void | Promise<void>) | null
) {
  notificationResponseHandler = handler;
}

function getExpoConfig() {
  // In Expo Go, `Constants.expoConfig` can be `null` while `expoGoConfig` is populated.
  return (Constants.expoConfig ?? (Constants.expoGoConfig as any)) as
    | { extra?: any; version?: string }
    | null;
}

function resolveProjectId() {
  const config = getExpoConfig();
  const fromExtra = config?.extra?.eas?.projectId;
  const fromEasConfig = Constants.easConfig?.projectId;
  const projectId =
    (typeof fromExtra === "string" && fromExtra.trim().length > 0 ? fromExtra.trim() : null) ??
    (typeof fromEasConfig === "string" && fromEasConfig.trim().length > 0 ? fromEasConfig.trim() : null);

  return projectId;
}

export async function registerForPush() {
  if (!registerPromise) {
    registerPromise = (async () => {
      console.log("🚀 PUSH INIT START");

      if (!Device.isDevice) {
        const err = new Error("Push registration requires a physical device (Device.isDevice is false).");
        console.error("[PUSH] FATAL:", err.message);
        throw err;
      }

      if (Constants.appOwnership === "expo") {
        console.warn(
          "[PUSH] Running in Expo Go; push notifications may not work reliably. Use a dev build/standalone build for testing."
        );
      }

      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#0ea5e9",
          });
          console.log("[PUSH] Android channel: default (created/updated)");
        } catch (err) {
          console.error("[PUSH] Failed to set Android notification channel:", err);
          throw err;
        }
      }

      let existingStatus: Notifications.PermissionStatus;
      try {
        const existing = await Notifications.getPermissionsAsync();
        existingStatus = existing.status;
        console.log("[PUSH] Permission details (existing):", existing);
      } catch (err) {
        console.error("[PUSH] Failed to read permission status:", err);
        throw err;
      }

      console.log("STEP 1 existing permission:", existingStatus);

      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        try {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
          console.log("[PUSH] Permission details (requested):", requested);
        } catch (err) {
          console.error("[PUSH] Permission request failed:", err);
          throw err;
        }
      }

      console.log("STEP 2 final permission:", finalStatus);

      if (finalStatus !== "granted") {
        const err = new Error(`Push permission not granted (status=${finalStatus}).`);
        console.error("[PUSH] FATAL:", err.message);
        throw err;
      }

      const projectId = resolveProjectId();
      console.log("STEP 3 projectId:", projectId ?? "(missing)");

      let token: string | null = null;
      try {
        if (projectId) {
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          console.log("[PUSH] getExpoPushTokenAsync response:", tokenData);
          token = tokenData.data;
        } else {
          // Expo Go / legacy fallback. Works in some dev contexts, but we still log loudly
          // because production builds should always have a projectId.
          console.warn("[PUSH] Missing projectId; attempting getExpoPushTokenAsync() without projectId fallback.");
          const tokenData = await Notifications.getExpoPushTokenAsync();
          console.log("[PUSH] getExpoPushTokenAsync response:", tokenData);
          token = tokenData.data;
        }
      } catch (err) {
        console.error("[PUSH] getExpoPushTokenAsync failed:", err);
        console.error(
          "[PUSH] Common causes: missing/incorrect EAS projectId, running in Expo Go with mismatched project, network issues, or broken Expo notifications setup."
        );
        throw err;
      }

      if (!token || typeof token !== "string") {
        const err = new Error("Expo push token generation returned an empty token.");
        console.error("[PUSH] FATAL:", err.message, { token });
        throw err;
      }

      console.log("🔥 PUSH TOKEN GENERATED:", token);
      console.log("[PUSH] TOKEN:", token);

      // Always persist locally so post-login sync can use it.
      try {
        await setLastPushToken(token);
        console.log("[PUSH] TOKEN STORED:", token);
      } catch (err) {
        console.error("[PUSH] Failed to persist token locally:", err);
        throw err;
      }

      return token;
    })().catch((err) => {
      // Allow retry on next call if registration failed.
      registerPromise = null;
      throw err;
    });
  }

  return await registerPromise;
}

export function attachPushListeners() {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log("[PUSH] RECEIVED (foreground):", notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("[PUSH] RESPONSE (tap):", response);
    const handler = notificationResponseHandler;
    if (!handler) return;
    try {
      void Promise.resolve(handler(response)).catch((err) => {
        console.error("[PUSH] Response handler failed:", err);
      });
    } catch (err) {
      console.error("[PUSH] Response handler threw:", err);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

let initPromise: Promise<() => void> | null = null;
let registerPromise: Promise<string> | null = null;

export async function initPushNotifications() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const detach = attachPushListeners();
    try {
      await registerForPush();
      return detach;
    } catch (err) {
      // Ensure we don't leak listeners if init fails.
      detach();
      throw err;
    }
  })();

  return initPromise;
}

export async function syncLastPushTokenToBackend() {
  const tokens = getAuthTokens();
  console.log("[PUSH][AUTH] syncLastPushTokenToBackend called", {
    hasAccessToken: Boolean(tokens?.accessToken),
    hasRefreshToken: Boolean(tokens?.refreshToken),
  });
  if (!tokens?.accessToken) {
    const err = new Error("Not authenticated (missing access token); refusing to sync push token to backend.");
    console.error("[PUSH] FATAL:", err.message);
    throw err;
  }

  let token = getLastPushToken();
  if (!token) {
    console.warn("[PUSH] No stored token; generating a new token before backend sync.");
    token = await registerForPush();
  }

  if (!token) {
    const err = new Error("Missing push token; cannot sync to backend.");
    console.error("[PUSH] FATAL:", err.message);
    throw err;
  }

  console.log("[PUSH] Backend token sync start:", token);
  const config = getExpoConfig();

  try {
    console.log("[PUSH] Backend token sync request payload:", {
      token,
      platform: "expo",
      deviceInfo: {
        platform: Platform.OS,
        appVersion: config?.version ?? null,
        easProjectId: resolveProjectId(),
        appOwnership: (Constants as any).appOwnership ?? null,
      },
    });
    await registerNotificationToken({
      token,
      platform: "expo",
      deviceInfo: {
        platform: Platform.OS,
        appVersion: config?.version ?? null,
        easProjectId: resolveProjectId(),
        appOwnership: (Constants as any).appOwnership ?? null,
      },
    });
  } catch (err) {
    console.error("[PUSH] Backend token sync failed:", err);
    throw err;
  }

  console.log("[PUSH] Backend token sync: OK");
  return token;
}
