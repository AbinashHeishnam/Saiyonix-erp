import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import { useAuth } from "../contexts/AuthContext";
import { OTP_DELIVERY_MODE } from "../config/otp";

export default function OtpLoginPage() {
  const { requestOtp, resendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);
  const SEND_COOLDOWN_SECONDS = 60;
  const deliveryLabel = OTP_DELIVERY_MODE === "call" ? "phone call" : "SMS";

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
      await requestOtp(mobile);
      setStep("otp");
      setResendCooldown(30);
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
      await resendOtp(mobile);
      setResendCooldown(30);
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
      const payload = await verifyOtp(mobile, otp);
      if (payload.user?.restricted) {
        navigate("/certificates", { replace: true });
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
      title="Student & Parent Mobile Login"
      subtitle={`Receive a secure passcode via ${deliveryLabel} to access results, attendance, and notices.`}
      audience="guardian"
      helper={
        <div className="flex justify-center pt-2">
          <a href="/login" className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
            &larr; Back to Home Login
          </a>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {step === "mobile" ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-5 text-left">
          <Input
            label="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="Enter registered mobile number"
            required
          />
          <div className="pt-2">
            <Button
              type="submit"
              loading={loading}
              disabled={sendCooldown > 0}
              fullWidth
              className="py-2.5 text-[15px] shadow-sm"
            >
              {sendCooldown > 0 ? `Wait ${sendCooldown}s` : "Send Passcode"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5 text-left">
          <Input
            label="Secure passcode"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter the 6-digit code"
            required
            autoComplete="one-time-code"
          />
          <div className="flex items-center justify-between text-[13px] text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setStep("mobile")}
              className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Change number
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
            <Button type="submit" loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Verify & Sign in
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
