import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography } from "@saiyonix/ui";
import useSchoolBranding from "../../hooks/useSchoolBranding";

export default function BrandedLoadingScreen({
  phase = "startup",
  message,
}: {
  phase?: "startup" | "bootstrap";
  message?: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const { schoolName, logoUrl } = useSchoolBranding();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const shimmer = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
    transform: [
      {
        scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
      },
    ],
  };

  const status =
    message ?? (phase === "startup" ? "Preparing your workspace" : "Syncing your session");

  return (
    <LinearGradient
      colors={[colors.ink[800], colors.ink[700], colors.sky[500]]}
      style={styles.container}
    >
      <View style={styles.brandBlock}>
        <Animated.View style={[styles.logoStub, shimmer]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <Text style={styles.logoText}>{schoolName.slice(0, 1).toUpperCase()}</Text>
          )}
        </Animated.View>
        <Text style={styles.title}>{schoolName}</Text>
        <Text style={styles.subtitle}>Teacher Workspace</Text>
      </View>
      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.white} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  brandBlock: {
    alignItems: "center",
    gap: 10,
  },
  statusRow: {
    alignItems: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontFamily: typography.fontBody,
  },
  logoStub: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  logoText: {
    fontSize: 22,
    color: colors.white,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  title: {
    fontSize: 22,
    color: colors.white,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontFamily: typography.fontBody,
  },
});
