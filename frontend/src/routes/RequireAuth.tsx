import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import type { RoleType } from "../types/auth";
import { isAdminRole } from "../utils/role";

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
    return <Navigate to="/login" state={{ from: location }} replace />;
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
