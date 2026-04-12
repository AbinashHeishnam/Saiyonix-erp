import api from "./client";

export async function listAcademicYears(params?: { page?: number; limit?: number }) {
  const res = await api.get("/academic-years", {
    params: params && Object.values(params).some((v) => v !== undefined) ? params : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function getActiveAcademicYear() {
  const res = await api.get("/academic-years/active");
  return res.data?.data ?? res.data;
}

export async function getPreviousAcademicYear() {
  const res = await api.get("/academic-years/previous");
  return res.data?.data ?? res.data;
}

export async function getAcademicYearTransitionMeta() {
  const res = await api.get("/academic-years/transition-meta");
  return res.data?.data ?? res.data;
}
