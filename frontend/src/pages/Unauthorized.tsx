import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Unauthorized() {
  const { user } = useAuth();
  if (user?.restricted) {
    return <Navigate to="/certificates" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center animate-slide-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
          <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-500">You don't have permission to access this page.</p>
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
