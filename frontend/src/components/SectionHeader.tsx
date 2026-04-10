import React from "react";

type AccentColor = "blue" | "purple" | "rose" | "emerald" | "amber" | "sky" | "slate";

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    accent?: AccentColor;
    actions?: React.ReactNode;
    className?: string;
}

const accentColors: Record<AccentColor, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    slate: "bg-slate-400",
};

export default function SectionHeader({
    title,
    subtitle,
    accent = "slate",
    actions,
    className = "",
}: SectionHeaderProps) {
    return (
        <div className={`flex items-center justify-between ${className}`}>
            <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center">
                    <div className={`accent-bar ${accentColors[accent]}`} />
                    {title}
                </h3>
                {subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-[1.125rem]">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
