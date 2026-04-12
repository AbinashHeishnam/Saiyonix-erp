import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getTeacherProfile, getTeacherTimetable, getTeacherToday } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, PageHeader, SlotCard, colors, typography } from "@saiyonix/ui";
import { formatTime as formatTime24 } from "@saiyonix/utils";
import PageShell from "../../components/PageShell";

type SlotLike = any;

function formatTime(value?: string | null) {
  if (!value) return "—";
  if (value.includes("T")) {
    const timePart = value.split("T")[1]?.split(".")[0] ?? "";
    if (timePart) {
      const [h, m] = timePart.split(":");
      const hours = Number(h);
      const minutes = Number(m);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        const hour12 = ((hours + 11) % 12) + 1;
        const suffix = hours >= 12 ? "PM" : "AM";
        return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
      }
    }
  }
  const parts = value.split(":");
  if (parts.length >= 2) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      const hour12 = ((hours + 11) % 12) + 1;
      const suffix = hours >= 12 ? "PM" : "AM";
      return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
    }
  }
  return formatTime24(value, value);
}

function getSubject(slot: SlotLike) {
  return slot?.classSubject?.subject?.name ?? slot?.subject?.name ?? slot?.subjectName ?? "Subject";
}

function getClassSection(slot: SlotLike) {
  const className = slot?.section?.class?.className ?? slot?.className ?? "";
  const sectionName = slot?.section?.sectionName ?? slot?.sectionName ?? "";
  return `${className}${sectionName ? ` - ${sectionName}` : ""}`.trim();
}

function getTimeRange(slot: SlotLike) {
  const start = slot?.period?.startTime ?? slot?.periodStartTime;
  const end = slot?.period?.endTime ?? slot?.periodEndTime;
  if (!start && !end) return "—";
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export default function TeacherTimetableScreen() {
  const profileQuery = useQuery({
    queryKey: ["teacher", "profile"],
    queryFn: getTeacherProfile,
  });

  const teacherId = profileQuery.data?.teacher?.id ?? profileQuery.data?.id ?? "";
  const timetableQuery = useQuery({
    queryKey: ["timetable", "teacher", teacherId],
    queryFn: () => getTeacherTimetable(teacherId),
    enabled: Boolean(teacherId),
  });
  const todayQuery = useQuery({
    queryKey: ["timetable", "teacher", "today"],
    queryFn: getTeacherToday,
  });

  const todayName = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toUpperCase(),
    []
  );
  const rawWeeklyToday = timetableQuery.data?.[todayName as keyof typeof timetableQuery.data] as any;
  const weeklyTodaySlots = Array.isArray(rawWeeklyToday)
    ? rawWeeklyToday
    : Array.isArray(rawWeeklyToday?.slots)
      ? rawWeeklyToday.slots
      : [];
  const todaySlots = todayQuery.data?.slots?.length ? todayQuery.data.slots : weeklyTodaySlots;
  const hasWeeklyTimetable = Boolean(timetableQuery.data && Object.keys(timetableQuery.data).length);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const isLoading = profileQuery.isLoading || timetableQuery.isLoading;

  return (
    <PageShell loading={isLoading} loadingLabel="Loading timetable">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="My Timetable" subtitle="Weekly schedule and today’s classes" />

      {profileQuery.error || timetableQuery.error ? <ErrorState message="Unable to load timetable." /> : null}

      <Card title="Today">
        {todayQuery.data?.holiday ? (
          <Text style={styles.meta}>No classes today ({todayQuery.data.holiday}).</Text>
        ) : todaySlots?.length ? (
          <View style={styles.grid}>
            {todaySlots.map((slot: any, idx: number) => (
              <SlotCard
                key={slot.id ?? `today-${idx}`}
                slot={slot}
                showClass
                onPress={() => setSelectedSlot(slot)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>
            {hasWeeklyTimetable ? "No classes scheduled for today." : "No timetable assigned for the active academic year."}
          </Text>
        )}
      </Card>

      {timetableQuery.data ? (
        <Card title="Weekly Timetable">
          {Object.keys(timetableQuery.data).length === 0 ? (
            <EmptyState title="No timetable assigned" subtitle="No timetable assigned for the active academic year." />
          ) : (
            <View style={styles.list}>
              {Object.entries(timetableQuery.data).map(([day, slots]) => (
                <View key={day} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayAccent} />
                    <Text style={styles.day}>{day}</Text>
                  </View>
                  <View style={styles.daySlots}>
                    {(Array.isArray(slots) ? slots : (slots as any)?.slots ?? []).map((slot: any, index: number) => (
                      <SlotCard
                        key={`${day}-${index}`}
                        slot={slot}
                        showClass
                        onPress={() => setSelectedSlot(slot)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      <Modal
        visible={Boolean(selectedSlot)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSlot(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedSlot(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedSlot ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Class Details</Text>
                  <Pressable
                    accessibilityLabel="Close"
                    onPress={() => setSelectedSlot(null)}
                    style={styles.modalCloseIcon}
                  >
                    <Text style={styles.modalCloseIconText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.modalBody}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Subject</Text>
                    <Text style={styles.modalValueStrong}>{getSubject(selectedSlot)}</Text>
                  </View>
                  {getClassSection(selectedSlot) ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Class</Text>
                      <Text style={styles.modalValue}>{getClassSection(selectedSlot)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Time</Text>
                    <Text style={styles.modalValue}>{getTimeRange(selectedSlot)}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    </PageShell>
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
  grid: {
    gap: 12,
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
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  modalCloseIcon: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modalCloseIconText: {
    fontSize: 14,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  modalBody: {
    gap: 12,
  },
  modalSection: {
    gap: 4,
  },
  modalLabel: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modalValueStrong: {
    fontSize: 16,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  modalValue: {
    fontSize: 13,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
});
