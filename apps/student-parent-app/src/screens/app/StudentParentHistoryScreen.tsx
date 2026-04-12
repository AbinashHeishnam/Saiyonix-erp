import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAcademicYearTransitionMeta, getActiveAcademicYear, getPreviousAcademicYear, getStudentHistory, sendMessage } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";

export default function StudentParentHistoryScreen() {
  const { role } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["student-history", activeStudentId],
    queryFn: () => getStudentHistory(activeStudentId as string),
    enabled: Boolean(activeStudentId),
  });

  const transitionQuery = useQuery({
    queryKey: ["academic-years", "transition-meta"],
    queryFn: getAcademicYearTransitionMeta,
  });

  const activeYearQuery = useQuery({
    queryKey: ["academic-years", "active"],
    queryFn: getActiveAcademicYear,
  });

  const previousYearQuery = useQuery({
    queryKey: ["academic-years", "previous"],
    queryFn: getPreviousAcademicYear,
  });

  const timeline = useMemo(() => historyQuery.data?.timeline ?? [], [historyQuery.data]);
  const transitionMeta = transitionQuery.data ?? null;
  const activeYearId = activeYearQuery.data?.id ?? transitionMeta?.toAcademicYear?.id ?? null;
  const previousYearId = previousYearQuery.data?.id ?? transitionMeta?.fromAcademicYear?.id ?? null;

  const handleSendMessage = async (teacherUserId?: string | null) => {
    if (!teacherUserId || !message.trim()) return;
    setMessageError(null);
    setSending(true);
    try {
      await sendMessage({ receiverId: teacherUserId, message: message.trim() });
      setMessage("");
    } catch (err: any) {
      setMessageError(err?.response?.data?.message ?? "Unable to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Academic History" subtitle="View past academic years and promotion outcomes." />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      {historyQuery.isLoading ? <LoadingState label="Loading history" /> : null}
      {historyQuery.error ? <ErrorState message="Unable to load history." /> : null}

      {!historyQuery.isLoading && timeline.length === 0 ? (
        <EmptyState title="No history yet" subtitle="No academic history records were found." />
      ) : (
        timeline.map((item: any) => {
          const year = item.academicYear;
          const isPreviousYear = Boolean(previousYearId && previousYearId === year?.id);
          const isActiveYear = Boolean(activeYearId && activeYearId === year?.id);
          const canInteract = Boolean(
            isPreviousYear && (transitionMeta?.canStudentInteract || transitionMeta?.canParentInteract)
          );
          const teacherUserId = item.classTeacher?.userId ?? null;

          return (
            <Card
              key={year?.id}
              title={year?.label ?? "Academic Year"}
              subtitle={isActiveYear ? "Current Academic Year" : isPreviousYear ? "Previous Academic Year" : "Archived Year"}
            >
              <View style={styles.grid}>
                <View>
                  <Text style={styles.meta}>Class & Section</Text>
                  <Text style={styles.title}>{item.enrollment?.class?.className ?? "—"} {item.enrollment?.section?.sectionName ?? ""}</Text>
                  <Text style={styles.meta}>Roll Number</Text>
                  <Text style={styles.title}>{item.enrollment?.rollNumber ?? "—"}</Text>
                  <Text style={styles.meta}>Class Teacher</Text>
                  <Text style={styles.title}>{item.classTeacher?.fullName ?? "Not assigned"}</Text>
                </View>
                <View>
                  <Text style={styles.meta}>Attendance</Text>
                  <Text style={styles.title}>{item.attendance?.attendancePercent ?? 0}%</Text>
                  <Text style={styles.meta}>Final Result</Text>
                  <Text style={styles.title}>{item.performance?.percentage ?? "—"}%</Text>
                  <Text style={styles.meta}>Promotion</Text>
                  <Text style={styles.title}>{item.systemTrace?.promotionType ?? "—"}</Text>
                </View>
              </View>

              {isPreviousYear ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.meta}>Previous year interaction window</Text>
                  <Text style={styles.titleSmall}>
                    {canInteract ? "Interaction Open" : "Interaction Closed"}
                  </Text>
                </View>
              ) : null}

              {canInteract && teacherUserId ? (
                <View style={styles.messageBox}>
                  <Text style={styles.meta}>Send a clarification to your previous class teacher</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Write your message"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                  />
                  {messageError ? <Text style={styles.errorText}>{messageError}</Text> : null}
                  <Button title={sending ? "Sending..." : "Send Message"} onPress={() => handleSendMessage(teacherUserId)} disabled={sending || !message.trim()} />
                </View>
              ) : null}
            </Card>
          );
        })
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  meta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    marginBottom: 6,
  },
  titleSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  noticeBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    borderWidth: 1,
    borderColor: colors.ink[100],
    gap: 4,
  },
  messageBox: {
    marginTop: 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    backgroundColor: colors.white,
    minHeight: 70,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
});
