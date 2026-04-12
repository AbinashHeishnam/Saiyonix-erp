import { format } from "date-fns";
import type { RoleType } from "@saiyonix/types";

export const ADMIN_ROLES: RoleType[] = [
  "ADMIN",
  "ACADEMIC_SUB_ADMIN",
  "FINANCE_SUB_ADMIN",
  "SUPER_ADMIN",
];

export function isAdminRole(role?: RoleType | null) {
  return role ? ADMIN_ROLES.includes(role) : false;
}

export function displayRole(role?: RoleType | null) {
  switch (role) {
    case "ACADEMIC_SUB_ADMIN":
      return "Academic Admin";
    case "FINANCE_SUB_ADMIN":
      return "Finance Admin";
    case "SUPER_ADMIN":
      return "Super Admin";
    default:
      return role ? role.replace(/_/g, " ") : "";
  }
}

export function getLoginPathForRole(role?: RoleType | null) {
  if (!role) return "student";
  if (ADMIN_ROLES.includes(role)) return "admin";
  if (role === "TEACHER") return "teacher";
  if (role === "STUDENT" || role === "PARENT") return "student";
  return "student";
}

export function formatDate(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return format(date, "dd MMM yyyy");
  } catch {
    return fallback;
  }
}

export function formatDateTime(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return format(date, "dd MMM yyyy, HH:mm");
  } catch {
    return fallback;
  }
}

export function formatTime(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
        return trimmed.slice(0, 5);
      }
    }
    const date = typeof value === "string" ? new Date(value) : value;
    return format(date, "HH:mm");
  } catch {
    return fallback;
  }
}

export function formatPercentage(value?: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function toTitleCase(input?: string | null) {
  if (!input) return "";
  return input
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function dayName(dayOfWeek: number) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[dayOfWeek] ?? String(dayOfWeek);
}

export * from "./notifications";
