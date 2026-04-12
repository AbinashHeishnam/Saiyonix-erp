import api from "./client";

export async function getTeacherPromotionList() {
  const res = await api.get("/promotion/teacher");
  return res.data?.data ?? res.data;
}

export async function getPromotionList(params?: { academicYearId?: string }) {
  const res = await api.get("/promotion/list", {
    params: params && Object.values(params).some((v) => v) ? params : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function updateManualPromotions(
  updates:
    | Array<{ promotionRecordId?: string; studentId?: string; isManuallyPromoted: boolean }>
    | { updates: Array<{ promotionRecordId?: string; studentId?: string; isManuallyPromoted: boolean }> }
) {
  const list = Array.isArray(updates) ? updates : updates.updates;
  const tasks = list
    .filter((u) => u.promotionRecordId && u.isManuallyPromoted)
    .map((u) => api.post("/promotion/override", { promotionRecordId: u.promotionRecordId }));
  const res = await Promise.all(tasks);
  return res.map((r) => r.data?.data ?? r.data);
}

export async function getStudentPromotionStatus() {
  const res = await api.get("/promotion/student");
  return res.data?.data ?? res.data;
}

export async function getParentPromotionView() {
  const res = await api.get("/promotion/parent");
  return res.data?.data ?? res.data;
}
