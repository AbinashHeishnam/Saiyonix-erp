import api from "./client";

export async function listSections(params?: { page?: number; limit?: number; classId?: string }) {
  const res = await api.get("/sections", {
    params: params && Object.values(params).some((v) => v !== undefined) ? params : undefined,
  });
  return res.data?.data ?? res.data;
}
