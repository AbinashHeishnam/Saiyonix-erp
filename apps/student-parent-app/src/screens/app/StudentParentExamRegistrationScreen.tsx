import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getStudentFeeStatus, listExamRegistrations, listExams, registerForExam } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";

export default function StudentParentExamRegistrationScreen() {
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);

  const examsQuery = useQuery({
    queryKey: ["exams", "list"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const feeQuery = useQuery({
    queryKey: ["fee-status", activeStudentId],
    queryFn: () => getStudentFeeStatus(activeStudentId as string),
    enabled: Boolean(activeStudentId),
  });

  const registrationsQuery = useQuery({
    queryKey: ["exam-registrations", activeStudentId],
    queryFn: () => listExamRegistrations(activeStudentId ?? undefined),
    enabled: Boolean(activeStudentId),
  });

  useEffect(() => {
    if (registrationsQuery.data) {
      const ids = registrationsQuery.data.map((row: any) => row.examId);
      setRegisteredIds(ids);
    }
  }, [registrationsQuery.data]);

  const registerMutation = useMutation({
    mutationFn: async (examId: string) => registerForExam({ examId, studentId: activeStudentId ?? undefined }),
    onSuccess: (_data, examId) => {
      setRegisteredIds((prev) => (prev.includes(examId) ? prev : [...prev, examId]));
    },
  });

  const feeStatus = feeQuery.data?.status ?? "NOT_PUBLISHED";
  const isFeePaid = feeStatus === "PAID";
  const isNotPublished = feeStatus === "NOT_PUBLISHED";

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Exam Registration" subtitle="Register only after full fee payment is confirmed." />

      {parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Register for your child">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      <Card title="Eligibility" subtitle="Live status from fee and publish controls">
        {feeQuery.isLoading ? (
          <LoadingState label="Checking eligibility" />
        ) : feeQuery.error ? (
          <ErrorState message="Unable to load fee status." />
        ) : (
          <View style={styles.statusRow}>
            <Text style={styles.meta}>Fee Status</Text>
            <StatusBadge
              variant={isFeePaid ? "success" : isNotPublished ? "neutral" : "warning"}
              label={isFeePaid ? "PAID" : feeStatus}
              dot={false}
            />
          </View>
        )}
      </Card>

      <Card title="Available Exams" subtitle="Register to unlock admit cards">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.error ? (
          <ErrorState message="Unable to load exams." />
        ) : exams.length === 0 ? (
          <EmptyState title="No exams" subtitle="No exams available at the moment." />
        ) : (
          <View style={styles.list}>
            {exams.map((exam: any) => {
              const registered = registeredIds.includes(exam.id);
              return (
                <View key={exam.id} style={styles.examCard}>
                  <View style={styles.examHeader}>
                    <View>
                      <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                      <Text style={styles.meta}>Term {exam.termNo ?? "—"}</Text>
                    </View>
                    {registered ? <StatusBadge variant="success" label="Registered" dot={false} /> : null}
                  </View>
                  <View style={styles.actionsRow}>
                    <Button
                      title={registered ? "Registered" : isFeePaid ? "Register" : isNotPublished ? "Fee Not Available" : "Fee Pending"}
                      variant="secondary"
                      onPress={() => registerMutation.mutate(exam.id)}
                      disabled={!isFeePaid || registerMutation.isPending || registered}
                    />
                    {!isFeePaid && !isNotPublished ? (
                      <Text style={styles.warning}>Complete payment to register.</Text>
                    ) : null}
                    {isNotPublished ? <Text style={styles.warning}>Fee not available yet.</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
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
  list: {
    marginTop: 12,
    gap: 12,
  },
  examCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 8,
  },
  examHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionsRow: {
    gap: 6,
  },
  warning: {
    fontSize: 11,
    color: colors.rose[500],
    fontFamily: typography.fontBody,
  },
});
