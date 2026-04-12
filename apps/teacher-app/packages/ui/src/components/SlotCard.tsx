import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../theme";

type SlotLike = any;

function getSubject(slot: SlotLike) {
  return slot?.classSubject?.subject?.name ?? slot?.subject?.name ?? slot?.subjectName ?? "Subject";
}

function getTeacher(slot: SlotLike) {
  return slot?.teacher?.fullName ?? slot?.teacherName ?? "Teacher";
}

function getClassSection(slot: SlotLike) {
  const className = slot?.section?.class?.className ?? slot?.className ?? "";
  const sectionName = slot?.section?.sectionName ?? slot?.sectionName ?? "";
  return `${className}${sectionName ? ` - ${sectionName}` : ""}`.trim();
}

export default function SlotCard({
  slot,
  showClass,
  showTeacher,
  onPress,
}: {
  slot: SlotLike;
  showClass?: boolean;
  showTeacher?: boolean;
  onPress?: () => void;
}) {
  const subject = getSubject(slot);
  const teacher = getTeacher(slot);
  const classSection = getClassSection(slot);
  const period = slot?.period?.periodNumber ?? slot?.periodNumber ?? "-";

  const content = (
    <View style={styles.card}>
      <View style={styles.periodBadge}>
        <Text style={styles.periodText}>Period {period}</Text>
      </View>
      <Text style={styles.subject}>{subject}</Text>
      {showClass && classSection ? <Text style={styles.meta}>{classSection}</Text> : null}
      {showTeacher ? <Text style={styles.meta}>{teacher}</Text> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 14,
    gap: 6,
  },
  periodBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.jade[50],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  periodText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.jade[700],
    fontFamily: typography.fontBody,
  },
  subject: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
