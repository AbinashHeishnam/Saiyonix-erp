import React, { useEffect, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors, radius, typography } from "../theme";

export default function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = setTimeout(() => inputs.current[0]?.focus(), 100);
    return () => clearTimeout(timeout);
  }, [autoFocus]);

  const handleChange = (index: number, text: string) => {
    const normalized = text.replace(/\D/g, "");
    if (!normalized) {
      const next = value.split("");
      next[index] = "";
      onChange(next.join(""));
      return;
    }
    const next = value.split("");
    next[index] = normalized.slice(-1);
    onChange(next.join(""));
    if (index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(el) => (inputs.current[index] = el)}
          style={styles.input}
          value={digit}
          onChangeText={(text) => handleChange(index, text)}
          keyboardType="number-pad"
          maxLength={1}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  input: {
    width: 46,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: "#f8fafc",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
    color: colors.ink[800],
  },
});
