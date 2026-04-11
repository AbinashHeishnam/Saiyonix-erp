import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import OtpInput from "../components/OtpInput";
import {
  completeAdminSetup,
  sendAdminSetupOtp,
  verifyAdminSetupOtp,
} from "../services/api/auth";
import { setAuthSnapshot } from "../services/api/authStore";
import { useAuth } from "../contexts/AuthContext";
import { displayRole, isAdminRole } from "../utils/role";

export default function AdminSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = user?.email ?? "";
  const roleLabel = displayRole(user?.role?.roleType ?? null) || "Staff";
  const audience = isAdminRole(user?.role?.roleType) ? "admin" : "teacher";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const passwordMismatch = useMemo(
    () => Boolean(newPassword && confirmPassword && newPassword !== confirmPassword),
    [newPassword, confirmPassword]
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    setError(null);
    setMessage(null);
    setDevOtp(null);
    setLoadingOtp(true);
    try {
      if (!email) {
        throw new Error("Email context missing. Please re-login.");
      }
      const data = await sendAdminSetupOtp();
      setOtp("");
      setOtpSent(true);
      setOtpVerified(false);
      setResendCooldown(60);
      setMessage("A secondary verification code has been sent to your email.");
      if (data?.otp) {
        setDevOtp(String(data.otp));
      }
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to send OTP";
      if (apiMessage.toLowerCase().includes("please wait")) {
        setOtpSent(true);
        setOtpVerified(false);
        setResendCooldown(60);
        setMessage("A code was recently sent. Please check your inbox.");
      } else {
        setError(apiMessage);
      }
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setMessage(null);
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setLoadingVerify(true);
    try {
      await verifyAdminSetupOtp({ email, otp });
      setOtpVerified(true);
      setMessage("Identity verified successfully. You may now update your password.");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "OTP verification failed"
      );
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Email context missing.");
      return;
    }

    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoadingSubmit(true);
    try {
      await completeAdminSetup({ email, newPassword, confirmPassword });
      const current = user;
      if (current) {
        setAuthSnapshot({
          user: {
            ...current,
            mustChangePassword: false,
          },
        });
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Setup failed"
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <AuthShell
      title={`${roleLabel} Profile Setup`}
      subtitle="Complete these security steps to finalize your workspace access."
      audience={audience}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={otpVerified ? "password" : "verification"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {message && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[13px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </div>
          )}
          {devOtp && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
              Development OTP: <span className="font-bold tracking-widest">{devOtp}</span>
            </div>
          )}

          {!otpVerified ? (
            <div className="flex flex-col gap-6">
              <Input label="Your Email" value={email} disabled className="bg-slate-50/50" />

              {!otpSent ? (
                <div className="pt-2">
                  <Button
                    onClick={handleSendOtp}
                    loading={loadingOtp}
                    fullWidth
                    className="py-3 text-[15px] shadow-sm"
                  >
                    Send Verification Code &rarr;
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-8 text-center bg-sky-50/30 dark:bg-sky-950/20 p-6 rounded-3xl border border-sky-100 dark:border-sky-900/30">
                  <div className="space-y-4">
                    <label className="text-[14px] font-bold text-slate-700 dark:text-slate-300">
                      Enter 6-digit Code
                    </label>
                    <OtpInput value={otp} onChange={setOtp} />
                  </div>

                  <div className="flex flex-col gap-4">
                    <Button
                      onClick={handleVerifyOtp}
                      loading={loadingVerify}
                      disabled={otp.length < 6}
                      fullWidth
                      className="py-3 text-[15px] shadow-sm"
                    >
                      Verify Identity &rarr;
                    </Button>

                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={resendCooldown > 0}
                      className="text-[13px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive code? Resend"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">Identity Verified</p>
              </div>

              <Input
                label="Create New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a strong password"
                required
                className="py-3"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your password"
                error={passwordMismatch ? "Passwords do not match" : undefined}
                required
                className="py-3"
              />

              <div className="pt-4">
                <Button
                  type="submit"
                  fullWidth
                  loading={loadingSubmit}
                  disabled={!newPassword || passwordMismatch}
                  className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.3)] hover:shadow-[0_6px_20px_0_rgba(14,165,233,0.2)]"
                >
                  Save & Unlock Profile &rarr;
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
