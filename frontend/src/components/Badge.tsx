import React from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "purple";
type BadgeSize = "sm" | "md";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: React.ReactNode;
};

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  danger: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  info: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  purple: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export default function Badge({ tone = "neutral", size = "md", icon, className, children, ...props }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${toneStyles[tone]} ${sizeStyles[size]} ${className ?? ""}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
