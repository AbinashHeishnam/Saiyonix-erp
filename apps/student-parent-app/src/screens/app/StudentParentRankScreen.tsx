import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getRanking, listExams } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";

export default function StudentParentRankScreen() {
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const examsQuery = useQuery({
    queryKey: ["ranking", "exams"],
    queryFn: () => listExams({ page: 1, limit: 50 }),
  });

  const exams = useMemo(() => {
    const payload = examsQuery.data?.data ?? examsQuery.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [examsQuery.data]);

  const rankingQuery = useQuery({
    queryKey: ["ranking", selectedExamId],
    queryFn: () => getRanking(selectedExamId, 1, 20),
    enabled: Boolean(selectedExamId),
  });

  const rankings = useMemo(() => {
    const payload = rankingQuery.data ?? [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [] as any[];
  }, [rankingQuery.data]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Rank" subtitle="View your ranking by exam." />

      <Card title="Exams">
        {examsQuery.isLoading ? (
          <LoadingState label="Loading exams" />
        ) : examsQuery.error ? (
          <ErrorState message="Unable to load exams." />
        ) : exams.length ? (
          <View style={styles.list}>
            {exams.map((exam: any) => (
              <View key={exam.id} style={[styles.listItem, selectedExamId === exam.id && styles.listItemActive]}>
                <View>
                  <Text style={styles.title}>{exam.title ?? "Exam"}</Text>
                  <Text style={styles.meta}>Term {exam.termNo ?? "—"}</Text>
                </View>
                <Text style={styles.action} onPress={() => setSelectedExamId(exam.id)}>
                  View
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No exams" subtitle="No exams available yet." />
        )}
      </Card>

      {selectedExamId ? (
        <Card title="Ranking">
          {rankingQuery.isLoading ? (
            <LoadingState label="Loading ranking" />
          ) : rankingQuery.error ? (
            <Text style={styles.meta}>Ranking not available.</Text>
          ) : rankings.length ? (
            <View style={styles.rankList}>
              {rankings.map((entry: any, idx: number) => (
                <View key={`${entry.id ?? idx}`} style={styles.rankRow}>
                  <Text style={styles.rankIndex}>#{entry.rank ?? idx + 1}</Text>
                  <Text style={styles.rankMeta}>Marks: {entry.totalMarks ?? "—"}</Text>
                  <Text style={styles.rankMeta}>% {entry.percentage ?? "—"}</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="No ranking data" subtitle="Ranking will appear once published." />
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
  listItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listItemActive: {
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
  action: {
    fontSize: 12,
    color: colors.sky[600],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  rankList: {
    marginTop: 8,
    gap: 10,
  },
  rankRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rankIndex: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  rankMeta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
