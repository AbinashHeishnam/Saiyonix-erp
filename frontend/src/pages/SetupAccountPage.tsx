import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Button from "../components/Button";
import AuthShell from "../components/AuthShell";
import Input from "../components/Input";
import OtpInput from "../components/OtpInput";
import { completeSetup, sendSetupOtp, verifySetupOtp } from "../services/api/auth";
import { getAuthSnapshot, setAuthSnapshot } from "../services/api/authStore";
import { OTP_DELIVERY_MODE } from "../config/otp";

export default function SetupAccountPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"verify" | "otp" | "password" | "success">("verify");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const passwordMismatch = useMemo(
    () => Boolean(newPassword && confirmPassword && newPassword !== confirmPassword),
    [newPassword, confirmPassword]
  );

  const handleSendOtp = async () => {
    setError(null);
    setMessage(null);
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      await sendSetupOtp(mobile);
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
      setMessage(
        OTP_DELIVERY_MODE === "call"
          ? "You will receive your verification code via an automated phone call."
          : "A secure passcode has been sent to your mobile number."
      );
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setMessage(null);
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setLoading(true);
    try {
      await verifySetupOtp(mobile, otp);
      setStep("password");
      setMessage("Identity verified. Please set your new secure password.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await completeSetup({ mobile, newPassword, confirmPassword });
      const current = getAuthSnapshot();
      if (current?.user) {
        setAuthSnapshot({
          ...current,
          user: {
            ...current.user,
            mobile,
            mustChangePassword: false,
            phoneVerified: true,
          },
        });
      }
      setStep("success");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Teacher Activation"
      subtitle="Finalize your profile details and secure your teaching workspace."
      audience="teacher"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
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

          {step === "verify" && (
            <div className="flex flex-col gap-6 text-left">
              <Input
                label="Registered Mobile Number"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Ex. 9876543210"
                required
                className="py-3"
              />
              <div className="pt-2">
                <Button onClick={handleSendOtp} loading={loading} fullWidth className="py-3 text-[15px] shadow-sm">
                  Send Passcode &rarr;
                </Button>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="flex flex-col gap-8 text-left">
              <div className="flex flex-col items-center gap-4">
                <label className="text-[14px] font-bold text-slate-700 dark:text-slate-300">
                  Enter 6-digit Code
                </label>
                <OtpInput value={otp} onChange={setOtp} />
              </div>

              <div className="flex items-center justify-between text-[13px] text-slate-500 pt-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("verify");
                  }}
                  className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendCooldown > 0}
                  className="font-medium text-sky-600 disabled:text-slate-400 dark:text-sky-400 dark:disabled:text-slate-500 dark:hover:text-sky-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="pt-2">
                <Button onClick={handleVerifyOtp} loading={loading} disabled={otp.length < 6} fullWidth className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.3)]">
                  Verify & Continue &rarr;
                </Button>
              </div>
            </div>
          )}

          {step === "password" && (
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
                placeholder="Re-type password"
                error={passwordMismatch ? "Passwords do not match" : undefined}
                required
                className="py-3"
              />

              <div className="pt-4">
                <Button type="submit" fullWidth loading={loading} disabled={!newPassword || passwordMismatch} className="py-3 text-[15px] shadow-sm">
                  Complete Setup & Finish &rarr;
                </Button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col gap-6 text-center pt-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Profile Activated</h3>
                <p className="text-[15px] text-slate-600 dark:text-slate-400">
                  Your teaching profile is now fully verified and secured. You're ready to start managing your classrooms.
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={() => navigate("/")} fullWidth className="py-3 text-[15px] shadow-sm">
                  Go to Dashboard &rarr;
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
