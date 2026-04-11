import type { RoleType } from "../types/auth";
import { ADMIN_ROLES } from "./role";

export function getLoginPathForRole(role?: RoleType | null) {
  if (!role) return "/login/student";
  if (ADMIN_ROLES.includes(role)) return "/login/admin";
  if (role === "TEACHER") return "/login/teacher";
  if (role === "STUDENT" || role === "PARENT") return "/login/student";
  return "/login/student";
}

export function getLoginPathForRoles(roles?: RoleType[] | null) {
  if (!roles || roles.length === 0) return "/login/student";
  if (roles.some((role) => ADMIN_ROLES.includes(role))) return "/login/admin";
  if (roles.includes("TEACHER")) return "/login/teacher";
  if (roles.includes("STUDENT") || roles.includes("PARENT")) return "/login/student";
  return "/login/student";
}
