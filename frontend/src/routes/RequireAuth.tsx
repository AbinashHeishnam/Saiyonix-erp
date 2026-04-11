import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import type { RoleType } from "../types/auth";
import { isAdminRole } from "../utils/role";
import { getLoginPathForRoles } from "../utils/authRedirect";
import { allFeatures } from "./featureMap";

export default function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: RoleType[];
}) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();
  const isRestricted = Boolean(user?.restricted);
  const pathname = location.pathname;

  const normalizePath = (value: string) => {
    const trimmed = value.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
  };

  const resolveRolesFromPath = (path: string) => {
    const target = normalizePath(path);
    const exact = allFeatures.find((item) => normalizePath(item.path) === target);
    if (exact) return exact.roles;
    const candidates = allFeatures.filter((item) => {
      const base = normalizePath(item.path);
      return target === base || target.startsWith(`${base}/`);
    });
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => normalizePath(b.path).length - normalizePath(a.path).length);
    return candidates[0].roles;
  };

  const resolveLoginPathFromIntent = (path: string) => {
    const target = normalizePath(path);
    if (target === "/teacher" || target.startsWith("/teacher/")) return "/login/teacher";
    if (target === "/admin" || target.startsWith("/admin/")) return "/login/admin";
    if (target === "/student" || target.startsWith("/student/")) return "/login/student";
    if (target === "/parent" || target.startsWith("/parent/")) return "/login/student";
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500"></div>
          <p className="text-sm font-semibold text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const inferredRoles = roles ?? resolveRolesFromPath(pathname);
    const intentPath = roles ? null : resolveLoginPathFromIntent(pathname);
    const loginPath = intentPath ?? getLoginPathForRoles(inferredRoles);
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  const isSetupRoute = location.pathname === "/setup-account";
  const isAdminSetupRoute = location.pathname === "/admin-setup";
  const needsSetup =
    user.role?.roleType === "TEACHER" &&
    (user.mustChangePassword || !user.phoneVerified);
  const needsAdminSetup =
    isAdminRole(user.role?.roleType) && user.mustChangePassword;

  if (needsSetup && !isSetupRoute) {
    return <Navigate to="/setup-account" replace />;
  }

  if (isSetupRoute && !needsSetup) {
    return <Navigate to="/" replace />;
  }

  if (needsAdminSetup && !isAdminSetupRoute) {
    return <Navigate to="/admin-setup" replace />;
  }

  if (isAdminSetupRoute && !needsAdminSetup) {
    return <Navigate to="/" replace />;
  }

  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isRestricted && location.pathname !== "/certificates") {
    return <Navigate to="/certificates" replace />;
  }

  return <>{children}</>;
}
