import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import OtpInput from "../components/OtpInput";
import { useAuth } from "../contexts/AuthContext";
import { isAdminRole } from "../utils/role";

const RESEND_COOLDOWN_SECONDS = 60;
const SEND_COOLDOWN_SECONDS = 60;

export default function EmailOtpLoginPage() {
  const { requestEmailOtp, resendEmailOtp, verifyEmailOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);

  const getErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as { response?: { data?: { message?: string } }; message?: string };
    return maybe?.response?.data?.message ?? maybe?.message ?? fallback;
  };

  useEffect(() => {
    if (step !== "otp" || resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, resendCooldown]);

  useEffect(() => {
    if (sendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await requestEmailOtp(email);
      setStep("otp");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setSendCooldown(SEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const maybe = err as { response?: { status?: number } };
      if (maybe?.response?.status === 429) {
        setSendCooldown(SEND_COOLDOWN_SECONDS);
      }
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendLoading(true);
    try {
      await resendEmailOtp(email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await verifyEmailOtp(email, otp);
      const isTeacher = payload.user?.role?.roleType === "TEACHER";
      const needsPasswordSetup = Boolean(payload.user?.mustChangePassword);
      const shouldAdminSetup = isAdminRole(payload.user?.role?.roleType) && needsPasswordSetup;
      if (isTeacher && needsPasswordSetup) {
        navigate("/admin-setup", { replace: true });
      } else if (shouldAdminSetup) {
        navigate("/admin-setup", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Email Authentication"
      subtitle="A secure passcode will be sent to your email."
      helper={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px]">
          <a href="/login/admin" className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            &larr; Use password
          </a>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}
      {step === "email" ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-6 text-left">
          <Input
            label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="name@school.edu"
            required
            autoComplete="email"
            className="py-3 text-[15px]"
          />
          <div className="pt-2">
            <Button
              type="submit"
              loading={loading}
              disabled={sendCooldown > 0}
              fullWidth
              className="py-3 text-[15px] shadow-sm"
            >
              {sendCooldown > 0 ? `Wait ${sendCooldown}s to resend` : "Send Passcode"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-8 text-left">
          <div className="flex flex-col items-center gap-4">
            <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
              Enter 6-digit secure code
            </label>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          <div className="flex items-center justify-between text-[13px] text-slate-500 pt-5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setError("");
                setOtp("");
                setStep("email");
              }}
              className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="font-medium text-sky-600 disabled:text-slate-400 dark:text-sky-400 dark:disabled:text-slate-500 dark:hover:text-sky-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resendLoading ? "Sending..." : "Resend code"}
            </button>
          </div>
          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={otp.length < 6} fullWidth className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:bg-sky-500 transition-shadow">
              Verify & Sign In &rarr;
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
