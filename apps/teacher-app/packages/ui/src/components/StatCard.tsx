import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, typography } from "../theme";

type StatColor = "jade" | "ink" | "sunrise" | "sky" | "rose" | "purple";

export default function StatCard({
  label,
  value,
  icon,
  trend,
  color = "jade",
  compact = false,
  onPress,
  subtitle,
  style,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: StatColor;
  compact?: boolean;
  onPress?: () => void;
  subtitle?: React.ReactNode;
  style?: ViewStyle;
}) {
  const content = (
    <View style={[styles.card, compact ? styles.compact : styles.regular, style]}>
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
          {trend ? (
            <Text style={[styles.trend, trend.positive ? styles.trendUp : styles.trendDown]}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </Text>
          ) : null}
          {subtitle ? <View style={styles.subtitle}>{subtitle}</View> : null}
        </View>
        {icon ? (
          <View style={[styles.iconWrap, styles[`icon_${color}`]]}>{icon}</View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.7)",
  },
  regular: {
    padding: 18,
  },
  compact: {
    padding: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  trend: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  trendUp: {
    color: colors.jade[600],
  },
  trendDown: {
    color: colors.rose[500],
  },
  subtitle: {
    marginTop: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon_jade: { backgroundColor: colors.jade[50], },
  icon_ink: { backgroundColor: colors.ink[100], },
  icon_sunrise: { backgroundColor: colors.sunrise[50], },
  icon_sky: { backgroundColor: colors.sky[50], },
  icon_rose: { backgroundColor: colors.rose[50], },
  icon_purple: { backgroundColor: colors.purple[50], },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
