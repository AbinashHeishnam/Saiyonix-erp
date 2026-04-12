import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Input, OtpInput, Screen, colors, typography } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";
import useSchoolBranding from "../../hooks/useSchoolBranding";

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
  const { schoolName, logoUrl } = useSchoolBranding();

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

  const brandInitial = schoolName?.slice(0, 1).toUpperCase() || "S";

  return (
    <Screen background={colors.ink[50]}>
      <LinearGradient colors={[colors.white, "rgba(255,255,255,0)"]} style={styles.topGlow} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.brandImage} resizeMode="contain" />
            ) : (
              <Text style={styles.brandIconText}>{brandInitial}</Text>
            )}
          </View>
          <View>
            <Text style={styles.brandName}>{schoolName}</Text>
            <Text style={styles.brandSub}>SaiyoniX</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.badge}>Student & Parent Access</Text>
            <Text style={styles.title}>Student & Parent Login</Text>
            <Text style={styles.subtitle}>
              Use your student/parent mobile number to receive a secure passcode.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === "mobile" ? (
            <View style={styles.form}>
              <Input
                label="Student or parent mobile number"
                value={mobile}
                onChangeText={setMobile}
                placeholder="Ex. +91 9876543210"
                keyboardType="phone-pad"
              />
              <View style={styles.buttonWrap}>
                <Button
                  title={sendCooldown > 0 ? `Wait ${sendCooldown}s to resend` : "Send Passcode"}
                  onPress={handleSend}
                  loading={loading}
                  disabled={sendCooldown > 0}
                />
              </View>
            </View>
          ) : (
            <View style={styles.otpForm}>
              <View style={styles.otpHeader}>
                <Text style={styles.otpLabel}>Enter 6-digit secure code</Text>
                <OtpInput value={otp} onChange={setOtp} />
              </View>

              <View style={styles.linksRow}>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setOtp("");
                    setStep("mobile");
                  }}
                >
                  <Text style={styles.link}>Change number</Text>
                </Pressable>
                <Pressable onPress={handleResend} disabled={resendCooldown > 0 || loading}>
                  <Text style={[styles.linkStrong, (resendCooldown > 0 || loading) && styles.linkDisabled]}>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.buttonWrap}>
                <Button
                  title={loading ? "Verifying..." : "Verify & Sign In →"}
                  onPress={handleVerify}
                  loading={loading}
                  disabled={otp.length < 6}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.ink[900],
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  brandImage: {
    width: 30,
    height: 30,
  },
  brandIconText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  brandName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  brandSub: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  card: {
    marginTop: 30,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  header: {
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  error: {
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.rose[200],
    backgroundColor: colors.rose[50],
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.rose[600],
    fontSize: 13,
    fontWeight: "500",
    fontFamily: typography.fontBody,
  },
  form: {
    gap: 22,
  },
  otpForm: {
    gap: 26,
  },
  otpHeader: {
    alignItems: "center",
    gap: 16,
  },
  otpLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  linksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
  },
  link: {
    fontSize: 13,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "500",
  },
  linkStrong: {
    fontSize: 13,
    color: colors.sky[600],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  linkDisabled: {
    color: colors.ink[400],
  },
  buttonWrap: {
    paddingTop: 4,
  },
});
