import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthShell, Button, Input, OtpInput, Screen, colors, typography } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";

const SEND_COOLDOWN_SECONDS = 60;

export default function OtpLoginScreen() {
  const { requestOtp, resendOtp, verifyOtp, logout } = useAuth();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (sendCooldown <= 0) return;
    const timer = setInterval(() => setSendCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [sendCooldown]);

  const normalizeMobile = (value: string) => value.replace(/\D/g, "");

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

  const handleSend = async () => {
    if (sendCooldown > 0) return;
    setError(null);
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setLoading(true);
    try {
      await requestOtp(normalized);
      setStep("otp");
      setResendCooldown(30);
      setSendCooldown(SEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Failed to send OTP";
      if (err?.response?.status === 429) applyRateLimitCooldown(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setLoading(true);
    try {
      await resendOtp(normalized);
      setResendCooldown(30);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Failed to resend OTP";
      if (err?.response?.status === 429) applyRateLimitCooldown(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setError(null);
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setLoading(true);
    try {
      const payload = await verifyOtp(normalized, otp);
      if (payload.user?.role?.roleType !== "STUDENT" && payload.user?.role?.roleType !== "PARENT") {
        await logout();
        setError("This account is not a student/parent account.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AuthShell
        title="Student & Parent Login"
        subtitle="Use your student/parent mobile number to receive a secure passcode."
        badge="Student & Parent"
      >
        <View style={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === "mobile" ? (
            <>
              <Input
                label="Student or parent mobile number"
                value={mobile}
                onChangeText={setMobile}
                placeholder="Ex. +91 9876543210"
                keyboardType="phone-pad"
              />
              <Button
                title={sendCooldown > 0 ? `Wait ${sendCooldown}s to resend` : "Send Passcode"}
                onPress={handleSend}
                loading={loading}
                disabled={sendCooldown > 0}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter 6-digit secure code</Text>
              <OtpInput value={otp} onChange={setOtp} />
              <Button title={loading ? "Verifying..." : "Verify & Sign In →"} onPress={handleVerify} loading={loading} />
              <View style={styles.links}>
                <Text style={styles.link} onPress={() => setStep("mobile")}>Change number</Text>
                <Text style={styles.linkEm} onPress={handleResend}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </Text>
              </View>
            </>
          )}
        </View>
      </AuthShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  error: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.rose[50],
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
  label: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  links: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  link: {
    fontSize: 13,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  linkEm: {
    fontSize: 13,
    color: colors.sky[600],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
});
