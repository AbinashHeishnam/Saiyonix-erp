import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import StatCard from "../../components/StatCard";
import { SkeletonDashboard } from "../../components/Skeleton";
import { useAsync } from "../../hooks/useAsync";
import { listNotices } from "../../services/api/notices";

export default function FinanceSubAdminDashboard() {
    const { data, loading, error, refresh } = useAsync(async () => {
        const noticesRes = await listNotices({ page: 1, limit: 5 });
        return { notices: noticesRes?.data ?? noticesRes ?? [] };
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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 shadow-glow p-6 sm:p-8 border border-orange-400/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Finance Dashboard
                    </h1>
                    <p className="text-orange-50 text-sm font-medium max-w-lg">
                        Monitor fee collections, oversee structural payments, and generate automated financial reports.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Fee Module Status"
                    value="Standby"
                    color="jade"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard
                    label="Payments Logged"
                    value="—"
                    color="sky"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                />
                <StatCard
                    label="Recent Notices"
                    value={data?.notices?.length ?? 0}
                    color="purple"
                    icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Quick Operations" subtitle="Financial shortcuts">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Fee Management", href: "/admin/fees", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
                            { label: "Payments", href: "/admin/payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", color: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
                            { label: "Scholarships", href: "/admin/scholarships", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z", color: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
                            { label: "Notices", href: "/notices", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z", color: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
                        ].map((a) => (
                            <a key={a.label} href={a.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 transition-all hover:border-amber-200 hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800 dark:hover:border-amber-500/30">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.color} transition-transform group-hover:scale-110`}>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} /></svg>
                                </span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.label}</span>
                            </a>
                        ))}
                    </div>
                </Card>

                <Card title="Recent Notices" subtitle="System broadcasts">
                    {data?.notices?.length ? (
                        <div className="flex flex-col gap-2.5">
                            {data.notices.map((n: { id: string; title: string }) => (
                                <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-white dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="No notices" compact />
                    )}
                </Card>
            </div>
        </div>
    );
}
