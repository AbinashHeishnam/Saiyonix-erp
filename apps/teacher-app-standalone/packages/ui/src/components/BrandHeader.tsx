import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography } from "../theme";

export default function BrandHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <LinearGradient
      colors={[colors.ink[800], colors.ink[700]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    fontFamily: typography.fontBody,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    color: colors.white,
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
});
