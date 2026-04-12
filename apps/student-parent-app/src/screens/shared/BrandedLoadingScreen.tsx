import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography } from "@saiyonix/ui";

export default function BrandedLoadingScreen() {
  return (
    <LinearGradient
      colors={[colors.ink[800], colors.ink[700], colors.jade[500]]}
      style={styles.container}
    >
      <View style={styles.brandBlock}>
        <View style={styles.logoStub} />
        <Text style={styles.title}>SaiyoniX ERP</Text>
        <Text style={styles.subtitle}>Student & Parent App</Text>
      </View>
      <ActivityIndicator color={colors.white} />
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
  logoStub: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
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
