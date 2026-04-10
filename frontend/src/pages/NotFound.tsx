import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center animate-slide-up">
        <p className="text-7xl font-bold text-slate-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
