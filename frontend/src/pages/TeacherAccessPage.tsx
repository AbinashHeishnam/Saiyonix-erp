import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
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

  const [identifier, setIdentifier] = useState("");
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

  const sendOtp = async () => {
    setError(null);
    setMessage(null);
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
      setMessage("OTP sent. Check your email or phone.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = isActivation
        ? await verifyTeacherActivation(identifier, otp)
        : await verifyTeacherForgotPassword(identifier, otp);
      setResetToken(result?.resetToken ?? "");
      setStep("password");
      setMessage("OTP verified. Set your password.");
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

  const title = isActivation ? "Teacher Account Activation" : "Teacher Password Reset";
  const subtitle = isActivation
    ? "Verify your identity to activate your teaching workspace."
    : "Verify your identity to reset your teaching password.";

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      audience="teacher"
      helper={
        <div className="flex justify-center text-[13px] pt-4">
          <a href="/login/teacher" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">
            &larr; Back to login
          </a>
        </div>
      }
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
        <div className="flex flex-col gap-5 text-left">
          <Input
            label="Email or Mobile"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your identifier"
          />
          <div className="pt-2">
            <Button onClick={sendOtp} loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Send Passcode
            </Button>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="flex flex-col gap-5 text-left">
          <Input
            label="Secure passcode"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            autoComplete="one-time-code"
          />
          <div className="flex items-center justify-between text-[13px] text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setStep("identify")}
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
            <Button onClick={verifyOtp} loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Verify Passcode
            </Button>
          </div>
        </div>
      )}

      {step === "password" && (
        <div className="flex flex-col gap-5 text-left">
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Create a strong password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            error={passwordMismatch ? "Passwords do not match" : undefined}
          />
          <div className="pt-2">
            <Button onClick={completePassword} loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Save Password & Sign in
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col gap-5 text-center pt-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-slate-700 dark:text-slate-300">
            Your password is set. You can now securely log in.
          </p>
          <div className="pt-4">
            <Button onClick={() => navigate("/login")} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Go to Login
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
