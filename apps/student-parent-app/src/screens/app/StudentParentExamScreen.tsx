import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listExams } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";

export default function StudentParentExamScreen() {
  const query = useQuery({
    queryKey: ["exams"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const items = query.data?.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Exam Routine" subtitle="Published schedules and rooms" />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load exams." /> : null}

      <Card title="Exam Routine" subtitle="Published schedules">
        {Array.isArray(items) && items.length ? (
          <View style={styles.list}>
            {items.map((exam: any) => (
              <View key={exam.id} style={styles.listItem}>
                <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                <Text style={styles.meta}>Term: {exam.termNo ?? "—"}</Text>
                <Text style={styles.meta}>Published: {exam.timetablePublishedAt ? formatDate(exam.timetablePublishedAt) : "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No exams" subtitle="Exam schedules will appear here." />
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
  listItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
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
});
