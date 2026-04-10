import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
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
        throw new Error("Email is required");
      }
      const data = await sendAdminSetupOtp();
      setOtp("");
      setOtpSent(true);
      setOtpVerified(false);
      setResendCooldown(60);
      setMessage("OTP sent to your email.");
      if (data?.otp) {
        setDevOtp(String(data.otp));
        setMessage("OTP sent. Use the code below in this environment.");
      }
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to send OTP";
      if (apiMessage.toLowerCase().includes("please wait")) {
        setOtpSent(true);
        setOtpVerified(false);
        setResendCooldown(60);
        setMessage("An OTP was recently sent. Please check your email and enter it below.");
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
    setLoadingVerify(true);
    try {
      await verifyAdminSetupOtp({ email, otp });
      setOtpVerified(true);
      setMessage("OTP verified successfully.");
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
      setError("Email is required.");
      return;
    }

    if (!isAdminRole(user?.role?.roleType) && user?.role?.roleType !== "TEACHER") {
      setError("This setup flow is only for admin and teacher roles.");
      return;
    }

    if (!otpVerified) {
      setError("Please verify the OTP before continuing.");
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
      title={`${roleLabel} Secure Setup`}
      subtitle="Confirm your identity and set a new password to unlock your workspace."
      audience={audience}
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
          Dev OTP: <span className="font-semibold">{devOtp}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left">
        <Input label="Email address" value={email} disabled />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="Secure passcode"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            autoComplete="one-time-code"
          />
          <div className="pt-2 sm:pt-0">
            <Button
              type="button"
              variant="secondary"
              className="h-11 sm:w-auto w-full text-[14px]"
              onClick={handleSendOtp}
              disabled={loadingOtp || resendCooldown > 0}
            >
              {loadingOtp
                ? "Sending..."
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : otpSent
                    ? "Resend OTP"
                    : "Send OTP"}
            </Button>
          </div>
        </div>
        <div className="pt-2">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleVerifyOtp}
            disabled={!otp || loadingVerify || otpVerified}
            className="py-2.5 text-[15px]"
          >
            {loadingVerify ? "Verifying..." : otpVerified ? "Verified" : "Verify OTP"}
          </Button>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800/60 my-2 pt-6"></div>

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

        <div className="pt-4">
          <Button type="submit" fullWidth loading={loadingSubmit} className="py-2.5 text-[15px] shadow-sm">
            Complete Setup
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
