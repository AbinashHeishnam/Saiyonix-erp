import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, typography } from "../theme";

export type SelectOption = { label: string; value: string };

export default function Select({
  label,
  value,
  options,
  placeholder = "Select",
  onChange,
  disabled,
}: {
  label?: string;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === value)?.label ?? "",
    [options, value]
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          disabled && styles.disabled,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.value, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label ?? "Select"}</Text>
            <ScrollView contentContainerStyle={styles.options}>
              {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={[styles.option, isActive && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  field: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    fontSize: 14,
    color: colors.ink[900],
    fontFamily: typography.fontBody,
  },
  placeholder: {
    color: colors.ink[400],
  },
  chevron: {
    fontSize: 14,
    color: colors.ink[400],
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 16,
    maxHeight: "80%",
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
    marginBottom: 10,
  },
  options: {
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionActive: {
    borderColor: colors.sky[400],
    backgroundColor: colors.sky[50],
  },
  optionText: {
    fontSize: 13,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  optionTextActive: {
    color: colors.sky[700],
    fontWeight: "600",
  },
});
