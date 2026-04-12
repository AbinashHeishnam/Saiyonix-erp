import api from "./client";
import type { StudentIdCardData, TeacherIdCardData } from "@saiyonix/types";

export async function getStudentIdCard() {
  const res = await api.get("/student/id-card");
  return (res.data?.data ?? res.data) as StudentIdCardData;
}

export async function getParentChildIdCard() {
  const res = await api.get("/parent/child/id-card");
  return (res.data?.data ?? res.data) as StudentIdCardData;
}

export async function getTeacherIdCard() {
  const res = await api.get("/teacher/id-card");
  return (res.data?.data ?? res.data) as TeacherIdCardData;
}
