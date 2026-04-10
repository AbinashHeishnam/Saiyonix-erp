import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../components/Button";
import AuthShell from "../components/AuthShell";
import Input from "../components/Input";
import { completeSetup, sendSetupOtp, verifySetupOtp } from "../services/api/auth";
import { getAuthSnapshot, setAuthSnapshot } from "../services/api/authStore";
import { OTP_DELIVERY_MODE } from "../config/otp";

export default function SetupAccountPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtp("");
  }, [mobile]);

  const passwordMismatch = useMemo(
    () => Boolean(newPassword && confirmPassword && newPassword !== confirmPassword),
    [newPassword, confirmPassword]
  );

  const handleSendOtp = async () => {
    setError(null);
    setMessage(null);
    setLoadingOtp(true);
    try {
      await sendSetupOtp(mobile);
      setOtpSent(true);
      setOtpVerified(false);
      setMessage(
        OTP_DELIVERY_MODE === "call"
          ? "You will receive the OTP by phone call."
          : "OTP sent to your phone."
      );
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setMessage(null);
    setLoadingVerify(true);
    try {
      await verifySetupOtp(mobile, otp);
      setOtpVerified(true);
      setMessage("OTP verified successfully.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "OTP verification failed");
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!otpVerified) {
      setError("Please verify the OTP before submitting.");
      return;
    }

    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoadingSubmit(true);
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
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Setup failed");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <AuthShell
      title="Finalize Teacher Setup"
      subtitle="Verify your phone and secure your teaching account."
      audience="teacher"
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left">
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Create a strong password"
          required
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          error={passwordMismatch ? "Passwords do not match" : undefined}
          required
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="Phone number"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="10-digit mobile"
            required
          />
          <div className="pt-2 sm:pt-0">
            <Button
              type="button"
              variant="secondary"
              className="h-11 sm:w-auto w-full text-[14px]"
              disabled={!mobile || loadingOtp}
              onClick={handleSendOtp}
            >
              {loadingOtp ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="Secure passcode"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            required
            autoComplete="one-time-code"
          />
          <div className="pt-2 sm:pt-0">
            <Button
              type="button"
              variant="primary"
              className="h-11 sm:w-auto w-full text-[14px]"
              disabled={!otp || !mobile || loadingVerify || otpVerified}
              onClick={handleVerifyOtp}
            >
              {loadingVerify ? "Verifying..." : otpVerified ? "Verified" : "Verify OTP"}
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-2">
          <Button type="submit" fullWidth disabled={loadingSubmit} className="py-2.5 text-[15px] shadow-sm">
            {loadingSubmit ? "Finishing setup..." : "Finish Setup"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
