import { useRef } from "react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Button from "../../components/Button";
import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { useAsync } from "../../hooks/useAsync";
import { getStudentDashboard, StudentDashboardData } from "../../services/api/dashboard";
import { useQuery } from "@tanstack/react-query";
import { getStudentMe } from "../../services/api/students";
import { getStudentFeeStatus } from "../../services/api/fee";
import StatusBadge from "../../components/StatusBadge";
import { SkeletonDashboard } from "../../components/Skeleton";

function toSnakeCase(value?: string | null) {
  if (!value) return "—";
  return value
    .trim()
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function StudentDashboard() {
  const { data, loading, error, refresh } = useAsync<StudentDashboardData>(getStudentDashboard, []);
  const studentQuery = useQuery({ queryKey: ["student", "me"], queryFn: getStudentMe });
  const feeQuery = useQuery({
    queryKey: ["fee-status", studentQuery.data?.id],
    queryFn: () => getStudentFeeStatus(studentQuery.data?.id as string),
    enabled: Boolean(studentQuery.data?.id),
  });
  const idCardRef = useRef<HTMLDivElement | null>(null);

  if (loading) return <SkeletonDashboard />;
  if (error) return (
    <Card>
      <div className="flex items-center gap-3">
        <p className="text-sm text-rose-500">{error}</p>
        <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2" onClick={refresh}>Retry</button>
      </div>
    </Card>
  );

  const att = data?.attendanceSummary;
  const attPercent = att?.attendancePercentage ?? 0;
  const feeStatus = feeQuery.data?.status ?? "PENDING";
  const totalFee = feeQuery.data?.totalAmount ?? 0;
  const paidFee = feeQuery.data?.paidAmount ?? 0;
  const remainingFee = Math.max(totalFee - paidFee, 0);
  const feeVariant = feeStatus === "PAID" ? "success" : feeStatus === "PARTIAL" ? "warning" : "danger";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 animate-slide-up" ref={idCardRef}>

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 shadow-glow p-6 sm:p-8 border border-emerald-400/30">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-400/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <p className="text-emerald-100 text-sm font-medium mb-1">{greeting} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Student Space
            </h1>
            <p className="mt-1.5 text-emerald-50 text-sm font-medium max-w-lg">
              Track attendance, prepare for exams, and stay updated with school announcements.
            </p>
            {(data?.currentClassName || data?.currentSectionName) && (
              <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                <span>Class: {data?.currentClassName ?? "—"}</span>
                <span className="opacity-50">•</span>
                <span>Section: {toSnakeCase(data?.currentSectionName)}</span>
                {data?.currentAcademicYear?.label && (
                  <>
                    <span className="opacity-50">•</span>
                    <span>{data.currentAcademicYear.label}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/student/timetable">
              <Button variant="secondary" size="sm" className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur-sm">
                Timetable
              </Button>
            </Link>
            <Link to="/class-teacher">
              <Button variant="secondary" size="sm" className="!bg-white !text-teal-700 hover:!bg-teal-50 !shadow-lg font-bold">
                Class Teacher
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Promotion banners */}
      {data?.promotionStatus === "PROMOTED" && data?.promotionIsFinalClass && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
          🎉 Congratulations! You have completed your final class.
        </div>
      )}
      {data?.promotionCongrats && !data?.promotionIsFinalClass && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
          🎉 Promoted to {data?.currentClassName ?? "new class"}{data?.currentSectionName ? ` • ${toSnakeCase(data.currentSectionName)}` : ""}
        </div>
      )}
      {!data?.promotionCongrats && data?.promotionStatus === "PROMOTED" && !data?.promotionIsFinalClass && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          ⏳ Promotion is being processed. Please check back soon.
        </div>
      )}

      {/* Fee Snapshot */}
      <Card title="Fee Snapshot" subtitle="Payment progress and quick actions">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Total Fee", value: formatCurrency(totalFee) },
              { label: "Paid", value: formatCurrency(paidFee) },
              { label: "Remaining", value: formatCurrency(remainingFee) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:bg-slate-800/50 dark:border-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{item.label}</p>
                <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
              <StatusBadge variant={feeVariant}>{feeStatus}</StatusBadge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Exams unlock after full payment. Admit cards unlock after admin publishes.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/fees/pay"><Button size="sm">Pay Now</Button></Link>
              <Link to="/exam/registration"><Button variant="secondary" size="sm" disabled={feeStatus !== "PAID"}>Register Exam</Button></Link>
              <Link to="/admit-cards"><Button variant="ghost" size="sm">Admit Card</Button></Link>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Overall Attendance"
          value={`${attPercent}%`}
          color={attPercent >= 75 ? "jade" : "sunrise"}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Today's Status"
          value={data?.todaysAttendanceStatus ?? "Not marked"}
          color="sky"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard
          label="Notifications"
          value={data?.unreadNotificationsCount ?? 0}
          color="purple"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
        />
      </div>

      {/* Attendance Breakdown */}
      {att && (
        <Card title="Attendance Breakdown" subtitle="Your register history for the current term">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Present", value: att.presentDays ?? 0, bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
              { label: "Absent", value: att.absentDays ?? 0, bg: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
              { label: "Late", value: att.lateDays ?? 0, bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
              { label: "Half Day", value: att.halfDays ?? 0, bg: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
            ].map((item) => (
              <div key={item.label} className={`flex flex-col items-center justify-center p-5 rounded-xl ${item.bg} border border-white/50 transition-transform hover:scale-105`}>
                <p className="text-3xl font-bold mb-0.5">{item.value}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{item.label}</span>
              </div>
            ))}
          </div>
          {att.riskFlag && (
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-200 p-3.5 dark:bg-rose-500/10 dark:border-rose-500/30">
              <svg className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div>
                <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Attendance Warning</h4>
                <p className="text-xs text-rose-600 mt-0.5 dark:text-rose-400">
                  Your attendance is below the required 75% threshold. Please maintain regular presence.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Notices + Exams */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="Recent Notices" subtitle="Important announcements">
            {data?.recentNotices?.length ? (
              <div className="flex flex-col gap-2.5">
                {data.recentNotices.map((notice) => (
                  <Link key={notice.id} to={`/notices/${notice.id}`} className="group block rounded-xl border border-slate-100 p-3.5 transition-all hover:border-emerald-200 hover:shadow-sm cursor-pointer no-underline dark:border-slate-800 dark:hover:border-emerald-500/30">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors dark:text-slate-100">{notice.title}</p>
                    {notice.noticeType && <StatusBadge variant="info" dot={false}>{notice.noticeType}</StatusBadge>}
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-600 shrink-0 dark:bg-teal-500/15 dark:text-teal-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{circular.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No circulars" description="Circulars will appear once published." compact />
            )}
          </Card>
        </div>

        <Card title="Upcoming Exams" subtitle="Prepare for your next tests">
          {data?.upcomingExams?.length ? (
            <div className="relative">
              <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              <div className="flex flex-col gap-4 pl-2">
                {data.upcomingExams.map((exam) => (
                  <div key={`${exam.examId}-${exam.subject}-${exam.date}`} className="relative pl-9">
                    <div className="absolute left-2 mt-1.5 w-2.5 h-2.5 bg-white border-2 border-emerald-500 rounded-full shadow-sm z-10 box-content dark:bg-slate-900"></div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-card transition hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {exam.subject} <span className="text-slate-400 font-medium ml-1 text-xs">• {exam.examTitle}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md dark:bg-slate-800 dark:text-slate-400">
                          {new Date(exam.date).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md dark:bg-slate-800 dark:text-slate-400">
                          {exam.startTime ?? "TBA"}
                        </span>
                        {exam.roomNumber && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md dark:bg-emerald-500/15 dark:text-emerald-400">
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

      {/* Promotion Summary */}
      {data?.promotionStatus && (
        <Card title="Promotion Summary" subtitle="Your latest promotion update.">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge variant={data.promotionStatus === "PROMOTED" ? "success" : "warning"} dot={false}>{data.promotionStatus}</StatusBadge>
            {data.currentClassName && <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Class: {data.currentClassName}</span>}
            {data.currentSectionName && <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Section: {toSnakeCase(data.currentSectionName)}</span>}
            <Link to="/student/promotion"><Button variant="secondary" size="sm">View Details</Button></Link>
          </div>
        </Card>
      )}
    </div>
  );
}
