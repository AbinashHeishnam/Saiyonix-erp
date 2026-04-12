import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getResults, listExams } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";

export default function StudentParentResultsScreen() {
  const { activeStudent } = useActiveStudent();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["results", "exams"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "detail", selectedExamId, activeStudent?.id],
    queryFn: () => getResults(selectedExamId as string, activeStudent?.id),
    enabled: Boolean(selectedExamId),
  });

  const exams = (examsQuery.data?.data ?? examsQuery.data ?? []) as any[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Results" subtitle="Exam results and report cards" />

      {examsQuery.isLoading ? <LoadingState /> : null}
      {examsQuery.error ? <ErrorState message="Unable to load results." /> : null}

      <Card title="Exams">
        {exams.length ? (
          <View style={styles.list}>
            {exams.map((exam: any) => (
              <View key={exam.id} style={styles.listItem}>
                <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                <Text style={styles.meta}>Term {exam.termNo ?? "—"}</Text>
                <Button title="View" size="sm" variant="secondary" onPress={() => setSelectedExamId(exam.id)} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No exams" subtitle="No exams available yet." />
        )}
      </Card>

      {selectedExamId ? (
        <Card title="Result Summary">
          {resultsQuery.isLoading ? (
            <LoadingState label="Loading result" />
          ) : resultsQuery.error ? (
            <Text style={styles.meta}>Results not available.</Text>
          ) : resultsQuery.data ? (
            <View style={styles.resultBlock}>
              <Text style={styles.meta}>Total Marks: {resultsQuery.data.totalMarks}</Text>
              <Text style={styles.meta}>Percentage: {resultsQuery.data.percentage}%</Text>
              <Text style={styles.meta}>Grade: {resultsQuery.data.grade ?? "—"}</Text>
              <View style={styles.subjects}>
                {resultsQuery.data.subjects?.map((subject: any) => (
                  <View key={subject.examSubjectId} style={styles.subjectItem}>
                    <Text style={styles.title}>{subject.subjectName ?? "Subject"}</Text>
                    <Text style={styles.meta}>Marks: {subject.marksObtained}/{subject.maxMarks}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
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
    gap: 6,
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
  resultBlock: {
    gap: 8,
  },
  subjects: {
    marginTop: 8,
    gap: 8,
  },
  subjectItem: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
});
