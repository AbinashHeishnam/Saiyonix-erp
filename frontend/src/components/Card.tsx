import React from "react";

type CardVariant = "default" | "outline" | "ghost" | "elevated";

interface CardProps {
  title?: string;
  subtitle?: string;
  /** @deprecated Use subtitle instead */
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default: "bg-white shadow-card border border-slate-200/70 hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800",
  outline: "bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800",
  ghost: "bg-transparent",
  elevated: "bg-white shadow-soft border border-slate-100 dark:bg-slate-900 dark:border-slate-800",
};

export default function Card({ title, subtitle, description, children, className = "", actions, noPadding = false, variant = "default" }: CardProps) {
  const sub = subtitle || description;
  return (
    <div className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${variantStyles[variant]} ${className}`}>

      {(title || actions) && (
        <div className="relative flex items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
            {sub && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className={`relative ${noPadding ? "" : "p-6"}`}>{children}</div>
    </div>
  );
}
