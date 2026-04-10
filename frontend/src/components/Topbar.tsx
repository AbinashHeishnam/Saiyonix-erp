import { Link } from "react-router-dom";
import type { RoleType, User } from "../types/auth";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "../services/api/notifications";

const roleLabels: Record<RoleType, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "School Admin",
  ACADEMIC_SUB_ADMIN: "Academic Admin",
  FINANCE_SUB_ADMIN: "Finance Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

const roleColors: Record<RoleType, string> = {
  SUPER_ADMIN: "bg-gradient-to-r from-slate-800 to-slate-700 text-white",
  ADMIN: "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white",
  ACADEMIC_SUB_ADMIN: "bg-gradient-to-r from-sky-600 to-sky-500 text-white",
  FINANCE_SUB_ADMIN: "bg-gradient-to-r from-amber-600 to-amber-500 text-white",
  TEACHER: "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white",
  STUDENT: "bg-gradient-to-r from-sky-600 to-sky-500 text-white",
  PARENT: "bg-gradient-to-r from-rose-600 to-rose-500 text-white",
};

interface TopbarProps {
  user: User | null;
  role: RoleType | null;
  onLogout: () => void;
  onMenuToggle: () => void;
}

export default function Topbar({ user, role, onLogout, onMenuToggle }: TopbarProps) {
  const isRestricted = Boolean(user?.restricted);
  const { data: unreadData } = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: getUnreadCount,
    enabled: Boolean(user) && !isRestricted,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, err: any) => {
      if (err?.response?.status === 429) return false;
      return count < 1;
    },
  });
  const unreadCount = typeof unreadData?.count === "number" ? unreadData.count : 0;

  return (
    <header className="sticky top-0 z-[45] flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-card dark:bg-slate-900/80 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 text-slate-500 transition-all active:scale-95 hover:bg-slate-50 hover:text-sky-600 lg:hidden dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile Branding (visible only on small screens) */}
        <Link to="/" className="sm:hidden flex items-center">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">ERP</span>
        </Link>

        <div className="hidden sm:block">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {role && (
          <span className={`hidden rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide sm:inline-flex shadow-sm ${roleColors[role]}`}>
            {roleLabels[role]}
          </span>
        )}

        {/* Notification bell */}
        {!isRestricted && (
          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm border border-slate-200 transition-all hover:bg-slate-50 hover:text-slate-700 active:scale-95 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Notifications"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        )}

        <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm border border-slate-200 transition hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 text-[10px] font-bold text-white shadow-sm">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="hidden text-xs font-bold text-slate-700 sm:inline truncate max-w-[120px] dark:text-slate-200">
            {user?.email?.split("@")[0] ?? "User"}
          </span>
          <button
            onClick={onLogout}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500 active:scale-95 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            title="Sign out"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
