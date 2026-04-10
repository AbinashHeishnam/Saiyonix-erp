import type { RoleType } from "../types/auth";
import { allFeatures } from "./featureMap";

export type NavItem = {
  label: string;
  path: string;
  roles: RoleType[];
};

export const navItems: NavItem[] = allFeatures.map((item) => ({
  label: item.label,
  path: item.path,
  roles: item.roles,
}));
