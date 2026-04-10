import React from "react";

type StatColor = "jade" | "ink" | "sunrise" | "sky" | "rose" | "purple";

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: { value: string; positive: boolean };
    color?: StatColor;
    compact?: boolean;
    onClick?: () => void;
    subtitle?: React.ReactNode;
}

const colorClasses: Record<StatColor, { bg: string; icon: string }> = {
    jade: { bg: "bg-emerald-50 dark:bg-emerald-500/15", icon: "text-emerald-600 dark:text-emerald-300" },
    ink: { bg: "bg-slate-100 dark:bg-slate-800", icon: "text-slate-600 dark:text-slate-200" },
    sunrise: { bg: "bg-amber-50 dark:bg-amber-500/15", icon: "text-amber-600 dark:text-amber-300" },
    sky: { bg: "bg-sky-50 dark:bg-sky-500/15", icon: "text-sky-600 dark:text-sky-300" },
    rose: { bg: "bg-rose-50 dark:bg-rose-500/15", icon: "text-rose-600 dark:text-rose-300" },
    purple: { bg: "bg-purple-50 dark:bg-purple-500/15", icon: "text-purple-600 dark:text-purple-300" },
};

export default function StatCard({ label, value, icon, trend, color = "jade", compact = false, onClick, subtitle }: StatCardProps) {
    const c = colorClasses[color];

    if (compact) {
        return (
            <div
                className={`group rounded-xl bg-white p-3.5 shadow-card border border-slate-200/70 transition-all duration-250 hover:shadow-card-hover dark:bg-slate-900/80 dark:border-slate-800 ${onClick ? "cursor-pointer" : ""}`}
                onClick={onClick}
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg} ${c.icon} transition-transform duration-250 group-hover:scale-110 flex-shrink-0`}>
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 truncate">{label}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`group rounded-2xl bg-white p-5 shadow-card border border-slate-200/70 transition-all duration-250 hover:shadow-card-hover dark:bg-slate-900/80 dark:border-slate-800 ${onClick ? "cursor-pointer" : ""}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                    {trend && (
                        <p className={`text-xs font-semibold ${trend.positive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-500 dark:text-rose-300"}`}>
                            {trend.positive ? "↑" : "↓"} {trend.value}
                        </p>
                    )}
                    {subtitle && <div className="mt-1">{subtitle}</div>}
                </div>
                {icon && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.icon} transition-transform duration-250 group-hover:scale-110`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}
