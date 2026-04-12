import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, typography } from "../theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type ButtonSize = "sm" | "md" | "lg";

export default function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
  fullWidth,
  style,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.ink[700] : colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "ghost" && styles.textGhost,
            variant === "secondary" && styles.textSecondary,
            size === "sm" && styles.textSm,
            size === "lg" && styles.textLg,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  sm: {
    paddingVertical: 7,
  },
  md: {
    paddingVertical: 11,
  },
  lg: {
    paddingVertical: 13,
  },
  primary: {
    backgroundColor: colors.sky[600],
    borderWidth: 1,
    borderColor: colors.sky[700],
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.rose[600],
    borderWidth: 1,
    borderColor: colors.rose[600],
  },
  success: {
    backgroundColor: colors.jade[600],
    borderWidth: 1,
    borderColor: colors.jade[600],
  },
  warning: {
    backgroundColor: colors.sunrise[500],
    borderWidth: 1,
    borderColor: colors.sunrise[600],
  },
  text: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  textSm: {
    fontSize: 13,
  },
  textLg: {
    fontSize: 15,
  },
  textSecondary: {
    color: colors.ink[700],
  },
  textGhost: {
    color: colors.ink[700],
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
