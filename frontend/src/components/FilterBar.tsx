import React from "react";

interface FilterBarProps {
    children: React.ReactNode;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    className?: string;
}

export default function FilterBar({
    children,
    searchValue,
    onSearchChange,
    searchPlaceholder = "Search...",
    className = "",
}: FilterBarProps) {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-white p-3 shadow-card border border-slate-100 dark:bg-slate-900 dark:border-slate-800 ${className}`}>
            {onSearchChange && (
                <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchValue ?? ""}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 focus:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
                    />
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {children}
            </div>
        </div>
    );
}
