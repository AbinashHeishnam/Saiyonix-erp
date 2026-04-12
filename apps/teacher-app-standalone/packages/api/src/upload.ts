import api from "./client";

export async function uploadFile(payload: {
  file: { uri: string; name?: string; type?: string };
  userType: "teacher" | "student" | "parent" | "common";
  userId?: string;
  module: string;
}) {
  const formData = new FormData();
  formData.append("file", payload.file as any);
  formData.append("userType", payload.userType);
  if (payload.userId) formData.append("userId", payload.userId);
  formData.append("module", payload.module);
  const res = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data ?? res.data;
}
