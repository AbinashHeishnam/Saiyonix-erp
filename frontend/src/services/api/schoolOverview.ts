import api from "./client";

export type SchoolOverview = {
  schoolName: string;
  schoolAddress: string | null;
  schoolPhone: string | null;
  officialEmail: string | null;
  logoUrl?: string | null;
};

export async function getSchoolOverview() {
  const res = await api.get("/school/overview");
  return (res.data?.data ?? res.data) as SchoolOverview;
}

export async function getPublicSchoolOverview() {
  const res = await api.get("/school/overview/public");
  return (res.data?.data ?? res.data) as SchoolOverview;
}

export async function updateSchoolOverview(payload: SchoolOverview) {
  const res = await api.patch("/school/overview", payload);
  return (res.data?.data ?? res.data) as SchoolOverview;
}

export async function uploadSchoolLogo(file: File) {
  const formData = new FormData();
  formData.append("logo", file);
  const res = await api.post("/school/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (res.data?.data ?? res.data) as { logoUrl: string };
}
