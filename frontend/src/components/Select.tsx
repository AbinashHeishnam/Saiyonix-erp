import React from "react";

type SelectSize = "sm" | "md";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helper?: string;
  error?: string;
  selectSize?: SelectSize;
};

const sizeStyles: Record<SelectSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
};

export default function Select({ label, helper, error, selectSize = "md", className, children, ...props }: Props) {
  return (
    <label className="flex w-full flex-col gap-2 relative group">
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 ml-1 transition-colors group-focus-within:text-sky-600 dark:text-slate-400">{label}</span>}
      <div className="relative">
        <select
          className={`w-full rounded-xl border bg-white transition-all duration-200 outline-none appearance-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 pr-10 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:border-sky-500 ${sizeStyles[selectSize]} ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10 dark:border-rose-500/60" : "border-slate-200"} ${className ?? ""}`}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error ? (
        <span className="text-xs font-semibold text-rose-500 ml-1">{error}</span>
      ) : helper ? (
        <span className="text-xs font-medium text-slate-400 ml-1 dark:text-slate-500">{helper}</span>
      ) : null}
    </label>
  );
}
