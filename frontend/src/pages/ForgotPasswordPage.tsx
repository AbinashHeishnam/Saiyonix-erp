import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
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
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Password Recovery"
      subtitle="Verify your registered mobile number to reset your password securely."
      audience="generic"
      helper={
        <div className="flex flex-col gap-3 text-[13px]">
          <a href="/login" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">
            &larr; Back to login
          </a>
          <a href="/otp-login" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Student/Parent mobile login
          </a>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13px] font-medium text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}
      {step === "mobile" && (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-5 text-left">
          <Input
            label="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="Enter registered mobile number"
            required
          />
          <div className="pt-2">
            <Button type="submit" loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Send Passcode
            </Button>
          </div>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5 text-left">
          <Input
            label="Secure passcode"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter the 6-digit code"
            required
            autoComplete="one-time-code"
          />
          <div className="pt-2">
            <Button type="submit" loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Verify Passcode
            </Button>
          </div>
        </form>
      )}
      {step === "reset" && (
        <form onSubmit={handleReset} className="flex flex-col gap-5 text-left">
          <Input
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            placeholder="Create a strong password"
            required
          />
          <div className="pt-2">
            <Button type="submit" loading={loading} fullWidth className="py-2.5 text-[15px] shadow-sm">
              Reset Password
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
