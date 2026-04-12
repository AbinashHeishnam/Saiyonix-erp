import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentPromotionView, getStudentPromotionStatus } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";

function normalizePayload(payload: any) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  return payload;
}

function resolveStatusLabel(status?: string | null) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "PROMOTED":
      return "Promoted";
    case "ELIGIBLE":
      return "Eligible";
    case "NOT_PROMOTED":
    case "FAILED":
      return "Not Promoted";
    case "UNDER_CONSIDERATION":
      return "Under Consideration";
    default:
      return "—";
  }
}

export default function StudentParentPromotionScreen() {
  const { role } = useAuth();
  const query = useQuery({
    queryKey: ["promotion", role],
    queryFn: role === "PARENT" ? getParentPromotionView : getStudentPromotionStatus,
  });

  const info = useMemo(() => normalizePayload(query.data), [query.data]);
  const effectiveStatus = info?.isFinalClass ? "COMPLETED" : info?.status ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Promotion" subtitle={role === "PARENT" ? "Track your child’s promotion outcome." : "Track your promotion outcome."} />

      {query.isLoading ? <LoadingState label="Loading promotion" /> : null}
      {query.error ? <ErrorState message="Unable to load promotion status." /> : null}

      {!query.isLoading && !info ? (
        <EmptyState title="No promotion data" subtitle="Promotion data will appear once published." />
      ) : info ? (
        <Card title="Promotion Status" subtitle="Latest promotion summary">
          <View style={styles.row}>
            <View>
              <Text style={styles.meta}>Student</Text>
              <Text style={styles.title}>{info.student?.fullName ?? info.studentName ?? "—"}</Text>
            </View>
            <StatusBadge variant={effectiveStatus === "PROMOTED" || effectiveStatus === "COMPLETED" ? "success" : effectiveStatus === "NOT_PROMOTED" || effectiveStatus === "FAILED" ? "danger" : "warning"} label={resolveStatusLabel(effectiveStatus)} dot={false} />
          </View>
          <View style={styles.grid}>
            <View style={styles.infoCard}>
              <Text style={styles.meta}>Current Class</Text>
              <Text style={styles.titleSmall}>{info.currentClass?.className ?? info.currentClassName ?? "—"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.meta}>Current Section</Text>
              <Text style={styles.titleSmall}>{info.currentSection?.sectionName ?? info.currentSectionName ?? "—"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.meta}>Next Class</Text>
              <Text style={styles.titleSmall}>{info.promotedClass?.className ?? "—"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.meta}>Next Section</Text>
              <Text style={styles.titleSmall}>{info.promotedSection?.sectionName ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.metrics}>
            <Text style={styles.meta}>Attendance: {info.attendancePercent ?? 0}%</Text>
            <Text style={styles.meta}>Rank: {info.rank ?? "—"}</Text>
            <Text style={styles.meta}>Failed Subjects: {info.failedSubjects ?? 0}</Text>
          </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    borderWidth: 1,
    borderColor: colors.ink[100],
  },
  metrics: {
    marginTop: 12,
    gap: 4,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  titleSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
});
