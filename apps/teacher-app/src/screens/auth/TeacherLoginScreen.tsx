import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@saiyonix/auth";
import { AuthShell, Button, Input, Screen, colors, typography } from "@saiyonix/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TeacherAuthStackParamList } from "../../navigation/TeacherAuthStack";
import useSchoolBranding from "../../hooks/useSchoolBranding";

export default function TeacherLoginScreen({ navigation }: NativeStackScreenProps<TeacherAuthStackParamList, "TeacherLogin">) {
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { schoolName, logoUrl } = useSchoolBranding();

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = await login(email.trim(), password);
      if (payload.user?.role?.roleType !== "TEACHER") {
        setError("This account is not a teacher account.");
        await logout();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AuthShell
        title="Teacher Workspace"
        subtitle="Sign in to manage classes, assignments, and daily attendance."
        badge="Teacher Workspace"
        brandName={schoolName}
        brandSub="Teacher Workspace"
        brandLogoUrl={logoUrl}
        helper={
          <View style={styles.links}>
            <Text style={styles.link} onPress={() => navigation.navigate("TeacherAccess", { mode: "forgot" })}>
              Forgot password?
            </Text>
            <Text style={styles.linkEm} onPress={() => navigation.navigate("TeacherAccess", { mode: "activate" })}>
              Activate new teacher workspace →
            </Text>
          </View>
        }
      >
        <View style={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Input
            label="Teacher email"
            value={email}
            onChangeText={setEmail}
            placeholder="teacher@school.edu"
            keyboardType="email-address"
          />
          <View style={styles.passwordWrap}>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
            />
            <Text style={styles.showToggle} onPress={() => setShowPassword((prev) => !prev)}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </View>
          <Button
            title={loading ? "Processing..." : "Open Teacher Workspace"}
            onPress={handleLogin}
            loading={loading}
          />
        </View>
      </AuthShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingTop: 4,
  },
  error: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.rose[50],
    color: colors.rose[600],
    fontFamily: typography.fontBody,
    fontSize: 12,
    lineHeight: 18,
  },
  links: {
    gap: 10,
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
  passwordWrap: {
    gap: 8,
  },
  showToggle: {
    alignSelf: "flex-end",
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink[400],
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: typography.fontBody,
  },
});
