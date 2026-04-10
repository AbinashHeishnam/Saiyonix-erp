import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import StatCard from "../../components/StatCard";
import { SkeletonDashboard } from "../../components/Skeleton";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { listNotices } from "../../services/api/notices";
import { listAcademicYears } from "../../services/api/metadata";
import { getActiveAcademicYear } from "../../utils/academicYear";

export default function AcademicSubAdminDashboard() {
    const { data, loading, error, refresh } = useAsync(async () => {
        const yearRes = await listAcademicYears();
        const years = yearRes?.data ?? yearRes ?? [];
        const activeYear = getActiveAcademicYear(years);
        const [examsRes, noticesRes] = await Promise.allSettled([
            api.get("/exams", { params: { page: 1, limit: 5, academicYearId: activeYear?.id } }),
            listNotices({ page: 1, limit: 5 }),
        ]);
        const exams = examsRes.status === "fulfilled" ? (examsRes.value?.data?.data?.data ?? examsRes.value?.data?.data ?? []) : [];
        const notices = noticesRes.status === "fulfilled" ? (noticesRes.value?.data ?? noticesRes.value ?? []) : [];
        return { activeYear, exams, notices };
    }, []);

    if (loading) return <SkeletonDashboard />;
    if (error) return (
        <Card>
            <div className="flex items-center gap-3">
                <p className="text-sm text-rose-500">{error}</p>
                <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2" onClick={refresh}>Retry</button>
            </div>
        </Card>
    );

    return (
        <div className="flex flex-col gap-6 animate-slide-up">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-glow p-6 sm:p-8 border border-purple-500/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Academic Dashboard
                    </h1>
                    <p className="text-purple-100 text-sm font-medium max-w-lg">
                        Manage grading metrics, active exams, syllabus distribution, and core academic parameters.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Academic Year"
                    value={data?.activeYear?.label ?? "Not set"}
                    color="jade"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                />
                <StatCard
                    label="Active Exams"
                    value={data?.exams?.length ?? 0}
                    color="sky"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                />
                <StatCard
                    label="Recent Notices"
                    value={data?.notices?.length ?? 0}
                    color="purple"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Quick Actions" subtitle="Administrative shortcuts">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Manage Exams", href: "/exams", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2", color: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
                            { label: "View Results", href: "/results", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
                            { label: "Syllabus", href: "/admin/syllabus", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
                            { label: "Assignments", href: "/admin/assignments", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
                        ].map((a) => (
                            <a key={a.label} href={a.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 transition-all hover:border-purple-200 hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800 dark:hover:border-purple-500/30">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.color} transition-transform group-hover:scale-110`}>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} /></svg>
                                </span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.label}</span>
                            </a>
                        ))}
                    </div>
                </Card>

                <Card title="Recent Announcements">
                    {data?.notices?.length ? (
                        <div className="flex flex-col gap-2.5">
                            {data.notices.map((n: { id: string; title: string }) => (
                                <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-white dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="No announcements" compact />
                    )}
                </Card>
            </div>
        </div>
    );
}
