import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, shadows, typography } from "../theme";

type CardVariant = "default" | "outline" | "ghost" | "elevated";

export default function Card({
  title,
  subtitle,
  description,
  actions,
  children,
  style,
  noPadding = false,
  variant = "default",
}: {
  title?: string;
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
  variant?: CardVariant;
}) {
  const sub = subtitle ?? description;
  return (
    <View style={[styles.card, styles[variant], style]}>
      {title || actions ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {sub ? <Text style={styles.subtitle}>{sub}</Text> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      ) : null}
      <View style={[styles.body, noPadding && styles.noPadding]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
  },
  default: {
    backgroundColor: colors.white,
    borderColor: "rgba(226,232,240,0.7)",
    ...shadows.card,
  },
  outline: {
    backgroundColor: colors.white,
    borderColor: colors.ink[200],
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  elevated: {
    backgroundColor: colors.white,
    borderColor: "rgba(226,232,240,0.5)",
    ...shadows.soft,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(226,232,240,0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  body: {
    padding: 20,
  },
  noPadding: {
    padding: 0,
  },
});
