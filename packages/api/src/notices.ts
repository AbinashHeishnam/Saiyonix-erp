import api from "./client";
import type { Notice } from "@saiyonix/types";

export async function listNotices(params?: { page?: number; limit?: number; active?: boolean }) {
  const res = await api.get("/notices/me", { params });
  return res.data;
}

export async function getNotice(id: string) {
  const res = await api.get(`/notices/me/${id}`);
  return (res.data?.data ?? res.data) as Notice;
}
