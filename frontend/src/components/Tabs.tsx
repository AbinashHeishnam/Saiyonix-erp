import React from "react";

export interface Tab {
    key: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

type TabsVariant = "pills" | "underline";

interface TabsProps {
    tabs: Tab[];
    active: string;
    onChange: (key: string) => void;
    variant?: TabsVariant;
}

export default function Tabs({ tabs, active, onChange, variant = "pills" }: TabsProps) {
    if (variant === "underline") {
        return (
            <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-200 border-b-2 -mb-px ${active === tab.key
                            ? "border-sky-500 text-sky-600 dark:text-sky-400 dark:border-sky-400"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count != null && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active === tab.key
                                ? "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 shadow-inner dark:bg-slate-800 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap ${active === tab.key
                        ? "bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                        }`}
                >
                    {tab.icon}
                    {tab.label}
                    {tab.count != null && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active === tab.key
                            ? "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
                            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                            }`}>
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
