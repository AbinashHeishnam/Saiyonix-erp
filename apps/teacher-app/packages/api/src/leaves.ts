import api from "./client";
import type { LeaveRequest } from "@saiyonix/types";

export async function listTeacherLeaves() {
  const res = await api.get("/teacher/leave/my", { params: { page: 1, limit: 200 } });
  return (res.data?.data ?? res.data) as LeaveRequest[];
}

export async function applyTeacherLeave(payload: FormData | Record<string, unknown>) {
  const res = await api.post("/teacher/leave/apply", payload, {
    headers: payload instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function listStudentLeaves() {
  const res = await api.get("/student/leave/my", { params: { page: 1, limit: 200 } });
  return (res.data?.data ?? res.data) as LeaveRequest[];
}

export async function applyStudentLeave(payload: FormData | Record<string, unknown>) {
  const res = await api.post("/student/leave/apply", payload, {
    headers: payload instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return res.data?.data ?? res.data;
}
