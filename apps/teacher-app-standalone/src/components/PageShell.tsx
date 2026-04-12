import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LoadingState, colors } from "@saiyonix/ui";
import ScreenTransition from "./ScreenTransition";

export default function PageShell({
  children,
  loading,
  loadingLabel,
}: {
  children: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: loading ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [loading, overlayOpacity]);

  return (
    <View style={styles.container}>
      <ScreenTransition>{children}</ScreenTransition>
      <Animated.View
        pointerEvents={loading ? "auto" : "none"}
        style={[styles.loadingOverlay, { opacity: overlayOpacity }]}
      >
        <View style={styles.loadingCard}>
          <LoadingState label={loadingLabel ?? "Loading..."} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,250,252,0.72)",
  },
  loadingCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
