import type { RoleType } from "../types/auth";

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
