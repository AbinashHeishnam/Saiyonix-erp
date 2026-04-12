import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  getAttendanceContext,
  getClassTeacherAttendanceContext,
  listStudentAttendance,
  markAttendance,
  updateAttendance,
} from "@saiyonix/api";
import { Button, Card, EmptyState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";
import { formatTime } from "@saiyonix/utils";

const STATUS_OPTIONS = ["PRESENT", "ABSENT"] as const;

export default function TeacherAttendanceScreen() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [nowTime, setNowTime] = useState<string>(() => new Date().toLocaleTimeString());

  const [editRecords, setEditRecords] = useState<any[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editSearch, setEditSearch] = useState("");

  const contextQuery = useQuery({
    queryKey: ["attendance", "context"],
    queryFn: getAttendanceContext,
  });
  const classContextQuery = useQuery({
    queryKey: ["attendance", "class-teacher"],
    queryFn: getClassTeacherAttendanceContext,
  });

  useEffect(() => {
    if (!academicYearId && contextQuery.data?.academicYearId) {
      setAcademicYearId(contextQuery.data.academicYearId);
    }
  }, [academicYearId, contextQuery.data?.academicYearId]);

  useEffect(() => {
    if (!sectionId && contextQuery.data?.sectionId) {
      setSectionId(contextQuery.data.sectionId);
    }
  }, [sectionId, contextQuery.data?.sectionId]);

  const selectedSection = useMemo(() => {
    return classContextQuery.data?.sections?.find((section: any) => section.id === sectionId) ?? null;
  }, [classContextQuery.data?.sections, sectionId]);

  const studentsForSection = useMemo(() => selectedSection?.students ?? [], [selectedSection]);

  useEffect(() => {
    if (studentsForSection.length) {
      setStatusMap((prev) => {
        const next: Record<string, string> = {};
        studentsForSection.forEach((student: any) => {
          next[student.id] = prev[student.id] ?? "PRESENT";
        });
        return next;
      });
    } else {
      setStatusMap({});
    }
  }, [studentsForSection]);

  const handleSubmit = async () => {
    setMessage(null);
    setError(null);
    if (!contextQuery.data || !sectionId || !academicYearId) {
      setError("Attendance context is not ready. Please try again.");
      return;
    }
    if (contextQuery.data.isOpen === false) {
      setError("Attendance is closed. Please wait for the next window.");
      return;
    }
    setLoadingSubmit(true);
    try {
      const records = studentsForSection.map((student: any) => ({
        studentId: student.id,
        status: statusMap[student.id] ?? "PRESENT",
      }));
      await markAttendance({ records });
      setMessage("Attendance marked successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to mark attendance");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!contextQuery.data?.nextOpenAt) {
      setCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const now = new Date();
      const nextOpen = new Date(contextQuery.data?.nextOpenAt as string);
      if (Number.isNaN(nextOpen.getTime())) {
        setCountdown(null);
        return;
      }
      const diff = nextOpen.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("Attendance is now open.");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [contextQuery.data?.nextOpenAt]);

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchEditRecords = async () => {
    if (!sectionId || !academicYearId) return;
    setLoadingEdit(true);
    try {
      const res = await listStudentAttendance({
        sectionId,
        academicYearId,
        fromDate: attendanceDate,
        toDate: attendanceDate,
        limit: 200,
      });
      setEditRecords(res?.data ?? res ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingEdit(false);
    }
  };

  useEffect(() => {
    if (contextQuery.data) {
      fetchEditRecords();
    }
  }, [sectionId, academicYearId, attendanceDate, contextQuery.data]);

  const handleUpdate = async (recordId: string, status: string) => {
    setMessage(null);
    setError(null);
    try {
      await updateAttendance(recordId, { status, correctionReason: "Updated by teacher" });
      setMessage("Attendance updated.");
      await fetchEditRecords();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update attendance");
    }
  };

  const isLoading = contextQuery.isLoading || classContextQuery.isLoading;
  const hasError = contextQuery.error || classContextQuery.error;
  const hasContext = Boolean(classContextQuery.data?.sections?.length && contextQuery.data);

  return (
    <PageShell loading={isLoading} loadingLabel="Loading attendance tools">
      {hasError ? (
        <Card>
          <Text style={styles.errorText}>{"Unable to load attendance context."}</Text>
        </Card>
      ) : !hasContext ? (
        <Card title="Attendance">
          <Text style={styles.meta}>No class assignment available for the active academic year.</Text>
        </Card>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <PageHeader title="Attendance" subtitle="Mark and edit daily attendance" />

          <Card title="Mark Attendance">
            <View style={styles.grid}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Class</Text>
                <Text style={styles.infoValue}>{contextQuery.data?.className ?? selectedSection?.className ?? "—"}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Section</Text>
                <Text style={styles.infoValue}>{contextQuery.data?.sectionName ?? selectedSection?.sectionName ?? "—"}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{contextQuery.data?.date ? contextQuery.data.date.slice(0, 10) : attendanceDate}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Current Time</Text>
                <Text style={styles.infoValue}>{nowTime}</Text>
              </View>
            </View>
            <View style={styles.infoBlockWide}>
              <Text style={styles.infoLabel}>Session</Text>
              <Text style={styles.infoValue}>First Period</Text>
            </View>
            {contextQuery.data?.nextOpenAt && countdown ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>Next attendance opens in {countdown}</Text>
              </View>
            ) : null}
            {contextQuery.data?.isOpen === false ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>
              Attendance is closed. It opens at {formatTime(contextQuery.data.startTime ?? "09:00")} and closes at {formatTime(contextQuery.data.endTime ?? "14:45")}.
            </Text>
          </View>
        ) : null}

        {studentsForSection.length && contextQuery.data?.isOpen !== false ? (
          <View style={styles.table}>
            {studentsForSection.map((student: any) => {
              const isPresent = statusMap[student.id] !== "ABSENT";
              return (
                <View key={student.id} style={styles.tableRow}>
                  <View style={styles.studentInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(student.fullName ?? "S").slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.studentName}>{student.fullName ?? student.id}</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Button
                      title="Present"
                      size="sm"
                      variant={isPresent ? "success" : "secondary"}
                      onPress={() => setStatusMap((prev) => ({ ...prev, [student.id]: "PRESENT" }))}
                    />
                    <Button
                      title="Absent"
                      size="sm"
                      variant={!isPresent ? "warning" : "secondary"}
                      onPress={() => setStatusMap((prev) => ({ ...prev, [student.id]: "ABSENT" }))}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <EmptyState
              title={contextQuery.data?.isOpen === false ? "Attendance Closed" : "Select a section"}
              subtitle={
                contextQuery.data?.isOpen === false
                  ? "Attendance window is closed for today."
                  : "Choose a section to load students."
              }
            />
          </View>
        )}

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {contextQuery.data?.alreadySubmitted ? (
          <Text style={styles.errorText}>Attendance already taken today for this section.</Text>
        ) : null}

        <Button
          title={loadingSubmit ? "Saving..." : "Submit Attendance"}
          onPress={handleSubmit}
          disabled={
            loadingSubmit ||
            !contextQuery.data ||
            contextQuery.data.alreadySubmitted ||
            contextQuery.data.isOpen === false
          }
        />
      </Card>

      <Card title="Edit Same-Day Attendance" subtitle="Update records marked today">
        {contextQuery.data?.isOpen === false ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              Editing is available only during school hours ({formatTime(contextQuery.data.startTime ?? "09:00")} - {formatTime(contextQuery.data.endTime ?? "14:45")}).
            </Text>
          </View>
        ) : null}
        <TextInput
          style={styles.search}
          placeholder="Search student name or ID..."
          value={editSearch}
          onChangeText={setEditSearch}
        />
        {loadingEdit ? (
          <LoadingState label="Loading records" />
        ) : editRecords.length ? (
          editSearch.trim() ? (
            <View style={styles.table}>
              {editRecords
                .filter((record) => {
                  const query = editSearch.trim().toLowerCase();
                  const name = (record.student?.fullName ?? "").toLowerCase();
                  const id = String(record.studentId ?? "").toLowerCase();
                  return name.includes(query) || id.includes(query);
                })
                .map((record) => (
                  <View key={record.id} style={styles.tableRow}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{record.student?.fullName ?? record.studentId}</Text>
                      <Text style={styles.meta}>{record.status}</Text>
                    </View>
                    <View style={styles.toggleRow}>
                      {STATUS_OPTIONS.map((status) => (
                        <Button
                          key={status}
                          title={status}
                          size="sm"
                          variant={record.status === status ? "success" : "secondary"}
                          onPress={() => handleUpdate(record.id, status)}
                          disabled={contextQuery.data?.isOpen === false}
                        />
                      ))}
                    </View>
                  </View>
                ))}
            </View>
          ) : (
            <EmptyState title="Search required" subtitle="Search a student to edit attendance." />
          )
        ) : (
          <EmptyState title="No records" subtitle="No attendance records found for the selected date." />
        )}
      </Card>
    </ScrollView>
      )}
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoBlock: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.ink[100],
    gap: 4,
  },
  infoBlockWide: {
    marginTop: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.ink[100],
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  noticeBox: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.ink[50],
    padding: 10,
  },
  noticeText: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  alertBox: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sunrise[200],
    backgroundColor: colors.sunrise[50],
    padding: 10,
  },
  alertText: {
    fontSize: 12,
    color: colors.sunrise[700],
    fontFamily: typography.fontBody,
  },
  table: {
    marginTop: 12,
    gap: 10,
  },
  tableRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    padding: 10,
    gap: 10,
  },
  studentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  studentName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  search: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
  },
  metaText: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  success: {
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
});
