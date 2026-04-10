import React from "react";
import { NavLink } from "react-router-dom";
import type { RoleType } from "../types/auth";

interface MobileBottomNavProps {
    role: RoleType | null;
    unreadCount?: number;
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    showBadge?: boolean;
}

const dashboardIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);

const classroomIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);

const notificationIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
);

const timetableIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const settingsIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const attendanceIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const studentIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const teacherIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
);

function getNavItems(role: RoleType | null): NavItem[] {
    const base: NavItem[] = [
        { label: "Home", path: "/", icon: dashboardIcon },
    ];

    if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "ACADEMIC_SUB_ADMIN") {
        base.push({ label: "Student", path: "/admin/students", icon: studentIcon });
        base.push({ label: "Teacher", path: "/admin/teachers", icon: teacherIcon });
        base.push({ label: "Alerts", path: "/notifications", icon: notificationIcon, showBadge: true });
        base.push({ label: "Profile", path: "/admin/settings", icon: settingsIcon });
    } else if (role === "TEACHER") {
        base.push({ label: "Classroom", path: "/classroom", icon: classroomIcon });
        base.push({ label: "Timetable", path: "/teacher/timetable", icon: timetableIcon });
        base.push({ label: "Attendance", path: "/teacher/attendance", icon: attendanceIcon });
        base.push({ label: "Alerts", path: "/notifications", icon: notificationIcon, showBadge: true });
    } else if (role === "STUDENT") {
        base.push({ label: "Classroom", path: "/classroom", icon: classroomIcon });
        base.push({ label: "Timetable", path: "/student/timetable", icon: timetableIcon });
        base.push({ label: "Alerts", path: "/notifications", icon: notificationIcon, showBadge: true });
        base.push({ label: "Profile", path: "/admin/settings", icon: settingsIcon });
    } else if (role === "PARENT") {
        base.push({ label: "Classroom", path: "/classroom", icon: classroomIcon });
        base.push({ label: "Timetable", path: "/parent/timetable", icon: timetableIcon });
        base.push({ label: "Alerts", path: "/notifications", icon: notificationIcon, showBadge: true });
        base.push({ label: "Profile", path: "/parent/profile", icon: settingsIcon });
    } else {
        base.push({ label: "Alerts", path: "/notifications", icon: notificationIcon, showBadge: true });
        base.push({ label: "Profile", path: "/admin/settings", icon: settingsIcon });
    }

    return base;
}

export default function MobileBottomNav({ role, unreadCount = 0 }: MobileBottomNavProps) {
    const items = getNavItems(role);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-bottom-nav safe-bottom dark:bg-slate-950/95 dark:border-slate-800">
            <div className="flex items-center justify-around px-2 py-1.5">
                {items.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/"}
                        className={({ isActive }) =>
                            `relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${isActive
                                ? "text-sky-600 dark:text-sky-400"
                                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                                    {item.icon}
                                </div>
                                <span className={`text-[10px] font-semibold ${isActive ? "text-sky-600 dark:text-sky-400" : ""}`}>
                                    {item.label}
                                </span>
                                {item.showBadge && unreadCount > 0 && (
                                    <span className="absolute -top-0.5 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                                {isActive && (
                                    <div className="absolute -bottom-1.5 w-5 h-0.5 rounded-full bg-sky-500" />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
