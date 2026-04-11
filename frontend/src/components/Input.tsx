import React, { useId } from "react";

type InputSize = "sm" | "md" | "lg";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
  inputSize?: InputSize;
  leadingIcon?: React.ReactNode;
};

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-2 text-[13px] rounded-xl",
  md: "px-4 py-3.5 text-[15px] rounded-2xl",
  lg: "px-4 py-4 text-[16px] rounded-2xl",
};

export default function Input({ label, helper, error, inputSize = "md", leadingIcon, className, id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex w-full flex-col gap-1.5 relative group">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[13px] font-semibold text-slate-700 ml-1 mb-0.5 transition-colors group-focus-within:text-sky-600 dark:text-slate-300 dark:group-focus-within:text-sky-400"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leadingIcon && (
          <div className="absolute left-4 text-slate-400 group-focus-within:text-sky-500 transition-colors pointer-events-none">
            {leadingIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-slate-50/80 hover:bg-slate-100/50 focus:bg-white text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all duration-300 outline-none placeholder:text-slate-400 placeholder:font-normal font-medium border border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:ring-[4px] focus:ring-sky-500/15 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 dark:focus:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:border-slate-800 dark:hover:border-slate-700 dark:focus:border-sky-500 dark:focus:ring-sky-500/20 ${sizeStyles[inputSize]} ${leadingIcon ? "pl-11" : ""} ${error ? "border-rose-400 focus:border-rose-400 focus:ring-rose-500/15 dark:border-rose-500 dark:focus:ring-rose-500/20" : ""} ${className ?? ""}`}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-[12px] font-semibold text-rose-500 ml-1">{error}</span>
      ) : helper ? (
        <span className="text-[12px] font-medium text-slate-400 ml-1 dark:text-slate-500">{helper}</span>
      ) : null}
    </div>
  );
}
