import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, typography } from "../theme";

export default function AuthShell({
  title,
  subtitle,
  badge,
  helper,
  brandName = "SaiyoniX",
  brandSub = "SaiyoniX ERP",
  brandLogoUrl,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  helper?: React.ReactNode;
  brandName?: string;
  brandSub?: string;
  brandLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const initial = brandName?.trim().slice(0, 1).toUpperCase() || "S";
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.white, "rgba(255,255,255,0)"]}
        style={styles.topGlow}
      />

      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          {brandLogoUrl ? (
            <Image source={{ uri: brandLogoUrl }} style={styles.brandImage} resizeMode="contain" />
          ) : (
            <Text style={styles.brandIconText}>{initial}</Text>
          )}
        </View>
        <View>
          <Text style={styles.brandName}>{brandName}</Text>
          <Text style={styles.brandSub}>{brandSub}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {badge ? <Text style={styles.badgeText}>{badge}</Text> : null}
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        <View style={styles.content}>{children}</View>
        {helper ? <View style={styles.helper}>{helper}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[50],
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 6,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.ink[900],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandImage: {
    width: 32,
    height: 32,
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
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  card: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.6)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  headerTitle: {
    color: colors.ink[900],
    fontSize: 24,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
    marginTop: 8,
  },
  headerSubtitle: {
    color: colors.ink[600],
    fontSize: 14,
    fontFamily: typography.fontBody,
    marginTop: 6,
  },
  content: {
    marginTop: 18,
    gap: 16,
  },
  helper: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
  },
});
