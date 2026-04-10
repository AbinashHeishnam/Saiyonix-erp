interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
    return <div className={`animate-shimmer rounded-lg ${className}`} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    return (
        <div className={`flex flex-col gap-2.5 ${className}`}>
            {Array.from({ length: lines }, (_, i) => (
                <div
                    key={i}
                    className={`h-3.5 rounded-lg animate-shimmer ${i === lines - 1 ? "w-3/5" : i % 2 === 0 ? "w-full" : "w-5/6"}`}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
    return (
        <div className={`rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex flex-col gap-2 flex-1">
                    <div className="h-3 w-24 rounded-lg animate-shimmer" />
                    <div className="h-7 w-16 rounded-lg animate-shimmer" />
                </div>
                <div className="h-10 w-10 rounded-xl animate-shimmer" />
            </div>
            <div className="h-3 w-20 rounded-lg animate-shimmer" />
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4, className = "" }: { rows?: number; cols?: number; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex gap-4">
                {Array.from({ length: cols }, (_, i) => (
                    <div key={i} className="h-3 rounded animate-shimmer flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="border-b border-slate-100 dark:border-slate-800 px-4 py-4 flex gap-4 last:border-0">
                    {Array.from({ length: cols }, (_, j) => (
                        <div key={j} className={`h-3.5 rounded animate-shimmer flex-1 ${j === 0 ? "max-w-[140px]" : ""}`} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col gap-2">
                <div className="h-8 w-48 rounded-xl animate-shimmer" />
                <div className="h-4 w-72 rounded-lg animate-shimmer" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200/70 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="h-5 w-40 rounded-lg animate-shimmer mb-6" />
                    <div className="h-64 rounded-xl animate-shimmer" />
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="h-5 w-32 rounded-lg animate-shimmer mb-6" />
                    <div className="h-52 w-52 mx-auto rounded-full animate-shimmer" />
                </div>
            </div>
        </div>
    );
}

export default Skeleton;
