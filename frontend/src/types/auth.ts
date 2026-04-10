export type RoleType =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ACADEMIC_SUB_ADMIN"
  | "FINANCE_SUB_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export interface Role {
  id: string;
  roleType: RoleType;
  name?: string | null;
}

export interface User {
  id: string;
  email?: string | null;
  mobile?: string | null;
  schoolId?: string | null;
  roleId: string;
  role: Role;
  mustChangePassword?: boolean;
  phoneVerified?: boolean;
  restricted?: boolean;
}

export interface AuthPayload {
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
  user: User;
}
