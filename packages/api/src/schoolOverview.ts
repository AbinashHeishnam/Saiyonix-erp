import api from "./client";
import type { SchoolOverview } from "@saiyonix/types";

export async function getSchoolOverview() {
  const res = await api.get("/school/overview");
  return (res.data?.data ?? res.data) as SchoolOverview;
}

export async function getPublicSchoolOverview() {
  const res = await api.get("/school/overview/public");
  return (res.data?.data ?? res.data) as SchoolOverview;
}
