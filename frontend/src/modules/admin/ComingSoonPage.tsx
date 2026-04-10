import PageHeader from "../../components/PageHeader";

interface ComingSoonPageProps {
  title: string;
  description: string;
}

export default function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title={title} subtitle={description} />
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-card">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-jade-50 to-sky-50">
          <svg className="h-10 w-10 text-jade-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h3 className="mt-6 text-lg font-bold text-ink-900">Coming Soon</h3>
        <p className="mt-2 max-w-md text-center text-sm text-ink-500">
          This module is in development and will be available in a future release.
          The backend APIs are being built to support this feature.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-full bg-ink-50 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-jade-500 animate-pulse-soft" />
          <span className="text-xs font-semibold text-ink-500">In Development</span>
        </div>
      </div>
    </div>
  );
}
