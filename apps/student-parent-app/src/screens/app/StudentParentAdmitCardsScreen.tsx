import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAdmitCard, getAdmitCardPdf, listExams } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";
import { openFileUrl } from "../../utils/files";

export default function StudentParentAdmitCardsScreen() {
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const examsQuery = useQuery({
    queryKey: ["admit-cards", "exams"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  const admitQuery = useQuery({
    queryKey: ["admit-card", selectedExamId, activeStudentId],
    queryFn: async () => {
      try {
        const card = await getAdmitCard(selectedExamId, activeStudentId ?? undefined);
        let pdfUrl: string | null = null;
        try {
          const pdf = await getAdmitCardPdf(selectedExamId, activeStudentId ?? undefined);
          pdfUrl = pdf?.pdfUrl ?? null;
        } catch {
          pdfUrl = null;
        }
        return { card, pdfUrl, notAvailable: false };
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 404 || status === 403) {
          return { card: null, pdfUrl: null, notAvailable: true };
        }
        throw error;
      }
    },
    enabled: Boolean(selectedExamId),
  });

  const selectedExam = exams.find((exam: any) => exam.id === selectedExamId);

  useEffect(() => {
    if (!selectedExamId && exams.length) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Admit Cards" subtitle="Download your exam entry pass when published." />

      {parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      <Card title="Select Exam" subtitle="Admit cards unlock after fee payment and registration">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.error ? (
          <ErrorState message="Unable to load exams." />
        ) : exams.length === 0 ? (
          <EmptyState title="No exams" subtitle="Admit cards will appear once exams are created." />
        ) : (
          <View style={styles.list}>
            {exams.map((exam: any) => (
              <Pressable
                key={exam.id}
                onPress={() => setSelectedExamId(exam.id)}
                style={[styles.examCard, selectedExamId === exam.id && styles.examCardActive]}
              >
                <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                <Text style={styles.meta}>Term {exam.termNo ?? "—"}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {selectedExamId ? (
        <Card title="Admit Card" subtitle={selectedExam?.title ?? "Exam details"}>
          {admitQuery.isLoading ? (
            <LoadingState label="Loading admit card" />
          ) : admitQuery.error ? (
            <Text style={styles.meta}>Unable to load admit card.</Text>
          ) : admitQuery.data?.notAvailable ? (
            <EmptyState title="Admit card unavailable" subtitle="Admit card not available yet." />
          ) : admitQuery.data?.card ? (
            <View style={styles.detailBlock}>
              <View style={styles.statusRow}>
                <Text style={styles.meta}>Admit Number</Text>
                <Text style={styles.metaStrong}>{admitQuery.data.card.admitCardNumber ?? "—"}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.meta}>Status</Text>
                <StatusBadge variant={admitQuery.data.card.isLocked ? "warning" : "success"} label={admitQuery.data.card.isLocked ? "Locked" : "Ready"} dot={false} />
              </View>
              {admitQuery.data.card.isLocked ? (
                <Text style={styles.meta}>{admitQuery.data.card.lockReason ?? "Not eligible"}</Text>
              ) : admitQuery.data.pdfUrl ? (
                <>
                  <Button title="Download PDF" onPress={() => openFileUrl(admitQuery.data.pdfUrl)} />
                  <Text style={styles.meta}>Admit card is ready for download.</Text>
                </>
              ) : (
                <Text style={styles.meta}>PDF is generating. Refresh in a moment.</Text>
              )}
            </View>
          ) : (
            <EmptyState title="Admit card unavailable" subtitle="Admit cards will appear once published." />
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
    gap: 10,
  },
  examCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  examCardActive: {
    borderColor: colors.sky[200],
    backgroundColor: "rgba(239,246,255,0.6)",
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
  metaStrong: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  detailBlock: {
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
