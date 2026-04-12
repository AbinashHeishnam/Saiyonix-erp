import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAcademicYearTransitionMeta, getActiveAcademicYear, getTeacherMyClassAnalytics, listExams } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";

export default function TeacherAnalyticsScreen() {
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
    queryKey: ["exams", "teacher-analytics", activeYearId],
    queryFn: () =>
      listExams({ page: 1, limit: 50, academicYearId: activeYearId || undefined }),
    enabled: Boolean(activeYearId),
  });

  const exams = (examsQuery.data?.data ?? examsQuery.data ?? []) as any[];

  const [selectedExamId, setSelectedExamId] = useState("");
  const [marksThreshold, setMarksThreshold] = useState("40");
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExamId("");
    setAnalytics(null);
  }, [activeYearId]);

  const handleLoad = async () => {
    if (!selectedExamId) return;
    setAnalyticsError(null);
    setLoadingAnalytics(true);
    try {
      const data = await getTeacherMyClassAnalytics({
        examId: selectedExamId,
        marksThreshold: Number(marksThreshold),
        attendanceThreshold: Number(attendanceThreshold),
      });
      setAnalytics(data);
    } catch (err: any) {
      setAnalyticsError(err?.response?.data?.message ?? "Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) void handleLoad();
  }, [selectedExamId]);

  const stats = useMemo(() => {
    if (!analytics?.students?.length) return null;
    const students = analytics.students;
    const totalStudents = students.length;
    const sumOverall = students.reduce((acc: number, curr: any) => acc + (curr.overallPercentage || 0), 0);
    const avgOverall = (sumOverall / totalStudents).toFixed(1);
    const weakMarksCount = students.filter((s: any) => s.weakMarks).length;
    const weakAttendanceCount = students.filter((s: any) => s.weakAttendance).length;
    const highestScorer = students.reduce(
      (prev: any, current: any) => (prev.overallPercentage > current.overallPercentage ? prev : current)
    );

    const subjectToppers: { subjectName: string; topperName: string; score: number }[] = [];
    if (analytics.subjects) {
      analytics.subjects.forEach((subject: any) => {
        let bestStudent = "";
        let bestScore = -1;
        students.forEach((student: any) => {
          const markItem = student.subjectMarks?.find((m: any) => m.examSubjectId === subject.examSubjectId);
          if (markItem && markItem.marksObtained > bestScore) {
            bestScore = markItem.marksObtained;
            bestStudent = student.fullName;
          }
        });
        if (bestScore >= 0) {
          subjectToppers.push({ subjectName: subject.subjectName, topperName: bestStudent, score: bestScore });
        }
      });
    }

    return {
      totalStudents,
      avgOverall,
      weakMarksCount,
      weakAttendanceCount,
      highestScorerName: highestScorer?.fullName || "—",
      highestScore: highestScorer?.overallPercentage || 0,
      subjectToppers,
    };
  }, [analytics]);

  const rankedStudents = useMemo(() => {
    if (!analytics?.students?.length) return [];
    return [...analytics.students].sort((a: any, b: any) => (a.sectionRank || 999) - (b.sectionRank || 999));
  }, [analytics]);

  const isLoading = activeYearQuery.isLoading || examsQuery.isLoading;

  return (
    <PageShell loading={isLoading} loadingLabel="Loading analytics workspace">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Student Analytics" subtitle="Comprehensive performance and attendance insights" />

      {activeYearQuery.error || examsQuery.error ? (
        <ErrorState message="Unable to load analytics context." />
      ) : null}

      <Card title="Filters">
        <View style={styles.filters}>
          <Select
            label="Select Exam Snapshot"
            value={selectedExamId}
            onChange={setSelectedExamId}
            options={exams.map((exam) => ({ value: exam.id, label: exam.title }))}
            placeholder="Choose an exam"
          />
          <View style={styles.thresholds}>
            <Input
              label="Failing Mark %"
              value={marksThreshold}
              onChangeText={setMarksThreshold}
              keyboardType="numeric"
            />
            <Input
              label="Attendance %"
              value={attendanceThreshold}
              onChangeText={setAttendanceThreshold}
              keyboardType="numeric"
            />
          </View>
          <Button title={loadingAnalytics ? "Loading..." : "Generate Report"} onPress={handleLoad} loading={loadingAnalytics} />
        </View>
      </Card>

      {analyticsError ? <ErrorState message={analyticsError} /> : null}

      {loadingAnalytics ? <LoadingState label="Loading analytics" /> : null}

      {!loadingAnalytics && analytics && stats ? (
        <View style={styles.section}>
          <Card title="Summary">
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalStudents}</Text>
                <Text style={styles.statLabel}>Total Students</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.avgOverall}%</Text>
                <Text style={styles.statLabel}>Average Score</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.weakMarksCount}</Text>
                <Text style={styles.statLabel}>Weak Marks</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.weakAttendanceCount}</Text>
                <Text style={styles.statLabel}>Weak Attendance</Text>
              </View>
            </View>
            <View style={styles.topperRow}>
              <Text style={styles.topperTitle}>Highest Scorer</Text>
              <Text style={styles.topperValue}>
                {stats.highestScorerName} • {stats.highestScore}%
              </Text>
            </View>
          </Card>

          <Card title="Subject Toppers">
            {stats.subjectToppers.length ? (
              <View style={styles.list}>
                {stats.subjectToppers.map((item) => (
                  <View key={item.subjectName} style={styles.listRow}>
                    <Text style={styles.listTitle}>{item.subjectName}</Text>
                    <Text style={styles.listMeta}>
                      {item.topperName} • {item.score}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No toppers yet" subtitle="Subject toppers will appear here." />
            )}
          </Card>

          <Card title="Student Performance">
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
              <EmptyState title="No analytics yet" subtitle="Generate a report to view performance." />
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
  filters: {
    gap: 12,
  },
  thresholds: {
    flexDirection: "row",
    gap: 12,
  },
  section: {
    gap: 16,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexBasis: "48%",
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  statLabel: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  topperRow: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 4,
  },
  topperTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  topperValue: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
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
