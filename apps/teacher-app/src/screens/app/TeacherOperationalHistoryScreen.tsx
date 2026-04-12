import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  getAcademicYearTransitionMeta,
  getActiveAcademicYear,
  getTeacherProfile,
  getTeacherSubjectClasses,
  getTeacherTimetable,
  listAcademicYears,
} from "@saiyonix/api";
import { Card, EmptyState, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";

export default function TeacherOperationalHistoryScreen() {
  const [academicYearId, setAcademicYearId] = useState("");

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears({ page: 1, limit: 50 }),
  });
  const activeYearQuery = useQuery({
    queryKey: ["academic-years", "active"],
    queryFn: getActiveAcademicYear,
  });
  const transitionQuery = useQuery({
    queryKey: ["academic-years", "transition-meta"],
    queryFn: getAcademicYearTransitionMeta,
  });

  const profileQuery = useQuery({
    queryKey: ["teacher", "profile"],
    queryFn: getTeacherProfile,
  });

  const teacherId = profileQuery.data?.teacher?.id ?? profileQuery.data?.id ?? "";

  const years = useMemo(() => {
    const payload = yearsQuery.data?.data ?? yearsQuery.data?.items ?? yearsQuery.data ?? [];
    return Array.isArray(payload) ? payload : [];
  }, [yearsQuery.data]);

  const resolvedActiveYearId = activeYearQuery.data?.id ?? transitionQuery.data?.toAcademicYear?.id ?? "";
  const effectiveAcademicYearId = academicYearId || resolvedActiveYearId;

  const assignmentsQuery = useQuery({
    queryKey: ["teacher", "assignments", teacherId, effectiveAcademicYearId],
    queryFn: () =>
      teacherId && effectiveAcademicYearId
        ? getTeacherSubjectClasses({ teacherId, academicYearId: effectiveAcademicYearId, page: 1, limit: 200 })
        : Promise.resolve([]),
    enabled: Boolean(teacherId && effectiveAcademicYearId),
  });

  const timetableQuery = useQuery({
    queryKey: ["teacher", "timetable", teacherId, effectiveAcademicYearId],
    queryFn: () =>
      teacherId && effectiveAcademicYearId
        ? getTeacherTimetable(teacherId, { academicYearId: effectiveAcademicYearId })
        : Promise.resolve({}),
    enabled: Boolean(teacherId && effectiveAcademicYearId),
  });

  const timetableSummary = useMemo(() => {
    const entries = Object.entries(timetableQuery.data ?? {});
    return entries.map(([day, slots]) => ({
      day,
      count: Array.isArray(slots) ? slots.length : 0,
      slots: Array.isArray(slots) ? slots : [],
    }));
  }, [timetableQuery.data]);

  const hasTimetable = useMemo(
    () => timetableSummary.some((item) => item.count > 0),
    [timetableSummary]
  );

  const assignments = useMemo(() => {
    const payload = assignmentsQuery.data?.data ?? assignmentsQuery.data?.items ?? assignmentsQuery.data ?? [];
    return Array.isArray(payload) ? payload : [];
  }, [assignmentsQuery.data]);

  const derivedAssignments = useMemo(() => {
    const slots = Object.values(timetableQuery.data ?? {}).flat();
    const map = new Map<string, any>();
    slots.forEach((slot: any) => {
      const classId = slot.section?.class?.id ?? slot.section?.classId ?? "class";
      const sectionId = slot.section?.id ?? slot.sectionId ?? "section";
      const subjectId = slot.classSubject?.subject?.id ?? slot.classSubjectId ?? "subject";
      const key = `${classId}:${sectionId}:${subjectId}`;
      if (map.has(key)) return;
      map.set(key, {
        id: key,
        sectionId,
        academicYearId: effectiveAcademicYearId,
        classSubject: {
          class: { className: slot.section?.class?.className ?? "Class" },
          subject: { name: slot.classSubject?.subject?.name ?? "Subject" },
        },
        section: { sectionName: slot.section?.sectionName ?? "" },
      });
    });
    return Array.from(map.values());
  }, [timetableQuery.data, effectiveAcademicYearId]);

  const resolvedAssignments = assignments.length > 0 ? assignments : derivedAssignments;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Operational History" subtitle="Timetables and teaching assignments by academic year." />

      <Card>
        <Select
          label="Academic Year"
          value={effectiveAcademicYearId}
          onChange={setAcademicYearId}
          options={years.map((year: any) => ({ value: year.id, label: year.label }))}
          placeholder="Select academic year"
        />
      </Card>

      {!effectiveAcademicYearId ? (
        <Card>
          <EmptyState title="Select an academic year" subtitle="Choose an academic year to view your timetable and assignments." />
        </Card>
      ) : null}

      <Card title="Timetable" subtitle="Weekly timetable for the selected academic year">
        {timetableQuery.isLoading ? (
          <LoadingState label="Loading timetable" />
        ) : timetableQuery.error ? (
          <Text style={styles.errorText}>Unable to load timetable.</Text>
        ) : hasTimetable ? (
          <View style={styles.timetableGrid}>
            {timetableSummary.map((entry) => (
              <View key={entry.day} style={styles.dayCard}>
                <Text style={styles.dayLabel}>{entry.day}</Text>
                <View style={styles.daySlots}>
                  {entry.slots.map((slot: any, index: number) => (
                    <View key={`${entry.day}-${slot.period?.periodNumber ?? index}`} style={styles.daySlotRow}>
                      <View>
                        <Text style={styles.slotSubject}>{slot.classSubject?.subject?.name ?? "Subject"}</Text>
                        <Text style={styles.slotMeta}>
                          {slot.section?.class?.className ?? "Class"}
                          {slot.section?.sectionName ? ` ${slot.section.sectionName}` : ""}
                          {slot.period?.periodNumber ? ` • Period ${slot.period.periodNumber}` : ""}
                        </Text>
                      </View>
                      <Text style={styles.slotRoom}>{slot.roomNo ? `Room ${slot.roomNo}` : "Room —"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No timetable assigned" subtitle="No timetable is available for the selected academic year." />
        )}
      </Card>

      <Card title="Subject Assignments" subtitle="Classes and subjects for the selected academic year">
        {assignmentsQuery.isLoading ? (
          <LoadingState label="Loading assignments" />
        ) : assignmentsQuery.error ? (
          <Text style={styles.errorText}>Unable to load assignments.</Text>
        ) : resolvedAssignments.length > 0 ? (
          <View style={styles.assignmentList}>
            {resolvedAssignments.map((item: any) => (
              <View key={item.id} style={styles.assignmentRow}>
                <Text style={styles.assignmentText}>
                  {item.classSubject?.class?.className ?? "Class"}
                  {item.section?.sectionName ? ` - ${item.section.sectionName}` : ""}
                </Text>
                <Text style={styles.assignmentMeta}>{item.classSubject?.subject?.name ?? "Subject"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No assignments" subtitle="No subject assignments found for the selected academic year." />
        )}
      </Card>
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
  errorText: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
  },
  timetableGrid: {
    marginTop: 10,
    gap: 12,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    padding: 12,
    gap: 8,
  },
  dayLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  daySlots: {
    gap: 8,
  },
  daySlotRow: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  slotSubject: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  slotMeta: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  slotRoom: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  assignmentList: {
    gap: 8,
    marginTop: 10,
  },
  assignmentRow: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  assignmentText: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  assignmentMeta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
