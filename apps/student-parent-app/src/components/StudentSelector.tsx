import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@saiyonix/ui";

export default function StudentSelector({
  students,
  activeId,
  onSelect,
  label = "Select Student",
}: {
  students: Array<{ id: string; fullName?: string | null }>;
  activeId: string | null;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (!students.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {students.map((student) => {
          const isActive = student.id === activeId;
          return (
            <Pressable
              key={student.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(student.id)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {student.fullName ?? "Student"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  chipActive: {
    backgroundColor: colors.sky[100],
  },
  chipText: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  chipTextActive: {
    color: colors.sky[700],
    fontWeight: "700",
  },
});
