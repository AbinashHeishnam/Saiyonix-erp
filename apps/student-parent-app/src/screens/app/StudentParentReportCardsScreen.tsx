import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getReportCard, getReportCardPdf, listExams } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";
import { openFileUrl } from "../../utils/files";

export default function StudentParentReportCardsScreen() {
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["report-cards", "exams"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const reportQuery = useQuery({
    queryKey: ["report-cards", selectedExamId, activeStudentId],
    queryFn: () => getReportCard(selectedExamId as string, activeStudentId ?? undefined),
    enabled: Boolean(selectedExamId),
  });

  useEffect(() => {
    if (!selectedExamId) return;
    (async () => {
      try {
        const pdf = await getReportCardPdf(selectedExamId, activeStudentId ?? undefined, true);
        setPdfUrl(pdf?.pdfUrl ?? null);
      } catch {
        setPdfUrl(null);
      }
    })();
  }, [selectedExamId, activeStudentId]);

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Report Cards" subtitle="Access published report cards" />

      {parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      <Card title="Exams">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.error ? (
          <ErrorState message="Unable to load exams." />
        ) : exams.length ? (
          <View style={styles.list}>
            {exams.map((exam: any) => (
              <View key={exam.id} style={styles.listItem}>
                <View>
                  <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                  <Text style={styles.meta}>Term {exam.termNo ?? "—"}</Text>
                </View>
                <Button title="View" size="sm" variant="secondary" onPress={() => setSelectedExamId(exam.id)} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No exams" subtitle="No exams available yet." />
        )}
      </Card>

      {selectedExamId ? (
        <Card title="Report Card Details">
          {reportQuery.isLoading ? (
            <LoadingState label="Loading report card" />
          ) : reportQuery.error ? (
            <Text style={styles.meta}>Report card unavailable.</Text>
          ) : reportQuery.data ? (
            <View style={styles.detailBlock}>
              <Text style={styles.meta}>Total Marks: {reportQuery.data.totalMarks}</Text>
              <Text style={styles.meta}>Percentage: {reportQuery.data.percentage}%</Text>
              <Text style={styles.meta}>Grade: {reportQuery.data.grade ?? "—"}</Text>
              {pdfUrl ? (
                <Button title="Download PDF" onPress={() => openFileUrl(pdfUrl)} />
              ) : (
                <Text style={styles.meta}>PDF is being generated. Please refresh later.</Text>
              )}
            </View>
          ) : (
            <EmptyState title="Report card unavailable" subtitle="Report card is not published yet." />
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
    gap: 12,
  },
  listItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
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
  detailBlock: {
    gap: 8,
  },
});
