import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Button from "../../components/Button";
import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { getParentDashboard, ParentDashboardData } from "../../services/api/dashboard";
import { getUnreadCount } from "../../services/api/messages";
import { useEffect } from "react";
import { SkeletonDashboard } from "../../components/Skeleton";

function toSnakeCase(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

export default function ParentDashboard() {
  const { data, loading, error, refresh } = useAsync<ParentDashboardData>(getParentDashboard, []);
  const { data: unreadCount, refresh: refreshUnread } = useAsync<number>(getUnreadCount, []);

  useEffect(() => {
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-900 to-slate-900 shadow-glow p-6 sm:p-8 border border-indigo-700/50">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-48 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <p className="text-indigo-300 text-sm font-medium mb-1">{greeting} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Parent Dashboard
            </h1>
            <p className="mt-1.5 text-indigo-200 text-sm font-medium max-w-lg">
              Monitor your children's attendance, performance, and school announcements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/parent/profile">
              <Button variant="secondary" size="sm" className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur-sm">
                Family Profile
              </Button>
            </Link>
            <Link to="/parent/leave">
              <Button variant="secondary" size="sm" className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur-sm">
                Apply Leave
              </Button>
            </Link>
            <Link to="/class-teacher">
              <Button variant="secondary" size="sm" className="!bg-white !text-indigo-900 hover:!bg-indigo-50 !shadow-lg font-bold">
                Class Teachers {unreadCount ? <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">{unreadCount}</span> : ""}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Registered Children"
          value={data?.children?.length ?? 0}
          color="jade"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          label="Unread Notifications"
          value={data?.unreadNotificationsCount ?? 0}
          color="purple"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
        />
        <StatCard
          label="Recent Notices"
          value={data?.recentNotices?.length ?? 0}
          color="sky"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
      </div>

      {/* Children Highlights */}
      <Card title="Children Highlights">
        {data?.children?.length ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {data.children.map((child) => {
              const att = child.attendanceSummary?.attendancePercentage ?? 0;
              const isAtRisk = att < 75;
              return (
                <div key={child.studentId} className="relative rounded-2xl bg-white border border-slate-200/80 shadow-card p-5 transition-all hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800">
                  <div className={`absolute top-0 left-0 w-full h-1 rounded-t-2xl ${isAtRisk ? "bg-gradient-to-r from-rose-400 to-amber-400" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`} />

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 tracking-tight dark:text-slate-100">
                        {child.studentName ?? "Student"}
                      </h3>
                      <p className="text-xs font-medium text-slate-400 mt-0.5 dark:text-slate-500">
                        {child.className ?? ""} {toSnakeCase(child.sectionName)}
                        {child.rollNumber != null ? ` • Roll ${child.rollNumber}` : ""}
                        {child.currentAcademicYear?.label ? ` • ${child.currentAcademicYear.label}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xl font-bold ${isAtRisk ? "text-rose-500" : "text-emerald-500"}`}>{att}%</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Attendance</span>
                    </div>
                  </div>

                  {/* Promotion banners */}
                  {child.promotionStatus === "PROMOTED" && child.promotionIsFinalClass && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
                      🎉 Final class completed.
                    </div>
                  )}
                  {child.promotionCongrats && !child.promotionIsFinalClass && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
                      🎉 Promoted to {child.className ?? "new class"}{child.sectionName ? ` • ${toSnakeCase(child.sectionName)}` : ""}
                    </div>
                  )}
                  {!child.promotionCongrats && child.promotionStatus === "PROMOTED" && !child.promotionIsFinalClass && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                      ⏳ Promotion processing.
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                    <span className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase dark:text-slate-400">Today's Presence</span>
                    <StatusBadge
                      variant={
                        child.todaysAttendanceStatus === "PRESENT" ? "success" :
                          child.todaysAttendanceStatus === "ABSENT" ? "danger" :
                            child.todaysAttendanceStatus === "LATE" ? "warning" :
                              "neutral"
                      }
                      dot={false}
                    >
                      {child.todaysAttendanceStatus ?? "Not marked"}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      { l: "Present", v: child.attendanceSummary?.presentDays ?? 0, bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                      { l: "Absent", v: child.attendanceSummary?.absentDays ?? 0, bg: "bg-rose-50 dark:bg-rose-500/10" },
                      { l: "Late", v: child.attendanceSummary?.lateDays ?? 0, bg: "bg-amber-50 dark:bg-amber-500/10" },
                      { l: "Half", v: child.attendanceSummary?.halfDays ?? 0, bg: "bg-sky-50 dark:bg-sky-500/10" },
                    ].map((s) => (
                      <div key={s.l} className={`rounded-lg py-2 ${s.bg}`}>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.v}</p>
                        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No linked students" description="Please ask administration to link your profile to your children." />
        )}
      </Card>

      {/* Notices + Exams */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="Recent Notices" subtitle="Important announcements">
            {data?.recentNotices?.length ? (
              <div className="flex flex-col gap-2.5">
                {data.recentNotices.map((notice) => (
                  <Link key={notice.id} to={`/notices/${notice.id}`} className="group block rounded-xl border border-slate-100 p-3.5 transition-all hover:border-indigo-200 hover:shadow-sm cursor-pointer no-underline dark:border-slate-800 dark:hover:border-indigo-500/30">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors dark:text-slate-100">{notice.title}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No notices" description="New notices will appear here." compact />
            )}
          </Card>

          <Card title="Circulars" subtitle="Official school documents">
            {data?.recentCirculars?.length ? (
              <div className="flex flex-col gap-2.5">
                {data.recentCirculars.map((circular) => (
                  <div key={circular.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 transition-all hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0 dark:bg-indigo-500/15 dark:text-indigo-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{circular.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No circulars" description="Circulars will appear here." compact />
            )}
          </Card>
        </div>

        <Card title="Upcoming Family Exams" subtitle="Track approaching tests">
          {data?.upcomingExams?.length ? (
            <div className="relative">
              <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              <div className="flex flex-col gap-4 pl-2">
                {data.upcomingExams.map((exam) => (
                  <div key={`${exam.examId}-${exam.subject}-${exam.date}-${exam.studentId ?? ""}`} className="relative pl-9">
                    <div className="absolute left-2 mt-1.5 w-2.5 h-2.5 bg-white border-2 border-indigo-500 rounded-full shadow-sm z-10 box-content dark:bg-slate-900"></div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-card transition hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {exam.studentName ?? "Student"} <span className="text-slate-400 font-medium ml-1 text-xs">• {exam.subject}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md dark:bg-slate-800 dark:text-slate-400">
                          {new Date(exam.date).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md dark:bg-slate-800 dark:text-slate-400">
                          {exam.startTime ?? "TBA"}
                        </span>
                        {exam.roomNumber && (
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md dark:bg-indigo-500/15 dark:text-indigo-400">
                            RM {exam.roomNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No exams scheduled" description="Check back later for upcoming exams." />
          )}
        </Card>
      </div>
    </div>
  );
}
