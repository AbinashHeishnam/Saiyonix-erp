import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  getAcademicYearTransitionMeta,
  getActiveAcademicYear,
  getPreviousAcademicYear,
  getTeacherContacts,
  getTeacherHistory,
  sendMessage,
} from "@saiyonix/api";
import { Button, Card, EmptyState, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";

export default function TeacherHistoryScreen() {
  const navigation = useNavigation();
  const historyQuery = useQuery({
    queryKey: ["teacher", "history"],
    queryFn: getTeacherHistory,
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
  const contactsQuery = useQuery({
    queryKey: ["messages", "contacts"],
    queryFn: getTeacherContacts,
  });

  const timeline = useMemo(() => historyQuery.data?.timeline ?? [], [historyQuery.data]);
  const transitionMeta = transitionQuery.data ?? null;
  const activeYearId = activeYearQuery.data?.id ?? transitionMeta?.toAcademicYear?.id ?? null;
  const previousYearId = previousYearQuery.data?.id ?? transitionMeta?.fromAcademicYear?.id ?? null;

  const [messageByYear, setMessageByYear] = useState<Record<string, string>>({});
  const [selectedContactByYear, setSelectedContactByYear] = useState<Record<string, string>>({});
  const [sendingYear, setSendingYear] = useState<string | null>(null);
  const [errorByYear, setErrorByYear] = useState<Record<string, string | null>>({});

  const contacts = contactsQuery.data ?? [];

  const handleSendMessage = async (yearId: string) => {
    const receiverId = selectedContactByYear[yearId];
    const message = messageByYear[yearId]?.trim() ?? "";
    if (!receiverId || !message) return;
    setSendingYear(yearId);
    setErrorByYear((prev) => ({ ...prev, [yearId]: null }));
    try {
      await sendMessage({ receiverId, message });
      setMessageByYear((prev) => ({ ...prev, [yearId]: "" }));
    } catch (err: any) {
      setErrorByYear((prev) => ({
        ...prev,
        [yearId]: err?.response?.data?.message ?? "Unable to send message",
      }));
    } finally {
      setSendingYear((prev) => (prev === yearId ? null : prev));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Teaching History" subtitle="Review your academic year assignments." />
      <View style={styles.actionsRow}>
        <Button title="Operational History" variant="secondary" onPress={() => navigation.navigate("TeacherOperationalHistory" as never)} />
      </View>

      {historyQuery.isLoading ? (
        <LoadingState label="Loading history" />
      ) : historyQuery.error ? (
        <EmptyState title="Unable to load history" subtitle="Please try again." />
      ) : timeline.length === 0 ? (
        <EmptyState title="No history" subtitle="No teaching history records found." />
      ) : (
        <View style={styles.timeline}>
          {timeline.map((item: any) => {
            const isPreviousYear = item.academicYear.id === previousYearId;
            const subtitle =
              item.academicYear.id === activeYearId
                ? "Current Academic Year"
                : isPreviousYear
                  ? "Previous Academic Year"
                  : "Archived Year";
            return (
              <Card key={item.academicYear.id} title={item.academicYear.label} subtitle={subtitle}>
                <Text style={styles.sectionLabel}>Assignments</Text>
                <View style={styles.assignmentList}>
                  {item.subjects.map((subject: any, idx: number) => (
                    <View key={`${subject.classId}-${subject.sectionId ?? "all"}-${idx}`} style={styles.assignmentRow}>
                      <Text style={styles.assignmentText}>{subject.className} {subject.sectionName ?? ""}</Text>
                      <Text style={styles.assignmentMeta}>{subject.subjectName}</Text>
                    </View>
                  ))}
                </View>

                {item.classTeacherAssignments?.length ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Class Teacher Assignments</Text>
                    {item.classTeacherAssignments.map((assignment: any, idx: number) => (
                      <Text key={`${assignment.classId}-${assignment.sectionId ?? "section"}-${idx}`} style={styles.assignmentText}>
                        {assignment.className} {assignment.sectionName ?? ""}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {isPreviousYear ? (
                  <View style={styles.sectionBlock}>
                    <View style={styles.transitionBox}>
                      <Text style={styles.sectionTitle}>Previous Year Transition</Text>
                      <Text style={styles.transitionText}>
                        {transitionMeta?.teacherWindowEndsAt
                          ? `Window ends at ${new Date(transitionMeta.teacherWindowEndsAt).toLocaleString()}`
                          : "Transition window details unavailable."}
                      </Text>
                      {!transitionMeta?.canTeacherInteract ? (
                        <Text style={styles.transitionClosed}>Interaction Closed — View Only</Text>
                      ) : null}
                    </View>
                    {transitionMeta?.canTeacherInteract ? (
                      <View style={styles.messageBlock}>
                        <Select
                          label="Message Student/Parent"
                          value={selectedContactByYear[item.academicYear.id] ?? ""}
                          onChange={(value) =>
                            setSelectedContactByYear((prev) => ({ ...prev, [item.academicYear.id]: value }))
                          }
                          options={contacts.map((contact: any) => ({
                            value: contact.userId,
                            label: `${contact.name} (${contact.roleType})`,
                          }))}
                          placeholder="Select a contact"
                        />
                        <TextInput
                          style={styles.textarea}
                          multiline
                          value={messageByYear[item.academicYear.id] ?? ""}
                          onChangeText={(text) => setMessageByYear((prev) => ({ ...prev, [item.academicYear.id]: text }))}
                          placeholder="Send a follow-up to your previous class"
                        />
                        {errorByYear[item.academicYear.id] ? (
                          <Text style={styles.errorText}>{errorByYear[item.academicYear.id]}</Text>
                        ) : null}
                        <Button
                          title={sendingYear === item.academicYear.id ? "Sending..." : "Send Message"}
                          onPress={() => handleSendMessage(item.academicYear.id)}
                          disabled={
                            sendingYear === item.academicYear.id ||
                            !selectedContactByYear[item.academicYear.id] ||
                            !(messageByYear[item.academicYear.id] ?? "").trim()
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
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
  actionsRow: {
    alignItems: "flex-end",
  },
  timeline: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    marginBottom: 6,
  },
  assignmentList: {
    gap: 6,
  },
  assignmentRow: {
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
  sectionBlock: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  transitionBox: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.ink[50],
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  transitionText: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  transitionClosed: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  messageBlock: {
    gap: 10,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
    minHeight: 70,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 11,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
});
