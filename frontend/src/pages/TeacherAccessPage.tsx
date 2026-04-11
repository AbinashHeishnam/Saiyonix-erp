import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import OtpInput from "../components/OtpInput";
import {
  completeTeacherActivation,
  completeTeacherForgotPassword,
  requestTeacherActivation,
  requestTeacherForgotPassword,
  verifyTeacherActivation,
  verifyTeacherForgotPassword,
} from "../services/api/auth";

type Mode = "activate" | "reset";

export default function TeacherAccessPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const isActivation = mode === "activate";

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"identify" | "otp" | "password" | "success">("identify");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  const getIdentifier = () => email.trim();

  const sendOtp = async () => {
    setError(null);
    setMessage(null);
    const identifier = getIdentifier();
    if (!identifier) {
      setError("Please enter your teacher email.");
      return;
    }
    setLoading(true);
    try {
      if (isActivation) {
        await requestTeacherActivation(identifier);
      } else {
        await requestTeacherForgotPassword(identifier);
      }
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
      setMessage("A secure passcode has been sent to your email.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setMessage(null);
    const identifier = getIdentifier();
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setLoading(true);
    try {
      const result = isActivation
        ? await verifyTeacherActivation(identifier, otp)
        : await verifyTeacherForgotPassword(identifier, otp);
      setResetToken(result?.resetToken ?? "");
      setStep("password");
      setMessage("Verification successful. Please set your new password.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const completePassword = async () => {
    setError(null);
    setMessage(null);
    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (isActivation) {
        await completeTeacherActivation({
          resetToken,
          newPassword,
          confirmPassword,
        });
      } else {
        await completeTeacherForgotPassword({
          resetToken,
          newPassword,
          confirmPassword,
        });
      }
      setStep("success");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const title = isActivation ? "Teacher Activation" : "Reset Password";
  const subtitle = isActivation
    ? "Complete your verification to activate your teacher profile."
    : "Verify your teacher identity for password change.";

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      audience="teacher"
      helper={
        <div className="flex justify-center pt-2">
          <a href="/login/teacher" className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
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

          {step === "identify" && (
            <div className="flex flex-col gap-6 text-left">
              <Input
                label="Teacher Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu"
                type="email"
                className="py-3"
                autoFocus
              />

              <div className="pt-2">
                <Button onClick={sendOtp} loading={loading} fullWidth className="py-3 text-[15px] shadow-sm">
                  Send Passcode &rarr;
                </Button>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="flex flex-col gap-8 text-left">
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
                    setError(null);
                    setStep("identify");
                  }}
                  className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change details
                </button>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={resendCooldown > 0}
                  className="font-medium text-sky-600 disabled:text-slate-400 dark:text-sky-400 dark:disabled:text-slate-500 dark:hover:text-sky-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
              <div className="pt-2">
                <Button onClick={verifyOtp} loading={loading} disabled={otp.length < 6} fullWidth className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.39)]">
                  Verify Passcode &rarr;
                </Button>
              </div>
            </div>
          )}

          {step === "password" && (
            <div className="flex flex-col gap-6 text-left">
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                className="py-3"
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="py-3"
                error={passwordMismatch ? "Passwords do not match" : undefined}
              />
              <div className="pt-2">
                <Button onClick={completePassword} loading={loading} fullWidth className="py-3 text-[15px] shadow-sm">
                  Update & Finish &rarr;
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col gap-6 text-center pt-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Profile Secured</h3>
                <p className="text-[15px] text-slate-600 dark:text-slate-400">
                  Your password has been updated successfully. You can now use your new credentials to log in.
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={() => navigate("/login/teacher")} fullWidth className="py-3 text-[15px] shadow-sm">
                  Return to Teacher Login
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
