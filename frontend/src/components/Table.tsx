import React from "react";

type Props = React.TableHTMLAttributes<HTMLTableElement> & {
  columns: string[];
  children: React.ReactNode;
};

export default function Table({ columns, children, className, ...props }: Props) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <table
        className={`w-full min-w-[720px] border-separate border-spacing-y-0 ${
          className ?? ""
        }`}
        {...props}
      >
        <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0 bg-white/90 backdrop-blur dark:bg-slate-900/90">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 font-semibold tracking-wide">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700 dark:text-slate-200">{children}</tbody>
      </table>
    </div>
  );
}
