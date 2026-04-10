import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
import ChartCard from "../../components/ChartCard";
import EmptyState from "../../components/EmptyState";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { SkeletonDashboard } from "../../components/Skeleton";
import { useAsync } from "../../hooks/useAsync";
import { getSchoolAnalytics } from "../../services/api/analytics";
import { listNotices } from "../../services/api/notices";
import { listAcademicYears } from "../../services/api/metadata";
import { getActiveAcademicYear } from "../../utils/academicYear";
import { useEffect, useMemo, useState } from "react";

export default function AdminDashboard() {
  const [academicYearId, setAcademicYearId] = useState("");
  const { data: yearData } = useAsync(listAcademicYears, []);

  const years = useMemo(() => {
    if (Array.isArray(yearData)) return yearData;
    if (Array.isArray((yearData as any)?.items)) return (yearData as any).items;
    if (Array.isArray((yearData as any)?.data?.items)) return (yearData as any).data.items;
    if (Array.isArray((yearData as any)?.data)) return (yearData as any).data;
    return [];
  }, [yearData]);

  const activeYear = useMemo(() => getActiveAcademicYear(years), [years]);

  useEffect(() => {
    if (!academicYearId && activeYear?.id) {
      setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, activeYear?.id]);

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!academicYearId) {
      return { analytics: null, notices: [] };
    }
    const [analyticsRes, noticesRes] = await Promise.allSettled([
      getSchoolAnalytics({ academicYearId }),
      listNotices({ page: 1, limit: 5 }),
    ]);

    const analytics = analyticsRes.status === "fulfilled" ? analyticsRes.value : null;
    const notices = noticesRes.status === "fulfilled" ? (noticesRes.value?.data ?? noticesRes.value ?? []) : [];

    return { analytics, notices };
  }, [academicYearId]);

  if (loading || !academicYearId) return <SkeletonDashboard />;
  if (error || !data?.analytics) return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin Dashboard" subtitle="School overview" />
      <Card>
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-500">Failed to load dashboard metrics.</p>
          <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2" onClick={refresh}>Retry</button>
        </div>
      </Card>
    </div>
  );

  const { analytics, notices } = data;
  const selectedYearLabel =
    years.find((year: any) => year.id === academicYearId)?.label ?? activeYear?.label ?? "Not Set";
  const passFailData = [
    { name: "Pass", value: analytics.performance.passCount, color: "#10b981" },
    { name: "Fail", value: analytics.performance.failCount, color: "#f43f5e" },
  ];
  const passPercentage = analytics.performance.passCount + analytics.performance.failCount > 0
    ? Math.round((analytics.performance.passCount / (analytics.performance.passCount + analytics.performance.failCount)) * 100)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{greeting} 👋</p>
          <PageHeader title="Executive Dashboard" subtitle="Real-time insights into your school's operations" />
        </div>
        <div className="flex flex-col gap-2 md:items-end flex-shrink-0">
          <AcademicYearFilter
            value={academicYearId}
            onChange={setAcademicYearId}
            syncQueryKey="academicYearId"
            years={years}
          />
          <div className="hidden md:block">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{selectedYearLabel}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Enrollments"
          value={analytics.summary.totalStudents}
          color="sky"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          label="Total Faculty"
          value={analytics.summary.totalTeachers}
          color="purple"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <StatCard
          label="Avg. Attendance (14d)"
          value={`${analytics.summary.averageAttendance}%`}
          color="jade"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Global Pass Rate"
          value={`${passPercentage}%`}
          color="sunrise"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Admissions Growth"
          subtitle="Last 6 months trend"
          accent="blue"
          className="lg:col-span-2"
        >
          {analytics.admissionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.admissionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAdmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
                <Area type="monotone" dataKey="admissions" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAdmissions)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">Not enough data collected</div>
          )}
        </ChartCard>

        <ChartCard
          title="Academic Success"
          subtitle={`Exam: ${analytics.performance.examTitle}`}
          accent="purple"
        >
          <div className="h-full w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={passFailData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none">
                  {passFailData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`${value} Students`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{passPercentage}%</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Passed</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Attendance + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard
          title="Attendance Trend"
          subtitle="Last 14 days"
          accent="rose"
          height="h-64"
        >
          {analytics.attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="percentage" stroke="#f43f5e" strokeWidth={3} dot={{ fill: '#f43f5e', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">Not enough attendance logged recently</div>
          )}
        </ChartCard>

        <Card title="Quick Actions" subtitle="Administrative shortcuts">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { label: "New Student", href: "/admin/students", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1", color: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
              { label: "New Teacher", href: "/admin/teachers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
              { label: "Create Notice", href: "/notices", icon: "M7 8h10M7 12h6m-9 8h14a2 2 0 002-2V6a2 2 0 00-2-2H7l-5 5v11a2 2 0 002 2z", color: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
              { label: "Attendance", href: "/admin/student-attendance", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
              { label: "Class Setup", href: "/admin/classes", icon: "M3 7h18M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
              { label: "Settings", href: "/admin/settings", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z", color: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
            ].map((action) => (
              <a key={action.label} href={action.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-sky-200 hover:shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-sky-500/30">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color} transition-transform group-hover:scale-110`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} /></svg>
                </span>
                <span className="truncate">{action.label}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Announcements */}
      <Card title="Recent Announcements" subtitle="Latest school notices">
        {notices?.length ? (
          <ul className="flex flex-col gap-2.5">
            {notices.map((notice: any) => (
              <li key={notice.id}>
                <Link to={`/notices/${notice.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3.5 transition-all hover:bg-slate-50 hover:shadow-sm cursor-pointer no-underline dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{notice.title}</p>
                    {notice.publishedAt && (
                      <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {new Date(notice.publishedAt).toLocaleDateString("en-IN", { month: "long", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  {notice.noticeType && <StatusBadge variant="info" dot={false}>{notice.noticeType}</StatusBadge>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No notices" description="Communicate school updates here." />
        )}
      </Card>
    </div>
  );
}
