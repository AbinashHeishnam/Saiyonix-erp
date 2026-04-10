import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import { useAuth } from "../contexts/AuthContext";
import { isAdminRole } from "../utils/role";

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [audience, setAudience] = useState<"admin" | "teacher" | "guardian">("admin");

  const pathAudience = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/login/teacher")) return "teacher";
    if (path.startsWith("/login/student") || path.startsWith("/login/parent")) return "guardian";
    if (path.startsWith("/login/admin")) return "admin";
    return "admin";
  }, [location.pathname]);

  useEffect(() => {
    setAudience(pathAudience);
  }, [pathAudience]);

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
    guardian: {
      title: "Student & Parent Portal",
      subtitle: "Secure portal for academic progress and school updates.",
      helper: null,
    },
  } as const;

  return (
    <AuthShell
      title={audienceCopy[audience].title}
      subtitle={audienceCopy[audience].subtitle}
      helper={audienceCopy[audience].helper}
      audience={audience === "guardian" ? "guardian" : audience}
    >
      <div className="mb-8 flex rounded-2xl bg-slate-100/80 p-[5px] shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800/50 dark:ring-white/10 relative">
        {[
          { key: "admin", label: "Admin" },
          { key: "teacher", label: "Teacher" },
          { key: "guardian", label: "Student / Parent" },
        ].map((item) => {
          const isActive = audience === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setError("");
                setAudience(item.key as typeof audience);
              }}
              className={`relative flex-1 rounded-[14px] py-2.5 text-[13px] font-semibold transition-colors duration-200 z-10 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="loginTabBg"
                  className="absolute inset-0 z-[-1] rounded-[14px] bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] dark:bg-slate-700 ring-1 ring-slate-900/5"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              {item.label}
            </button>
          );
        })}
      </div>

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

          {audience === "guardian" ? (
            <div className="flex flex-col gap-6 text-center mt-2">
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-sky-50/50 border border-sky-100/80">
                <div className="h-14 w-14 rounded-full bg-sky-100 flex items-center justify-center mb-5 shadow-sm text-sky-500 ring-4 ring-sky-50">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-semibold text-slate-900 mb-2">Secure OTP Login</h3>
                <p className="text-[13.5px] text-slate-500 leading-relaxed font-medium">
                  For enhanced security and ease of use, all student and parent portals are accessed natively via mobile passcode.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate("/otp-login")}
                fullWidth
                className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:bg-sky-500 transition-all"
              >
                Proceed to Mobile Sign-In &rarr;
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left mt-2">
              <Input
                label="Work email"
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
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
