import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme";

export default function Screen({
  children,
  style,
  background = colors.ink[50],
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  background?: string;
}) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={background} />
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
