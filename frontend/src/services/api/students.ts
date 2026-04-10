import api from "./client";

export async function getStudentMe() {
  const res = await api.get("/students/me");
  return res.data?.data ?? res.data;
}

export async function listStudents(params?: { page?: number; limit?: number }) {
  const res = await api.get("/students", { params });
  return res.data?.data ?? res.data;
}

export async function getStudentHistory(studentId: string) {
  const res = await api.get(`/students/${studentId}/history`);
  return res.data?.data ?? res.data;
}
