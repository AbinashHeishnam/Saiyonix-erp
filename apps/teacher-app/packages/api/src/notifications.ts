import api, { getAuthTokens } from "./client";
import type { AxiosError } from "axios";
import type { NotificationItem } from "@saiyonix/types";

export async function listNotifications(params?: { page?: number; limit?: number }) {
  const res = await api.get("/notifications", { params });
  return {
    items: (res.data?.data ?? []) as NotificationItem[],
    meta: res.data?.meta,
  };
}

export async function markNotificationRead(id: string) {
  const res = await api.post(`/notifications/${id}/read`);
  return res.data?.data ?? res.data;
}

export async function markAllNotificationsRead() {
  const res = await api.post("/notifications/read-all");
  return res.data?.data ?? res.data;
}

export async function getUnreadCount() {
  const res = await api.get("/notifications/unread-count");
  return res.data?.data ?? res.data;
}

export async function registerNotificationToken(input: {
  token: string;
  platform: "expo" | "fcm";
  projectId?: string;
  deviceInfo?: unknown;
}) {
  if (input.platform === "expo") {
    const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
    if (!projectId) {
      throw new Error("projectId is required when registering an Expo push token");
    }

    const { accessToken } = getAuthTokens();
    const maskedAuth =
      typeof accessToken === "string" && accessToken.length > 16
        ? `Bearer ${accessToken.slice(0, 8)}…${accessToken.slice(-8)}`
        : accessToken
          ? "Bearer ***"
          : null;

    console.log("[PUSH][API] POST /notifications/register-token start", {
      hasAuth: Boolean(accessToken),
      authorization: maskedAuth,
      payload: { token: input.token, platform: "expo", projectId, deviceInfo: input.deviceInfo },
    });

    try {
      const res = await api.post("/notifications/register-token", {
        token: input.token,
        platform: "expo",
        projectId,
        deviceInfo: input.deviceInfo,
      });
      console.log("[PUSH][API] POST /notifications/register-token OK", {
        status: res.status,
        body: res.data,
      });
      return res.data?.data ?? res.data;
    } catch (err) {
      const ax = err as AxiosError;
      console.error("[PUSH][API] POST /notifications/register-token FAILED", {
        status: ax.response?.status,
        body: ax.response?.data,
        message: ax.message,
      });
      throw err;
    }
  }

  const res = await api.post("/notifications/fcm/register", { token: input.token });
  return res.data?.data ?? res.data;
}

export async function removeNotificationToken(input: { token: string }) {
  const res = await api.post("/notifications/remove-token", input);
  return res.data?.data ?? res.data;
}

export async function unregisterFcmToken(input: { token: string }) {
  const res = await api.post("/notifications/fcm/unregister", input);
  return res.data?.data ?? res.data;
}
