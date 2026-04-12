import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAcademicYearTransitionMeta, getActiveAcademicYear, getTeacherMyClassAnalytics, listExams } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";

export default function TeacherRankScreen() {
  const activeYearQuery = useQuery({
    queryKey: ["academic-year", "active"],
    queryFn: getActiveAcademicYear,
  });
  const transitionQuery = useQuery({
    queryKey: ["academic-year", "transition"],
    queryFn: getAcademicYearTransitionMeta,
  });

  const activeYearId =
    activeYearQuery.data?.id ?? transitionQuery.data?.toAcademicYear?.id ?? "";

  const examsQuery = useQuery({
    queryKey: ["exams", "teacher-rank", activeYearId],
    queryFn: () =>
      listExams({ page: 1, limit: 50, academicYearId: activeYearId || undefined }),
    enabled: Boolean(activeYearId),
  });

  const exams = (examsQuery.data?.data ?? examsQuery.data ?? []) as any[];

  const [selectedExamId, setSelectedExamId] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExamId("");
    setAnalytics(null);
  }, [activeYearId]);

  useEffect(() => {
    const load = async () => {
      if (!selectedExamId) return;
      setAnalyticsError(null);
      setLoadingAnalytics(true);
      try {
        const data = await getTeacherMyClassAnalytics({ examId: selectedExamId });
        setAnalytics(data);
      } catch (err: any) {
        setAnalyticsError(err?.response?.data?.message ?? "Failed to load rank list");
      } finally {
        setLoadingAnalytics(false);
      }
    };
    void load();
  }, [selectedExamId]);

  const rankedStudents = useMemo(() => {
    if (!analytics?.students?.length) return [];
    return [...analytics.students].sort((a: any, b: any) => (a.sectionRank || 999) - (b.sectionRank || 999));
  }, [analytics]);

  const topTen = rankedStudents.slice(0, 10);

  const isLoading = activeYearQuery.isLoading || examsQuery.isLoading;

  return (
    <PageShell loading={isLoading} loadingLabel="Loading rank workspace">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Student Rank" subtitle="Section-wide ranking overview" />

      {activeYearQuery.error || examsQuery.error ? <ErrorState message="Unable to load rank context." /> : null}

      <Card title="Select Exam">
        <Select
          label="Exam Snapshot"
          value={selectedExamId}
          onChange={setSelectedExamId}
          options={exams.map((exam) => ({ value: exam.id, label: exam.title }))}
          placeholder="Choose an exam"
        />
      </Card>

      {analyticsError ? <ErrorState message={analyticsError} /> : null}
      {loadingAnalytics ? <LoadingState label="Loading ranks" /> : null}

      {!loadingAnalytics && analytics ? (
        <View style={styles.section}>
          <Card title="Top 10 Students">
            {topTen.length ? (
              <View style={styles.list}>
                {topTen.map((student: any) => (
                  <View key={student.studentId ?? student.id} style={styles.listRow}>
                    <Text style={styles.listTitle}>
                      #{student.sectionRank ?? "—"} • {student.fullName ?? "Student"}
                    </Text>
                    <Text style={styles.listMeta}>
                      Overall {student.overallPercentage ?? 0}% • Attendance {student.attendancePercentage ?? 0}%
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No rankings yet" subtitle="Generate ranks by selecting an exam." />
            )}
          </Card>

          <Card title="Full Ranking">
            {rankedStudents.length ? (
              <View style={styles.list}>
                {rankedStudents.map((student: any) => (
                  <View key={student.studentId ?? student.id} style={styles.listRow}>
                    <Text style={styles.listTitle}>
                      #{student.sectionRank ?? "—"} • {student.fullName ?? "Student"}
                    </Text>
                    <Text style={styles.listMeta}>
                      Overall {student.overallPercentage ?? 0}% • Attendance {student.attendancePercentage ?? 0}%
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No rankings yet" subtitle="Generate ranks by selecting an exam." />
            )}
          </Card>
        </View>
      ) : null}
    </ScrollView>
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
  section: {
    gap: 16,
  },
  list: {
    gap: 10,
  },
  listRow: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  listMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
