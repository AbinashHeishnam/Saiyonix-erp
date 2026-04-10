import api from "./client";

export type RankingEntry = {
  id: string;
  studentId: string;
  rank: number;
  totalMarks?: number;
  percentage?: number;
};

export async function getRanking(examId: string, page = 1, limit = 50) {
  const res = await api.get(`/ranking/${examId}`, { params: { page, limit } });
  return res.data?.data ?? res.data;
}

export async function recomputeRanking(examId: string) {
  const res = await api.post(`/ranking/${examId}/recompute`);
  return res.data?.data ?? res.data;
}

export async function getClassRanking(examId: string, classId: string) {
  const res = await api.get(`/ranking/${examId}/class/${classId}`);
  return res.data?.data ?? res.data;
}
