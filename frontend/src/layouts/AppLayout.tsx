import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MobileBottomNav from "../components/MobileBottomNav";
import { getUnreadCount } from "../services/api/notifications";

export default function AppLayout() {
  const { role, user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

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

  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
    } catch { }
  }, [sidebarCollapsed]);

  return (
    <div className="flex min-h-screen min-h-[100dvh] text-slate-900 dark:text-slate-100">
      <Sidebar
        role={role}
        restricted={user?.restricted}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <main className="flex flex-1 flex-col min-w-0">
        <div className="sticky top-0 z-30 px-3 pt-3 pb-2 lg:px-6">
          <Topbar
            user={user}
            role={role}
            onLogout={logout}
            onMenuToggle={() => setSidebarOpen(true)}
          />
        </div>
        <div className="flex-1 px-3 pb-20 pt-1 lg:px-6 lg:pb-10">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </div>
      </main>
      <MobileBottomNav role={role} unreadCount={unreadCount} />
    </div>
  );
}
