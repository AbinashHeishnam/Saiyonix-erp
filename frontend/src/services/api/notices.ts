import api from "./client";

export type Notice = {
  id: string;
  title: string;
  content: string;
  noticeType: string;
  isPublic?: boolean;
  targetType?: string | null;
  targetClassId?: string | null;
  targetSectionId?: string | null;
  targetRole?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  attachments?: string[] | null;
};

export async function listNotices(params?: {
  page?: number;
  limit?: number;
  active?: boolean;
}) {
  const res = await api.get("/notices/me", { params });
  return res.data;
}

export async function createNotice(payload: Partial<Notice>) {
  const res = await api.post("/admin/notices", payload);
  return res.data?.data ?? res.data;
}

export async function updateNotice(id: string, payload: Partial<Notice>) {
  const res = await api.patch(`/admin/notices/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteNotice(id: string) {
  const res = await api.delete(`/admin/notices/${id}`);
  return res.data?.data ?? res.data;
}

export async function getNotice(id: string) {
  const res = await api.get(`/notices/me/${id}`);
  return res.data?.data ?? res.data;
}
