import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "@saiyonix/auth";
import { AuthShell, Button, Input, OtpInput, Screen, colors, typography } from "@saiyonix/ui";
import type { TeacherAuthStackParamList } from "../../navigation/TeacherAuthStack";

export default function TeacherAccessScreen({ route, navigation }: NativeStackScreenProps<TeacherAuthStackParamList, "TeacherAccess">) {
  const mode = route.params.mode;
  const {
    requestTeacherActivation,
    verifyTeacherActivation,
    completeTeacherActivation,
    requestTeacherForgotPassword,
    verifyTeacherForgotPassword,
    completeTeacherForgotPassword,
  } = useAuth();

  const [step, setStep] = useState<"identify" | "otp" | "password" | "success">("identify");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const passwordMismatch = useMemo(
    () => Boolean(password && confirmPassword && password !== confirmPassword),
    [password, confirmPassword]
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequest = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "activate") {
        await requestTeacherActivation(identifier.trim());
      } else {
        await requestTeacherForgotPassword(identifier.trim());
      }
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
      setMessage("A secure passcode has been sent to your email.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setMessage(null);
    if (otp.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }
    setLoading(true);
    try {
      const payload =
        mode === "activate"
          ? await verifyTeacherActivation(identifier.trim(), otp)
          : await verifyTeacherForgotPassword(identifier.trim(), otp);
      const token = (payload as any)?.resetToken;
      if (!token) throw new Error("Reset token missing. Please try again.");
      setResetToken(token);
      setStep("password");
      setMessage("Verification successful. Please set your new password.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!resetToken) return;
    setError(null);
    setMessage(null);
    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "activate") {
        await completeTeacherActivation(resetToken, password);
      } else {
        await completeTeacherForgotPassword(resetToken, password);
      }
      setStep("success");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AuthShell
        title={mode === "activate" ? "Teacher Activation" : "Reset Password"}
        subtitle={
          mode === "activate"
            ? "Complete your verification to activate your teacher profile."
            : "Verify your teacher identity for password change."
        }
        badge="Teacher Workspace"
        helper={
          <Text style={styles.link} onPress={() => navigation.navigate("TeacherLogin")}>
            ← Back to login
          </Text>
        }
      >
        <View style={styles.content}>
          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === "identify" ? (
            <>
              <Input
                label="Teacher Email"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="name@school.edu"
              />
              <Button title={loading ? "Sending..." : "Send Passcode →"} onPress={handleRequest} loading={loading} />
            </>
          ) : null}

          {step === "otp" ? (
            <>
              <Text style={styles.label}>Enter 6-digit secure code</Text>
              <OtpInput value={otp} onChange={setOtp} />
              <View style={styles.otpLinks}>
                <Text style={styles.link} onPress={() => setStep("identify")}>
                  Change details
                </Text>
                <Text style={styles.linkEm} onPress={handleRequest}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </Text>
              </View>
              <Button title={loading ? "Verifying..." : "Verify Passcode →"} onPress={handleVerify} loading={loading} />
            </>
          ) : null}

          {step === "password" ? (
            <>
              <Input
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a strong password"
                secureTextEntry
              />
              <Input
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                secureTextEntry
                error={passwordMismatch ? "Passwords do not match" : undefined}
              />
              <Button title={loading ? "Updating..." : "Update & Finish →"} onPress={handleComplete} loading={loading} />
            </>
          ) : null}

          {step === "success" ? (
            <>
              <Text style={styles.successTitle}>Profile Secured</Text>
              <Text style={styles.successText}>
                Your password has been updated successfully. You can now use your new credentials to log in.
              </Text>
              <Button title="Return to Teacher Login" onPress={() => navigation.navigate("TeacherLogin")} />
            </>
          ) : null}
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
  success: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.jade[50],
    color: colors.jade[700],
    fontFamily: typography.fontBody,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    textAlign: "center",
  },
  successText: {
    fontSize: 13,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    textAlign: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  otpLinks: {
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
