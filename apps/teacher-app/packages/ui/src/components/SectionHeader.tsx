import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

type AccentColor = "blue" | "purple" | "rose" | "emerald" | "amber" | "sky" | "slate";

export default function SectionHeader({
  title,
  subtitle,
  accent = "slate",
  actions,
}: {
  title: string;
  subtitle?: string;
  accent?: AccentColor;
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={[styles.accentBar, styles[accent]]} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accentBar: {
    width: 6,
    height: 18,
    borderRadius: 999,
  },
  blue: { backgroundColor: "#3b82f6" },
  purple: { backgroundColor: "#8b5cf6" },
  rose: { backgroundColor: "#f43f5e" },
  emerald: { backgroundColor: "#10b981" },
  amber: { backgroundColor: "#f59e0b" },
  sky: { backgroundColor: "#0ea5e9" },
  slate: { backgroundColor: colors.ink[400] },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    marginLeft: 14,
  },
  actions: {
    marginTop: 6,
  },
});
