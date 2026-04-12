import api from "./client";
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
