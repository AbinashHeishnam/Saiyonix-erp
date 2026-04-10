import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions, icon, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 animate-slide-up pb-2">
      {breadcrumb && <div className="mb-1">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400 flex-shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{title}</h1>
            {subtitle && <p className="text-sm font-medium text-slate-500 max-w-2xl dark:text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3 mt-2 sm:mt-0 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
