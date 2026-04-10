import React from "react";
import { Link } from "react-router-dom";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Button from "../../components/Button";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import { SkeletonDashboard } from "../../components/Skeleton";
import { useAsync } from "../../hooks/useAsync";
import { getTeacherDashboard, TeacherDashboardData } from "../../services/api/dashboard";
import { getTeacherUnread, TeacherUnreadItem, getUnreadCount } from "../../services/api/messages";

export default function TeacherDashboard() {
  const { data, loading, error, refresh } = useAsync<TeacherDashboardData>(getTeacherDashboard, []);
  const { data: unreadMessages } = useAsync<TeacherUnreadItem[]>(getTeacherUnread, []);
  const { data: unreadCount, refresh: refreshUnread } = useAsync<number>(getUnreadCount, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refresh();
      refreshUnread();
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh, refreshUnread]);

  if (loading) return <SkeletonDashboard />;
  if (error) return (
    <Card>
      <div className="flex items-center gap-3">
        <p className="text-sm text-rose-500">{error}</p>
        <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2" onClick={refresh}>Retry</button>
      </div>
    </Card>
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 animate-slide-up">

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 shadow-glow p-6 sm:p-8 border border-indigo-500/30">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-32 w-48 h-48 bg-blue-400/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <p className="text-indigo-200 text-sm font-medium mb-1">{greeting} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Teacher Dashboard
            </h1>
            <p className="mt-1.5 text-indigo-100 text-sm font-medium max-w-lg">
              Manage your daily classes, monitor students, and track communications.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {data?.currentAcademicYear?.label && (
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                  {data.currentAcademicYear.label}
                </span>
              )}
              {data?.classTeacherSections?.map((section) => (
                <span
                  key={section.id}
                  className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm"
                >
                  CT: {section.className ?? "Class"} {section.sectionName ?? ""}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/teacher/timetable">
              <Button variant="secondary" size="sm" className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur-sm">
                Timetable
              </Button>
            </Link>
            <Link to="/teacher/leave">
              <Button variant="secondary" size="sm" className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur-sm">
                Apply Leave
              </Button>
            </Link>
            <Link to="/teacher/messages">
              <Button variant="secondary" size="sm" className="!bg-white !text-indigo-700 hover:!bg-indigo-50 !shadow-lg font-bold">
                Messages {unreadCount ? <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">{unreadCount}</span> : ""}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Today's Classes"
          value={data?.todaysClasses?.length ?? 0}
          color="sky"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
        />
        <StatCard
          label="At-Risk Students"
          value={data?.atRiskStudents?.length ?? 0}
          color="sunrise"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        />
        <StatCard
          label="Unread Notifications"
          value={data?.unreadNotificationsCount ?? 0}
          color="purple"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
        />
      </div>

      {/* Schedule + Messages */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Today's Schedule" subtitle="Your period timeline">
          {data?.todaysClasses?.length ? (
            <div className="flex flex-col gap-2.5">
              {data.todaysClasses.map((slot: any, index: number) => (
                <div
                  key={slot.id ?? `${slot.periodNumber ?? "period"}-${slot.subjectName ?? "subject"}-${index}`}
                  className="group relative flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5 transition-all hover:bg-white hover:shadow-card-hover hover:border-indigo-200 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 text-sm font-bold dark:bg-indigo-500/20 dark:text-indigo-300">
                      P{slot.periodNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {slot.subjectName ?? "Subject"}
                      </p>
                      {slot.isSubstitution && slot.label && (
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{slot.label}</p>
                      )}
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {slot.periodStartTime && slot.periodEndTime ? `${slot.periodStartTime} - ${slot.periodEndTime} • ` : ""}
                        {slot.className ?? ""} {slot.sectionName ?? ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {slot.isSubstitution && (
                      <StatusBadge variant="warning" dot={false}>Sub</StatusBadge>
                    )}
                    {slot.roomNo && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {slot.roomNo}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No classes today" description="Enjoy your day off!" />
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="New Messages" subtitle="Unread communications">
            {unreadMessages?.length ? (
              <div className="flex flex-col gap-2.5">
                {unreadMessages.slice(0, 3).map((msg, index) => (
                  <div
                    key={msg.id ?? `${msg.senderName ?? "sender"}-${index}`}
                    className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 transition-all hover:shadow-sm dark:bg-slate-800/50 dark:border-slate-700"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{msg.senderName}</p>
                      <StatusBadge variant="neutral" dot={false}>{msg.senderRole}</StatusBadge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed dark:text-slate-400">{msg.messageText}</p>
                  </div>
                ))}
                <Link to="/teacher/messages" className="inline-flex items-center justify-center w-full mt-1 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-400">
                  View All Messages →
                </Link>
              </div>
            ) : (
              <EmptyState title="No new messages" description="All caught up!" compact />
            )}
          </Card>

          <Card title="At-Risk Students" subtitle="Attendance below 75%">
            {data?.atRiskStudents?.length ? (
              <div className="flex flex-col gap-2">
                {data.atRiskStudents.map((student, index) => (
                  <div
                    key={student.studentId ?? `${student.studentName ?? "student"}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-amber-50/50 border border-amber-100 p-3 dark:bg-amber-500/5 dark:border-amber-500/20"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{student.studentName ?? "Unknown"}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{student.className ?? ""} {student.sectionName ?? ""}</p>
                    </div>
                    <StatusBadge variant={student.attendancePercentage < 75 ? "danger" : "warning"}>
                      {student.attendancePercentage}%
                    </StatusBadge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="All clear" description="All students are on track." compact />
            )}
          </Card>
        </div>
      </div>

      {/* Recent Notices */}
      <Card title="Recent Notices" subtitle="School-wide announcements">
        {data?.recentNotices?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recentNotices.map((notice, index) => (
              <Link
                key={notice.id ?? `${notice.title ?? "notice"}-${index}`}
                to={`/notices/${notice.id}`}
                className="group flex flex-col justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-card transition-all hover:shadow-card-hover cursor-pointer no-underline dark:bg-slate-900 dark:border-slate-800"
              >
                <div>
                  {notice.noticeType && (
                    <StatusBadge variant="info" dot={false}>{notice.noticeType}</StatusBadge>
                  )}
                  <p className="mt-2 text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors dark:text-slate-100">{notice.title}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No active notices" description="Check back later." />
        )}
      </Card>
    </div>
  );
}
