import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import OtpInput from "../components/OtpInput";
import { useAuth } from "../contexts/AuthContext";

export default function ForgotPasswordPage() {
  const { requestPasswordResetOtp, verifyPasswordResetOtp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"mobile" | "otp" | "reset">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as { response?: { data?: { message?: string } }; message?: string };
    return maybe?.response?.data?.message ?? maybe?.message ?? fallback;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordResetOtp(mobile);
      setStep("otp");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payload = await verifyPasswordResetOtp(mobile, otp);
      setResetToken(payload?.resetToken ?? "");
      setStep("reset");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!resetToken) {
        throw new Error("Reset token missing. Please verify OTP again.");
      }
      await resetPassword(resetToken, newPassword);
      navigate("/login/admin", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recover Password"
      subtitle="Complete these steps to securely regain access to your workspace."
      audience="generic"
      helper={
        <div className="flex justify-center pt-2">
          <a href="/login/admin" className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
            &larr; Back to login
          </a>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {error && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </div>
          )}

          {step === "mobile" && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-6 text-left">
              <Input
                label="Registered Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Ex. +91 9876543210"
                type="tel"
                required
                className="py-3"
              />
              <div className="pt-2">
                <Button type="submit" loading={loading} fullWidth className="py-3 text-[15px] shadow-sm">
                  Send Recovery Code &rarr;
                </Button>
              </div>
            </form>
          )}

          {step === "otp" && (
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
                    setStep("mobile");
                  }}
                  className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 transition-colors"
                >
                  Resend code
                </button>
              </div>
              <div className="pt-2">
                <Button type="submit" loading={loading} disabled={otp.length < 6} fullWidth className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.39)]">
                  Verify Passcode &rarr;
                </Button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleReset} className="flex flex-col gap-6 text-left">
              <Input
                label="New Secure Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Create a strong password"
                required
                className="py-3"
              />
              <div className="pt-2">
                <Button type="submit" loading={loading} fullWidth className="py-3 text-[15px] shadow-sm">
                  Update Password & Login &rarr;
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
