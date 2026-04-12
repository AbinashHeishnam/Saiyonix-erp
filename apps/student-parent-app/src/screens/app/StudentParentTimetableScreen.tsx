import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentTimetable, getStudentTimetable } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function mapDay(dayOfWeek?: number) {
  if (!dayOfWeek) return "UNKNOWN";
  return DAYS[dayOfWeek - 1] ?? "UNKNOWN";
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}:${m ?? "00"} ${suffix}`;
}

function normalizeSlots(payload: any[]): any[] {
  return payload.map((slot) => ({
    ...slot,
    subjectName:
      slot?.classSubject?.subject?.name ??
      slot?.subject?.name ??
      slot?.subjectName ??
      "Subject",
    teacherName: slot?.teacher?.fullName ?? slot?.teacherName ?? "Teacher",
    className: slot?.section?.class?.className ?? slot?.className ?? "",
    sectionName: slot?.section?.sectionName ?? slot?.sectionName ?? "",
    roomNo: slot?.roomNo ?? slot?.room ?? slot?.roomNumber ?? "—",
    startTime: slot?.period?.startTime ?? slot?.startTime ?? null,
    endTime: slot?.period?.endTime ?? slot?.endTime ?? null,
  }));
}

export default function StudentParentTimetableScreen() {
  const { role } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const query = useQuery<any>({
    queryKey: ["timetable", role],
    queryFn: async () => (role === "PARENT" ? getParentTimetable() : getStudentTimetable()),
  });

  const parentTimetableEntry =
    role === "PARENT" && Array.isArray(query.data)
      ? query.data.find((entry: any) => entry.studentId === activeStudentId) ?? query.data[0]
      : null;

  const slots = useMemo(() => {
    if (role === "PARENT") return normalizeSlots(parentTimetableEntry?.slots ?? []);
    const grouped = query.data ?? {};
    const raw = Object.values(grouped).flat() as any[];
    return normalizeSlots(raw);
  }, [parentTimetableEntry?.slots, query.data, role]);

  const groupedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    DAYS.forEach((day) => {
      map[day] = [];
    });
    slots.forEach((slot) => {
      const day = mapDay(slot.dayOfWeek);
      if (!map[day]) map[day] = [];
      map[day].push(slot);
    });
    Object.values(map).forEach((items) => items.sort((a, b) => `${a.startTime}`.localeCompare(`${b.startTime}`)));
    return map;
  }, [slots]);

  const todayIndex = ((new Date().getDay() + 6) % 7) + 1;
  const todaysSlots = groupedByDay[mapDay(todayIndex)] ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title={role === "PARENT" ? "Child Timetable" : "My Timetable"} subtitle="Weekly class schedule" />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to view timetable">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load timetable." /> : null}

      <View style={styles.toggleWrap}>
        {(["day", "week", "month"] as const).map((item) => (
          <Pressable key={item} style={[styles.toggleChip, view === item && styles.toggleChipActive]} onPress={() => setView(item)}>
            <Text style={[styles.toggleText, view === item && styles.toggleTextActive]}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Card title={view === "day" ? "Day View" : view === "week" ? "Week View" : "Month View"}>
        {!slots.length ? (
          <EmptyState title="No timetable available" subtitle="Please check with the school." />
        ) : view === "day" ? (
          <View style={styles.dayList}>
            {todaysSlots.length ? (
              todaysSlots.map((slot) => (
                <Pressable key={`${slot.classSubjectId ?? slot.subjectName}-${slot.dayOfWeek}-${slot.startTime}`} onPress={() => setSelectedSlot(slot)}>
                  {({ pressed }) => (
                    <View style={[styles.subjectCard, pressed && styles.pressedCard]}>
                      <Text style={styles.subjectTime}>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</Text>
                      <Text style={styles.subjectTitle}>{slot.subjectName}</Text>
                      <Text style={styles.subjectMeta}>{slot.teacherName}</Text>
                    </View>
                  )}
                </Pressable>
              ))
            ) : (
              <EmptyState title="No classes scheduled" subtitle="No classes scheduled for today." />
            )}
          </View>
        ) : view === "week" ? (
          <View style={styles.weekGrid}>
            {DAYS.slice(0, 6).map((day) => (
              <View key={day} style={styles.weekColumn}>
                <Text style={styles.weekDay}>{day.slice(0, 3)}</Text>
                {groupedByDay[day]?.length ? (
                  groupedByDay[day].map((slot) => (
                    <Pressable key={`${day}-${slot.classSubjectId ?? slot.subjectName}-${slot.startTime}`} onPress={() => setSelectedSlot(slot)}>
                      {({ pressed }) => (
                        <View style={[styles.weekSlot, pressed && styles.pressedCard]}>
                          <Text style={styles.weekSlotTitle}>{slot.subjectName}</Text>
                          <Text style={styles.weekSlotMeta}>{formatTime(slot.startTime)}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.emptyWeekSlot}>
                    <Text style={styles.emptyWeekText}>No classes</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.monthGrid}>
            {DAY_SHORT.map((day) => (
              <Text key={day} style={styles.monthHeader}>{day}</Text>
            ))}
            {Array.from({ length: 35 }).map((_, idx) => {
              const date = idx + 1;
              const dow = idx % 7;
              const mapped = dow === 0 ? 7 : dow;
              const daySlots = groupedByDay[mapDay(mapped)] ?? [];
              return (
                <View key={`month-${idx}`} style={styles.monthCell}>
                  <Text style={styles.monthDate}>{date <= 31 ? date : ""}</Text>
                  {date <= 31 && daySlots.length ? (
                    <Pressable onPress={() => setSelectedSlot(daySlots[0])} style={styles.monthAction}>
                      <Text style={styles.monthActionText}>VIEW</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Modal visible={Boolean(selectedSlot)} transparent animationType="fade" onRequestClose={() => setSelectedSlot(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedSlot ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Class Details</Text>
                  <Pressable onPress={() => setSelectedSlot(null)}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Subject</Text>
                  <Text style={styles.detailValue}>{selectedSlot.subjectName}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Teacher</Text>
                  <Text style={styles.detailValue}>{selectedSlot.teacherName}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Room</Text>
                  <Text style={styles.detailValue}>{selectedSlot.roomNo}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  toggleWrap: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.ink[50],
    borderWidth: 1,
    borderColor: colors.ink[100],
    padding: 4,
    gap: 6,
  },
  toggleChip: {
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleChipActive: {
    backgroundColor: colors.jade[500],
  },
  toggleText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: colors.white,
  },
  dayList: {
    gap: 12,
  },
  subjectCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.sky[600],
  },
  subjectTime: {
    fontSize: 11,
    color: "#dbeafe",
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  subjectTitle: {
    marginTop: 8,
    fontSize: 18,
    color: colors.white,
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  subjectMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#e0f2fe",
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  weekGrid: {
    gap: 12,
  },
  weekColumn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 12,
    gap: 10,
  },
  weekDay: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  weekSlot: {
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    padding: 10,
  },
  weekSlotTitle: {
    fontSize: 12,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  weekSlotMeta: {
    marginTop: 4,
    fontSize: 10,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  emptyWeekSlot: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.ink[200],
    padding: 12,
    alignItems: "center",
  },
  emptyWeekText: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  monthHeader: {
    width: "13%",
    textAlign: "center",
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  monthCell: {
    width: "13%",
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 8,
    justifyContent: "space-between",
  },
  monthDate: {
    fontSize: 11,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  monthAction: {
    borderRadius: 8,
    backgroundColor: colors.ink[100],
    paddingVertical: 4,
    alignItems: "center",
  },
  monthActionText: {
    fontSize: 9,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  pressedCard: {
    opacity: 0.82,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: colors.white,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  closeText: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 14,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
});
