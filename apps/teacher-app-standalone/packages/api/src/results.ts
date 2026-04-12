import api from "./client";
import type { ResultPayload } from "@saiyonix/types";

export async function getResults(examId: string, studentId?: string) {
  const res = await api.get(`/results/${examId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return (res.data?.data ?? res.data) as ResultPayload;
}
