import api from "./client";
import type { ParentDashboardData, StudentDashboardData, TeacherDashboardData } from "@saiyonix/types";

export async function getStudentDashboard() {
  const res = await api.get("/dashboard/student");
  return (res.data?.data ?? res.data) as StudentDashboardData;
}

export async function getTeacherDashboard() {
  const res = await api.get("/dashboard/teacher");
  return (res.data?.data ?? res.data) as TeacherDashboardData;
}

export async function getParentDashboard() {
  const res = await api.get("/dashboard/parent");
  return (res.data?.data ?? res.data) as ParentDashboardData;
}
