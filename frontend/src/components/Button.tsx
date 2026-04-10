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
    "bg-sky-600 text-white hover:bg-sky-500 shadow-soft border border-sky-600/20 active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
  secondary:
    "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm active:translate-y-0.5 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0.5 disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-800",
  danger:
    "bg-rose-600 text-white hover:bg-rose-500 shadow-soft border border-rose-600/20 active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 shadow-soft border border-emerald-600/20 active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
  warning:
    "bg-amber-500 text-white hover:bg-amber-400 shadow-soft border border-amber-500/20 active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
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
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? "w-full" : ""} ${iconOnly ? "!p-2.5" : ""} ${className ?? ""}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Processing...</span>
        </>
      ) : children}
    </button>
  );
}
