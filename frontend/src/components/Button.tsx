import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type ButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-sky-500 to-sky-600 text-white hover:from-sky-400 hover:to-sky-500 shadow-[0_2px_12px_-4px_rgba(14,165,233,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] border-t border-white/20 border-b border-sky-700/80 active:translate-y-[1px] active:shadow-none disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent disabled:shadow-none",
  secondary:
    "bg-white border border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] active:translate-y-[1px] disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 disabled:shadow-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:shadow-none",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:translate-y-[1px] disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-800",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white hover:from-rose-400 hover:to-rose-500 shadow-[0_2px_12px_-4px_rgba(225,29,72,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-rose-600 active:translate-y-[1px] disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
  success:
    "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-[0_2px_12px_-4px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-emerald-600 active:translate-y-[1px] disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
  warning:
    "bg-gradient-to-b from-amber-400 to-amber-500 text-white hover:from-amber-300 hover:to-amber-400 shadow-[0_2px_12px_-4px_rgba(245,158,11,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-amber-500 active:translate-y-[1px] disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[13px] gap-1.5",
  md: "px-5 py-[11px] text-[14.5px] gap-2",
  lg: "px-6 py-[13px] text-base gap-2.5",
};

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  iconOnly = false,
  className,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-[14px] font-semibold transition-all duration-200 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? "w-full" : ""} ${iconOnly ? "!p-2.5" : ""} ${className ?? ""}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="h-[1em] w-[1em] animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="opacity-90">Processing...</span>
        </>
      ) : children}
    </button>
  );
}
