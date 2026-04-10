import React from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helper?: string;
  error?: string;
};

export default function Textarea({ label, helper, error, className, ...props }: Props) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm group">
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 ml-1 transition-colors group-focus-within:text-sky-600 dark:text-slate-400">{label}</span>}
      <textarea
        className={`min-h-[120px] rounded-xl border bg-white px-4 py-3 text-sm transition-all duration-200 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10 dark:border-rose-500/60" : "border-slate-200"} ${className ?? ""}`}
        {...props}
      />
      {error ? (
        <span className="text-xs font-semibold text-rose-500 ml-1">{error}</span>
      ) : helper ? (
        <span className="text-xs font-medium text-slate-400 ml-1 dark:text-slate-500">{helper}</span>
      ) : null}
    </label>
  );
}
