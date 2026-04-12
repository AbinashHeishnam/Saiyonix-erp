import api from "./client";

export async function getStudentHistory(studentId: string) {
  const res = await api.get(`/students/${studentId}/history`);
  return res.data?.data ?? res.data;
}
