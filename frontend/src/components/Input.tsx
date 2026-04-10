import React from "react";

type InputSize = "sm" | "md";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
  inputSize?: InputSize;
  leadingIcon?: React.ReactNode;
};

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
};

export default function Input({ label, helper, error, inputSize = "md", leadingIcon, className, ...props }: Props) {
  return (
    <label className="flex w-full flex-col gap-2 relative group">
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 ml-1 transition-colors group-focus-within:text-sky-600 dark:text-slate-400">{label}</span>}
      <div className="relative">
        {leadingIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors pointer-events-none">
            {leadingIcon}
          </div>
        )}
        <input
          className={`w-full rounded-xl border bg-white transition-all duration-200 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700 dark:focus:border-sky-500 ${sizeStyles[inputSize]} ${leadingIcon ? "pl-10" : ""} ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10 dark:border-rose-500/60" : "border-slate-200"} ${className ?? ""}`}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-xs font-semibold text-rose-500 ml-1">{error}</span>
      ) : helper ? (
        <span className="text-xs font-medium text-slate-400 ml-1 dark:text-slate-500">{helper}</span>
      ) : null}
    </label>
  );
}
