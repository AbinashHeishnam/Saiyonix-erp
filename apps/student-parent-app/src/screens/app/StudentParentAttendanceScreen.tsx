import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentDashboard, getStudentDashboard, listStudentAttendance } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import AppDatePicker from "../../components/AppDatePicker";
import StudentSelector from "../../components/StudentSelector";

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Select date";
}

export default function StudentParentAttendanceScreen() {
  const { role } = useAuth();
  const { activeStudent, activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);

  const query = useQuery<any>({
    queryKey: ["attendance", role],
    queryFn: async () => (role === "PARENT" ? getParentDashboard() : getStudentDashboard()),
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance", "records", activeStudentId, fromDate, toDate],
    queryFn: () =>
      listStudentAttendance({
        studentId: activeStudentId ?? undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    enabled: Boolean(activeStudentId),
  });

  const summary =
    role === "PARENT"
      ? query.data?.children?.find((child: any) => child.studentId === activeStudentId)?.attendanceSummary ??
        query.data?.children?.[0]?.attendanceSummary
      : query.data?.attendanceSummary;

  const records = useMemo(() => recordsQuery.data?.data ?? recordsQuery.data ?? [], [recordsQuery.data]);
  const totalDays = useMemo(
    () =>
      (summary?.presentDays ?? 0) +
      (summary?.absentDays ?? 0) +
      (summary?.lateDays ?? 0) +
      (summary?.halfDays ?? 0),
    [summary]
  );
  const presentPct = totalDays ? Math.round(((summary?.presentDays ?? 0) / totalDays) * 100) : 0;
  const absentPct = totalDays ? Math.round(((summary?.absentDays ?? 0) / totalDays) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Attendance"
        subtitle={activeStudent?.fullName ? `Tracking ${activeStudent.fullName}` : "Track attendance records"}
      />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load attendance." /> : null}

      {summary ? (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Present %" value={`${presentPct}%`} color="jade" />
            <StatCard label="Absent %" value={`${absentPct}%`} color="sunrise" />
            <StatCard label="Total Days" value={String(totalDays)} color="sky" />
          </View>

          <Card title="Attendance Records" subtitle="Filter by date range">
            {role === "PARENT" && parentStudents.length ? (
              <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
            ) : null}

            <View style={styles.filterRow}>
              <Pressable style={styles.dateField} onPress={() => setPickerField("from")}>
                <Text style={styles.metaLabel}>From</Text>
                <Text style={styles.dateValue}>{fromDate ? formatDate(fromDate) : "Select date"}</Text>
              </Pressable>
              <Pressable style={styles.dateField} onPress={() => setPickerField("to")}>
                <Text style={styles.metaLabel}>To</Text>
                <Text style={styles.dateValue}>{toDate ? formatDate(toDate) : "Select date"}</Text>
              </Pressable>
              <Button title="Apply" size="sm" onPress={() => recordsQuery.refetch()} />
            </View>

            {recordsQuery.isLoading ? (
              <LoadingState label="Loading attendance" />
            ) : recordsQuery.error ? (
              <Text style={styles.meta}>Failed to load attendance.</Text>
            ) : records.length ? (
              <View style={styles.list}>
                {records.map((record: any) => (
                  <View key={record.id} style={styles.listItem}>
                    <Text style={styles.listTitle}>{record.attendanceDate?.slice(0, 10)}</Text>
                    <Text style={styles.meta}>{record.status}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No attendance records" subtitle="No attendance data found for the selected dates." />
            )}
          </Card>
        </>
      ) : (
        <EmptyState title="No attendance data" subtitle="Check back after attendance is marked." />
      )}

      <AppDatePicker
        visible={pickerField !== null}
        title={pickerField === "from" ? "Select From Date" : "Select To Date"}
        value={pickerField === "from" ? fromDate : pickerField === "to" ? toDate : undefined}
        onCancel={() => setPickerField(null)}
        onConfirm={(selectedDate) => {
          const iso = toIsoDate(selectedDate);
          if (pickerField === "from") setFromDate(iso);
          if (pickerField === "to") setToDate(iso);
          setPickerField(null);
        }}
      />
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
  statsRow: {
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "flex-end",
  },
  dateField: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    gap: 4,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  dateValue: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  list: {
    marginTop: 12,
    gap: 10,
  },
  listItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
});
