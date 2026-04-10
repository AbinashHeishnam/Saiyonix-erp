import api from "./client";

export async function getTeacherHistory() {
  const res = await api.get("/teachers/history");
  return res.data?.data ?? res.data;
}

export async function getTeacherHistoryById(teacherId: string) {
  const res = await api.get(`/teachers/${teacherId}/history`);
  return res.data?.data ?? res.data;
}
