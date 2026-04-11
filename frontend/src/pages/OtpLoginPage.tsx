import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Input from "../components/Input";
import { useAuth } from "../contexts/AuthContext";
import { OTP_DELIVERY_MODE } from "../config/otp";

export default function OtpLoginPage() {
  const { requestOtp, resendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [parentNumber, setParentNumber] = useState("");
  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);
  const SEND_COOLDOWN_SECONDS = 60;
  const deliveryLabel = OTP_DELIVERY_MODE === "call" ? "phone call" : "SMS";
  const normalizeMobile = (value: string) => value.replace(/\D/g, "");

  const getErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as { response?: { data?: { message?: string } }; message?: string };
    return maybe?.response?.data?.message ?? maybe?.message ?? fallback;
  };

  const applyRateLimitCooldown = (message: string) => {
    if (/10 minutes?/i.test(message)) {
      setSendCooldown(600);
      setResendCooldown(600);
      return;
    }
    if (/30 seconds?/i.test(message)) {
      setSendCooldown(30);
      setResendCooldown(30);
      return;
    }
    setSendCooldown(SEND_COOLDOWN_SECONDS);
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
    const normalizedMobile = normalizeMobile(parentNumber);
    if (!normalizedMobile) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setLoading(true);
    try {
      await requestOtp(normalizedMobile);
      setStep("otp");
      setResendCooldown(30);
      setSendCooldown(SEND_COOLDOWN_SECONDS);
      // focus first otp field shortly after transition
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const maybe = err as { response?: { status?: number; data?: { message?: string } } };
      if (maybe?.response?.status === 429) {
        const message = maybe.response?.data?.message ?? "Too many attempts, try again later";
        applyRateLimitCooldown(message);
      }
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    const normalizedMobile = normalizeMobile(parentNumber);
    if (!normalizedMobile) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setResendLoading(true);
    try {
      await resendOtp(normalizedMobile);
      setResendCooldown(30);
    } catch (err: unknown) {
      const maybe = err as { response?: { status?: number; data?: { message?: string } } };
      if (maybe?.response?.status === 429) {
        const message = maybe.response?.data?.message ?? "Too many attempts, try again later";
        applyRateLimitCooldown(message);
      }
      setError(getErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpArray.join("");
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setError("");
    const normalizedMobile = normalizeMobile(parentNumber);
    if (!normalizedMobile) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setLoading(true);
    try {
      const payload = await verifyOtp(normalizedMobile, otp);
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

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpArray];
    newOtp[index] = value.slice(-1);
    setOtpArray(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newOtp = [...otpArray];
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtpArray(newOtp);
      const targetIndex = pasted.length < 6 ? pasted.length : 5;
      inputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <AuthShell
      title="Student & Parent Login"
      subtitle={`Use your student/parent mobile number to receive a secure passcode via ${deliveryLabel}.`}
      audience="guardian"
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

          {step === "mobile" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-6 text-left">
              <Input
                label="Student or parent mobile number"
                value={parentNumber}
                onChange={(e) => setParentNumber(e.target.value)}
                placeholder="Ex. +91 9876543210"
                required
                autoComplete="tel"
                className="py-3 text-lg"
              />
              <div className="pt-2">
                <Button
                  type="submit"
                  loading={loading}
                  disabled={sendCooldown > 0}
                  fullWidth
                  className="py-3 text-[15px] shadow-sm hover:shadow-md transition-shadow"
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
                <div className="flex gap-2 sm:gap-3" onPaste={handlePaste}>
                  {otpArray.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      autoComplete="one-time-code"
                      className="h-12 w-[2.8rem] sm:h-14 sm:w-12 rounded-xl border border-slate-200 bg-white text-center text-xl font-semibold shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-sky-500 transition-all duration-200"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setOtpArray(Array(6).fill(""));
                    setStep("mobile");
                  }}
                  className="font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resendLoading}
                  className="font-medium text-sky-600 disabled:text-slate-400 dark:text-sky-400 dark:disabled:text-slate-500 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resendLoading ? "Sending..." : "Resend code"}
                </button>
              </div>
              <div className="pt-2">
                <Button type="submit" loading={loading} disabled={otpArray.join("").length < 6} fullWidth className="py-3 text-[15px] shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:bg-sky-500 transition-shadow">
                  Verify & Sign In &rarr;
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
