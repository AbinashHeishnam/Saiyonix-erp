import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentTimetable, getStudentTimetable } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, SlotCard, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";

const DAY_NAMES = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function mapDay(dayOfWeek?: number) {
  if (!dayOfWeek) return "UNKNOWN";
  return DAY_NAMES[dayOfWeek - 1] ?? "UNKNOWN";
}

export default function StudentParentTimetableScreen() {
  const { role } = useAuth();
  const { activeStudent } = useActiveStudent();
  const query = useQuery({
    queryKey: ["timetable", role],
    queryFn: role === "PARENT" ? getParentTimetable : getStudentTimetable,
  });

  const parentTimetableEntry =
    role === "PARENT" && Array.isArray(query.data)
      ? query.data.find((entry: any) => entry.studentId === activeStudent?.id) ?? query.data[0]
      : null;

  const parentGrouped =
    role === "PARENT" && parentTimetableEntry?.slots
      ? parentTimetableEntry.slots.reduce((acc: Record<string, any[]>, slot: any) => {
          const key = mapDay(slot.dayOfWeek);
          if (!acc[key]) acc[key] = [];
          acc[key].push(slot);
          return acc;
        }, {})
      : null;

  const grouped = role === "PARENT" ? parentGrouped ?? {} : query.data ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title={role === "PARENT" ? "Child Timetable" : "My Timetable"} subtitle="Weekly class schedule" />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load timetable." /> : null}

      {grouped ? (
        <Card title="Weekly Timetable">
          {Object.keys(grouped).length === 0 ? (
            <EmptyState title="No timetable available" subtitle="Please check with the school." />
          ) : (
            <View style={styles.list}>
              {Object.entries(grouped).map(([day, slots]) => (
                <View key={day} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayAccent} />
                    <Text style={styles.day}>{day}</Text>
                  </View>
                  <View style={styles.daySlots}>
                    {(slots as any[]).map((slot, index) => (
                      <SlotCard key={`${day}-${index}`} slot={slot} showTeacher={role !== "PARENT"} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink[50],
  },
  content: {
    padding: 20,
    gap: 16,
  },
  list: {
    marginTop: 12,
    gap: 16,
  },
  dayBlock: {
    gap: 10,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayAccent: {
    width: 6,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.jade[500],
  },
  day: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  daySlots: {
    gap: 10,
  },
});
