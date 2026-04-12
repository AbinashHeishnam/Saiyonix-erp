import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, typography } from "../theme";

type InputSize = "sm" | "md" | "lg";

export default function Input({
  label,
  helper,
  error,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  inputSize = "md",
  leadingIcon,
}: {
  label?: string;
  helper?: string;
  error?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  inputSize?: InputSize;
  leadingIcon?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
        <TextInput
          style={[
            styles.input,
            styles[inputSize],
            leadingIcon ? styles.withIcon : null,
            error ? styles.inputError : null,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[300]}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: colors.ink[600],
    fontWeight: "600",
    fontFamily: typography.fontBody,
  },
  inputWrap: {
    position: "relative",
  },
  leading: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: [{ translateY: -10 }],
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: "#f8fafc",
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: typography.fontBody,
    color: colors.ink[900],
  },
  sm: {
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  md: {
    paddingVertical: 12,
  },
  lg: {
    paddingVertical: 14,
  },
  withIcon: {
    paddingLeft: 40,
  },
  inputError: {
    borderColor: colors.rose[400],
  },
  helper: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  error: {
    fontSize: 11,
    color: colors.rose[500],
    fontFamily: typography.fontBody,
  },
});
