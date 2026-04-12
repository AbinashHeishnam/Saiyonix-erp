import api from "./client";
import type { ParentProfileResponse, StudentProfile, TeacherProfileResponse } from "@saiyonix/types";

export async function getTeacherProfile() {
  const res = await api.get("/teacher/profile");
  return (res.data?.data ?? res.data) as TeacherProfileResponse;
}

export async function updateTeacherProfile(payload: Partial<TeacherProfile>) {
  const res = await api.patch("/teacher/profile", payload);
  return res.data?.data ?? res.data;
}

export async function uploadTeacherProfilePhoto(file: { uri: string; name?: string; type?: string }) {
  const formData = new FormData();
  formData.append("photo", file as any);
  const res = await api.post("/teacher/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data ?? res.data;
}

export async function getParentProfile() {
  const res = await api.get("/parent/profile");
  return (res.data?.data ?? res.data) as ParentProfileResponse;
}

export async function updateParentProfile(payload: Partial<ParentProfile>) {
  const res = await api.put("/parent/profile", payload);
  return res.data?.data ?? res.data;
}

export async function getStudentMe() {
  const res = await api.get("/students/me");
  return (res.data?.data ?? res.data) as StudentProfile;
}
