import api from "./client";

export async function createMark(payload: {
  examSubjectId: string;
  studentId: string;
  marksObtained: number;
}) {
  const res = await api.post("/marks", payload);
  return res.data?.data ?? res.data;
}

export async function createBulkMarks(payload: {
  examSubjectId: string;
  items: Array<{ studentId: string; marksObtained: number }>;
}) {
  const res = await api.post("/marks/bulk", payload);
  return res.data?.data ?? res.data;
}

export async function updateMark(id: string, payload: { marksObtained: number }) {
  const res = await api.patch(`/marks/${id}`, payload);
  return res.data?.data ?? res.data;
}
