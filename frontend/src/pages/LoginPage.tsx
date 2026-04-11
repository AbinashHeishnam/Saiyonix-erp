import { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import { useAuth } from "../contexts/AuthContext";
import { isAdminRole } from "../utils/role";

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const audience = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/login/teacher")) return "teacher";
    return "admin";
  }, [location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Wait for auth context to catch up
    } catch (err: unknown) {
      const maybe = err as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const message =
        maybe?.response?.status === 401
          ? "Wrong email or password"
          : maybe?.response?.data?.message ?? maybe?.message ?? "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500"></div>
          <p className="text-sm font-semibold text-slate-500">Checking session...</p>
        </div>
      </div>
    );
  }

  if (user && !isLoading) {
    const isRestricted = Boolean(user.restricted);
    const shouldSetup = user.role?.roleType === "TEACHER" && (user.mustChangePassword || !user.phoneVerified);
    const shouldAdminSetup = isAdminRole(user.role?.roleType) && user.mustChangePassword;
    if (isRestricted) return <Navigate to="/certificates" replace />;
    if (shouldSetup) return <Navigate to="/setup-account" replace />;
    if (shouldAdminSetup) return <Navigate to="/admin-setup" replace />;
    return <Navigate to="/" replace />;
  }

  const audienceCopy = {
    admin: {
      title: "Admin System Access",
      subtitle: "Secure central management console for school operations.",
      helper: null,
    },
    teacher: {
      title: "Teacher Workspace",
      subtitle: "Sign in to manage classes, assignments, and daily attendance.",
      helper: (
        <div className="flex flex-col gap-3 text-[13px] pt-2">
          <a href="/teacher-forgot-password" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Forgot password?
          </a>
          <a href="/teacher-activate" className="font-medium text-sky-600 hover:text-sky-700 transition-colors">
            Activate new teacher workspace &rarr;
          </a>
        </div>
      ),
    },
  } as const;

  return (
    <AuthShell
      title={audienceCopy[audience].title}
      subtitle={audienceCopy[audience].subtitle}
      helper={audienceCopy[audience].helper}
      audience={audience}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={audience}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          {error && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left mt-2">
            <Input
              label={audience === "admin" ? "Admin email" : "Teacher email"}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={audience === "admin" ? "admin@school.edu" : "teacher@school.edu"}
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-[11px] font-bold tracking-wide uppercase text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="pt-3">
              <Button type="submit" loading={loading} fullWidth className="py-2.5 text-[15px] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.2)] hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.25)] transition-shadow">
                {audience === "admin" ? "Enter Admin Console" : "Open Teacher Workspace"}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
