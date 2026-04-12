import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentDashboard, getStudentDashboard, listStudentAttendance } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, colors, typography } from "@saiyonix/ui";
import { formatPercentage } from "@saiyonix/utils";
import { useActiveStudent } from "../../hooks/useActiveStudent";

export default function StudentParentAttendanceScreen() {
  const { role } = useAuth();
  const { activeStudent, parentStudents } = useActiveStudent();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const query = useQuery({
    queryKey: ["attendance", role],
    queryFn: role === "PARENT" ? getParentDashboard : getStudentDashboard,
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance", "records", studentId, fromDate, toDate],
    queryFn: () =>
      listStudentAttendance({
        studentId: studentId ?? undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    enabled: Boolean(studentId),
  });

  useEffect(() => {
    if (!studentId && activeStudent?.id) setStudentId(activeStudent.id);
  }, [activeStudent?.id, studentId]);

  const summary =
    role === "PARENT"
      ? query.data?.children?.find((child: any) => child.studentId === studentId)?.attendanceSummary ??
        query.data?.children?.[0]?.attendanceSummary
      : query.data?.attendanceSummary;

  const records = useMemo(() => recordsQuery.data?.data ?? recordsQuery.data ?? [], [recordsQuery.data]);

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
            <StatCard label="Attendance %" value={formatPercentage(summary.attendancePercentage)} color="jade" />
            <StatCard label="Present Days" value={String(summary.presentDays ?? 0)} color="sky" />
            <StatCard label="Absent Days" value={String(summary.absentDays ?? 0)} color="sunrise" />
          </View>

          <Card title="Attendance Records" subtitle="Filter by date range">
            {role === "PARENT" && parentStudents.length ? (
              <View style={styles.childRow}>
                {parentStudents.map((child) => (
                  <Text
                    key={child.id}
                    style={[styles.childChip, studentId === child.id && styles.childChipActive]}
                    onPress={() => setStudentId(child.id)}
                  >
                    {child.fullName ?? "Student"}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={styles.metaLabel}>From</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={fromDate}
                  onChangeText={setFromDate}
                />
              </View>
              <View style={styles.filterField}>
                <Text style={styles.metaLabel}>To</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={toDate}
                  onChangeText={setToDate}
                />
              </View>
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
    flexDirection: "row",
    gap: 12,
  },
  childRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  childChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  childChipActive: {
    backgroundColor: colors.sky[100],
    color: colors.sky[700],
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-end",
  },
  filterField: {
    flex: 1,
    gap: 4,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
  },
  list: {
    marginTop: 12,
    gap: 10,
  },
  listItem: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
});
