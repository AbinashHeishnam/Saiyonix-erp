import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../theme";

export function EmptyState({
  title,
  subtitle,
  compact,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <View style={[styles.container, styles.compact]}>
        <View style={styles.iconMini} />
        <View style={styles.compactText}>
          <Text style={styles.compactTitle}>{title}</Text>
          {subtitle ? <Text style={styles.compactSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <View style={styles.iconLarge} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.rose[600] }]}>{message}</Text>
    </View>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.ink[700]} />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
  },
  compact: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  iconLarge: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.ink[100],
  },
  iconMini: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.ink[100],
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  subtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    textAlign: "center",
  },
  compactText: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  compactSubtitle: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
