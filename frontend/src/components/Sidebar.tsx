import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import type { RoleType } from "../types/auth";
import { featureGroups } from "../routes/featureMap";
import { useSchoolBranding } from "../hooks/useSchoolBranding";
import SecureImage from "./SecureImage";
import { useAuth } from "../contexts/AuthContext";
import { getUnreadCount } from "../services/api/notifications";

const categoryIcons: Record<string, React.ReactNode> = {
  CORE: <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  ACADEMIC: <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  "ADMIN CONTROL": <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  FINANCE: <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ANALYTICS: <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  SYSTEM: <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

interface SidebarProps {
  role: RoleType | null;
  restricted?: boolean;
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function SidebarContent({
  role,
  restricted,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  role: RoleType | null;
  restricted?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
  const [navSearch, setNavSearch] = useState("");
  const { branding } = useSchoolBranding();
  const { user } = useAuth();
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

  const visibleGroups = restricted
    ? (() => {
      const certificateItem = featureGroups
        .flatMap((group) => group.items)
        .find((item) => item.key === "certificates");
      if (!certificateItem || !role || !certificateItem.roles.includes(role)) {
        return [];
      }
      return [
        {
          title: "CORE",
          items: [certificateItem],
        },
      ];
    })()
    : featureGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          role
            ? item.roles.includes(role) && (role !== "PARENT" || item.page.type !== "coming-soon")
            : false
        ),
      }))
      .filter((group) => group.items.length > 0);

  // Filter by nav search
  const filteredGroups = navSearch.trim()
    ? visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(navSearch.toLowerCase())
        ),
      }))
      .filter((group) => group.items.length > 0)
    : visibleGroups;

  const toggle = (title: string) => {
    setSectionCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200/80 relative dark:bg-slate-950 dark:border-slate-800">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-5 ${collapsed ? "px-3" : ""}`}>
        <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? "justify-center w-full" : ""}`}>
          <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-shrink-0 ${collapsed ? "h-9 w-9" : "h-10 w-10"}`}>
            {branding.logoUrl ? (
              <SecureImage fileUrl={branding.logoUrl} alt="School logo" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">
                {(branding.schoolName ?? "S").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="relative min-w-0">
              <h1 className="relative font-display font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {branding.schoolName}
              </h1>
              <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400 dark:text-slate-500">
                School Platform
              </p>
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 lg:hidden shadow-sm dark:bg-slate-900 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav Search (desktop only, not collapsed) */}
      {!collapsed && !onClose && (
        <div className="px-4 pb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 focus:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-6 ${collapsed ? "px-2" : ""}`}>
        {filteredGroups.map((group) => {
          const isGroupCollapsed = sectionCollapsed[group.title];
          return (
            <div key={group.title} className="flex flex-col gap-0.5">
              {!collapsed && (
                <button
                  onClick={() => toggle(group.title)}
                  className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 transition hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300 mt-3 first:mt-0"
                >
                  <div className="text-slate-300 group-hover:text-sky-500 transition-colors dark:text-slate-600 dark:group-hover:text-sky-400">
                    {categoryIcons[group.title]}
                  </div>
                  <span className="flex-1 text-left">{group.title}</span>
                  <svg
                    className={`h-3 w-3 transition-transform duration-300 ${isGroupCollapsed ? "" : "rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {(collapsed || !isGroupCollapsed) && (
                <div className={`flex flex-col gap-0.5 animate-fade-in ${collapsed ? "" : "ml-1 pl-2 border-l border-slate-200/50 dark:border-slate-800/60"}`}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-xl text-[13px] font-semibold transition-all duration-200 overflow-hidden ${collapsed ? "justify-center px-2.5 py-2.5" : "px-3.5 py-2.5"} ${isActive
                          ? "text-sky-700 bg-sky-50 ring-1 ring-sky-100 dark:text-sky-300 dark:bg-slate-900 dark:ring-slate-700"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-900/60"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <div className="absolute left-0 w-1 h-5 bg-sky-500 rounded-r-full" />}

                          {!collapsed && <span className="relative z-10 block truncate">{item.label}</span>}
                          {!collapsed && item.key === "notifications" && unreadCount > 0 && (
                            <span className="relative z-10 ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                              {unreadCount}
                            </span>
                          )}

                          {!collapsed && item.page.type === "coming-soon" && role !== "PARENT" && (
                            <span className="relative z-10 ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-800 dark:text-slate-500">Soon</span>
                          )}

                          {collapsed && item.key === "notifications" && unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-rose-500 text-[8px] font-bold text-white flex items-center justify-center">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer with collapse toggle */}
      <div className={`border-t border-slate-200/70 dark:border-slate-800 ${collapsed ? "p-2" : "px-4 py-3"}`}>
        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`flex items-center justify-center w-full rounded-xl py-2 text-slate-400 transition hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 dark:hover:text-slate-300 ${collapsed ? "px-2" : "gap-2 px-3"}`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          </button>
        )}
        {!collapsed && !onToggleCollapse && (
          <div className="rounded-xl bg-slate-50 shadow-sm ring-1 ring-slate-200/80 px-4 py-3 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{branding.schoolName}</p>
                <p className="text-[10px] font-medium text-slate-400 tracking-wide dark:text-slate-500">v1.0 • Pro</p>
              </div>
              {branding.logoUrl && (
                <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                  <SecureImage fileUrl={branding.logoUrl} alt="School logo" className="h-full w-full object-contain" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ role, restricted, open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block flex-shrink-0 border-none bg-white relative z-40 dark:bg-slate-950 transition-all duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-72"}`}
      >
        <div className="sticky top-0 h-screen overflow-hidden border-r border-slate-200/80 dark:border-slate-800">
          <SidebarContent role={role} restricted={restricted} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-[80vw] max-w-[300px] bg-white shadow-2xl animate-slide-in-right dark:bg-slate-950">
            <SidebarContent role={role} restricted={restricted} onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
