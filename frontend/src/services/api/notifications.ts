import api from "./client";

export type NotificationItem = {
  id: string;
  readAt?: string | null;
  createdAt?: string;
  notification: {
    id: string;
    title: string;
    body?: string;
    category?: string;
    priority?: string;
    eventType?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    linkUrl?: string | null;
    metadata?: Record<string, unknown> | null;
    sentAt?: string;
    createdAt?: string;
  };
};

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

export async function registerFcmToken(token: string) {
  const res = await api.post("/notifications/fcm/register", { token });
  return res.data?.data ?? res.data;
}

export async function unregisterFcmToken(token: string) {
  const res = await api.post("/notifications/fcm/unregister", { token });
  return res.data?.data ?? res.data;
}
