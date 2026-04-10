type LoadingVariant = "spinner" | "skeleton" | "dots";

interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
}

export default function LoadingState({ label = "Loading...", variant = "spinner" }: LoadingStateProps) {
  if (variant === "dots") {
    return (
      <div className="flex items-center justify-center gap-1.5 py-12 animate-fade-in">
        <div className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="h-2.5 w-2.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="h-2.5 w-2.5 rounded-full bg-sky-300 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className="flex flex-col gap-4 py-6 animate-fade-in">
        <div className="h-8 w-1/3 rounded-xl animate-shimmer" />
        <div className="h-4 w-full rounded-lg animate-shimmer" />
        <div className="h-4 w-5/6 rounded-lg animate-shimmer" />
        <div className="h-4 w-2/3 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="h-24 rounded-xl animate-shimmer" />
          <div className="h-24 rounded-xl animate-shimmer" />
          <div className="h-24 rounded-xl animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 animate-fade-in">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800"></div>
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-sky-600"></div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
