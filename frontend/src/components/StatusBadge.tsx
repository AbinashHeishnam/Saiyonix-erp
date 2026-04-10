import React from "react";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "active" | "inactive";

const variants: Record<StatusVariant, string> = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    warning: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    danger: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
    info: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    inactive: "bg-slate-100 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700",
};

interface StatusBadgeProps {
    variant?: StatusVariant;
    children: React.ReactNode;
    dot?: boolean;
}

export default function StatusBadge({ variant = "neutral", children, dot = true }: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${variants[variant]}`}
        >
            {dot && (
                <span className={`h-1.5 w-1.5 rounded-full ${variant === "success" || variant === "active" ? "bg-emerald-500" :
                        variant === "warning" ? "bg-amber-500" :
                            variant === "danger" ? "bg-rose-500" :
                                variant === "info" ? "bg-sky-500" :
                                    "bg-slate-400"
                    }`} />
            )}
            {children}
        </span>
    );
}
