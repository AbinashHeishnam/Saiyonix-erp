import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "active" | "inactive";

const variants: Record<StatusVariant, { bg: string; text: string }> = {
  success: { bg: colors.jade[50], text: colors.jade[700] },
  warning: { bg: colors.sunrise[50], text: colors.sunrise[700] },
  danger: { bg: colors.rose[50], text: colors.rose[700] },
  info: { bg: colors.sky[50], text: colors.sky[700] },
  neutral: { bg: colors.ink[100], text: colors.ink[600] },
  active: { bg: colors.jade[50], text: colors.jade[700] },
  inactive: { bg: colors.ink[100], text: colors.ink[400] },
};

export default function StatusBadge({
  variant = "neutral",
  label,
  dot = true,
}: {
  variant?: StatusVariant;
  label: string;
  dot?: boolean;
}) {
  const v = variants[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: v.text }]} /> : null}
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
});
