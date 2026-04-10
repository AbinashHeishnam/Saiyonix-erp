import api from "./client";

export async function getParentProfile() {
  const res = await api.get("/parents/profile");
  return res.data?.data ?? res.data;
}
