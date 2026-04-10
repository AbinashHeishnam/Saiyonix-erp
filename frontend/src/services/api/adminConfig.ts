import api from "./client";

export type AppConfigRecord = {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
};

export async function listAppConfigs(): Promise<AppConfigRecord[]> {
  const res = await api.get("/admin/config");
  return res.data?.data ?? res.data;
}

export async function upsertAppConfig(input: { key: string; value: string }) {
  const res = await api.post("/admin/config", input);
  return res.data?.data ?? res.data;
}
