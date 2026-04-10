import React, { useMemo, useState } from "react";
import LoadingState from "./LoadingState";
import EmptyState from "./EmptyState";

export interface Column<T = Record<string, unknown>> {
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    sortable?: boolean;
    hideOnMobile?: boolean;
    primary?: boolean;
}

interface DataTableProps<T = Record<string, unknown>> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    error?: string | null;
    emptyTitle?: string;
    emptyDescription?: string;
    searchable?: boolean;
    searchKeys?: string[];
    onRowClick?: (row: T) => void;
    actions?: (row: T) => React.ReactNode;
    getRowKey?: (row: T, index: number) => string;
    pageSize?: number;
    mobileCardRender?: (row: T) => React.ReactNode;
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, part) => {
        if (acc == null) return undefined;
        if (Array.isArray(acc)) {
            const idx = Number(part);
            return Number.isInteger(idx) ? acc[idx] : undefined;
        }
        if (typeof acc === "object" && acc !== null && part in acc) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

function displayValue(value: unknown): string {
    if (value == null) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value instanceof Date) return value.toLocaleDateString();
    try { return JSON.stringify(value); } catch { return String(value); }
}

function DefaultMobileCard<T extends Record<string, unknown>>({
    row,
    columns,
    actions,
    onRowClick,
}: {
    row: T;
    columns: Column<T>[];
    actions?: (row: T) => React.ReactNode;
    onRowClick?: (row: T) => void;
}) {
    const primaryCol = columns.find((c) => c.primary) || columns[0];
    const otherCols = columns.filter((c) => c !== primaryCol).slice(0, 4);

    return (
        <div
            className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-card transition-all hover:shadow-card-hover dark:bg-slate-900 dark:border-slate-800 ${onRowClick ? "cursor-pointer active:scale-[0.99]" : ""}`}
            onClick={() => onRowClick?.(row)}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {primaryCol?.render ? primaryCol.render(row) : displayValue(getValueByPath(row, primaryCol?.key ?? ""))}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {otherCols.map((col) => (
                            <div key={col.key} className="flex items-baseline gap-1.5 text-xs">
                                <span className="font-medium text-slate-400 dark:text-slate-500">{col.label}:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    {col.render ? col.render(row) : displayValue(getValueByPath(row, col.key))}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                {actions && (
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {actions(row)}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DataTable<T extends Record<string, unknown> = Record<string, unknown>>({
    columns,
    data,
    loading = false,
    error = null,
    emptyTitle = "No records found",
    emptyDescription = "Data will appear here once available.",
    searchable = false,
    searchKeys,
    onRowClick,
    actions,
    getRowKey,
    pageSize = 20,
    mobileCardRender,
}: DataTableProps<T>) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const filtered = useMemo(() => {
        if (!search.trim()) return data;
        const term = search.toLowerCase();
        const keys = searchKeys ?? columns.map((c) => c.key);
        return data.filter((row) =>
            keys.some((key) => {
                const v = getValueByPath(row, key);
                return v != null && String(v).toLowerCase().includes(term);
            })
        );
    }, [data, search, searchKeys, columns]);

    const sorted = useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const av = getValueByPath(a, sortKey) ?? "";
            const bv = getValueByPath(b, sortKey) ?? "";
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    if (loading) return <LoadingState label="Loading data..." />;
    if (error) return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20">{error}</div>;

    const visibleDesktopColumns = columns.filter((c) => !c.hideOnMobile);

    return (
        <div className="flex flex-col gap-4">
            {searchable && (
                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                    />
                </div>
            )}

            {/* Mobile card view */}
            <div className="flex flex-col gap-3 md:hidden">
                {paged.length === 0 ? (
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                ) : (
                    paged.map((row, i) => {
                        const key = getRowKey ? getRowKey(row, i) : (row.id ? String(row.id) : String(i));
                        return (
                            <div key={key}>
                                {mobileCardRender ? mobileCardRender(row) : (
                                    <DefaultMobileCard
                                        row={row}
                                        columns={columns}
                                        actions={actions}
                                        onRowClick={onRowClick}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                            {visibleDesktopColumns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${col.sortable !== false ? "cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" : ""
                                        }`}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {col.label}
                                        {sortKey === col.key && (
                                            <span className="text-sky-600 dark:text-sky-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paged.length === 0 ? (
                            <tr>
                                <td colSpan={visibleDesktopColumns.length + (actions ? 1 : 0)} className="p-8">
                                    <EmptyState title={emptyTitle} description={emptyDescription} />
                                </td>
                            </tr>
                        ) : (
                            paged.map((row, i) => {
                                const key = getRowKey ? getRowKey(row, i) : (row.id ? String(row.id) : String(i));
                                return (
                                    <tr
                                        key={key}
                                        className={`bg-white transition-colors hover:bg-slate-50/70 dark:bg-slate-900 dark:hover:bg-slate-800/70 ${onRowClick ? "cursor-pointer" : ""}`}
                                        onClick={() => onRowClick?.(row)}
                                    >
                                        {visibleDesktopColumns.map((col) => (
                                            <td key={col.key} className="px-4 py-3.5 text-slate-700 dark:text-slate-200">
                                                {col.render ? col.render(row) : displayValue(getValueByPath(row, col.key))}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                                {actions(row)}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row items-center justify-between text-sm text-slate-500">
                    <span className="text-xs font-medium">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${page === p ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                        }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
