import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Screen, colors, typography } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";

export default function RoleMismatchScreen() {
  const { logout } = useAuth();
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Student & Parent Access Only</Text>
        <Text style={styles.subtitle}>
          This app is restricted to student and parent accounts. Please sign in with the correct account.
        </Text>
        <Button title="Back to Login" onPress={() => logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 14,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
