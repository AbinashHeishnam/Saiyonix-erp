import React from "react";

type AccentColor = "blue" | "purple" | "rose" | "emerald" | "amber" | "sky";

interface ChartCardProps {
    title: string;
    subtitle?: string;
    accent?: AccentColor;
    children: React.ReactNode;
    className?: string;
    actions?: React.ReactNode;
    height?: string;
}

const accentColors: Record<AccentColor, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
};

export default function ChartCard({
    title,
    subtitle,
    accent = "blue",
    children,
    className = "",
    actions,
    height = "h-72",
}: ChartCardProps) {
    return (
        <div className={`rounded-2xl bg-white p-6 shadow-card border border-slate-100 dark:bg-slate-900 dark:border-slate-800 ${className}`}>
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center">
                        <div className={`accent-bar ${accentColors[accent]}`} />
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-[1.125rem]">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            <div className={`${height} w-full`}>
                {children}
            </div>
        </div>
    );
}
