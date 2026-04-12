import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getPromotionList, listAcademicYears, updateManualPromotions } from "@saiyonix/api";
import { Button, Card, EmptyState, LoadingState, PageHeader, Select, StatusBadge, colors, typography } from "@saiyonix/ui";

const PROMOTE_OPTIONS = [
  { value: "RANK", label: "Rank" },
  { value: "PERCENTAGE", label: "Percentage" },
];

type AcademicYear = {
  id: string;
  label: string;
  isActive?: boolean;
  isLocked?: boolean;
  startDate?: string;
};

function normalizeList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function TeacherPromotionScreen() {
  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => listAcademicYears({ page: 1, limit: 50 }),
  });

  const academicYears = useMemo(
    () => normalizeList<AcademicYear>(yearsQuery.data),
    [yearsQuery.data]
  );
  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) ?? academicYears[0],
    [academicYears]
  );

  const [fromAcademicYearId, setFromAcademicYearId] = useState("");
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [promoteBy, setPromoteBy] = useState<"RANK" | "PERCENTAGE">("PERCENTAGE");

  useEffect(() => {
    if (!fromAcademicYearId && activeYear?.id) {
      setFromAcademicYearId(activeYear.id);
    }
  }, [fromAcademicYearId, activeYear]);

  useEffect(() => {
    if (!academicYears.length) return;
    if (!fromAcademicYearId) return;
    if (!toAcademicYearId || toAcademicYearId === fromAcademicYearId) {
      const fromYear = academicYears.find((y) => y.id === fromAcademicYearId);
      const fromDate = fromYear?.startDate ? new Date(fromYear.startDate).getTime() : null;
      const candidates = academicYears
        .filter((y) => y.id !== fromAcademicYearId)
        .sort((a, b) => {
          const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
          return ad - bd;
        });
      const nextYear = fromDate
        ? candidates.find((y) => (y.startDate ? new Date(y.startDate).getTime() : 0) > fromDate)
        : candidates[0];
      setToAcademicYearId(nextYear?.id ?? "");
    }
  }, [academicYears, fromAcademicYearId, toAcademicYearId]);

  useEffect(() => {
    setOverrides({});
  }, [fromAcademicYearId, toAcademicYearId, promoteBy]);

  const listQuery = useQuery({
    queryKey: ["promotion", "list", fromAcademicYearId],
    queryFn: () => (fromAcademicYearId ? getPromotionList({ academicYearId: fromAcademicYearId }) : Promise.resolve([])),
    enabled: Boolean(fromAcademicYearId),
  });

  const records = useMemo(() => normalizeList<any>(listQuery.data), [listQuery.data]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const selectedFrom = academicYears.find((y) => y.id === fromAcademicYearId);
  const fromLocked = Boolean(selectedFrom?.isLocked);
  const sameYearSelected =
    !!fromAcademicYearId && !!toAcademicYearId && fromAcademicYearId === toAcademicYearId;

  useEffect(() => {
    const next: Record<string, boolean> = {};
    records.forEach((row: any) => {
      if (row.id) {
        next[row.id] = Boolean(row.isManuallyPromoted);
      }
    });
    setOverrides(next);
  }, [records]);

  const hasChanges = useMemo(() => {
    return records.some((row: any) => row.id && overrides[row.id] !== Boolean(row.isManuallyPromoted));
  }, [records, overrides]);

  const handleToggle = (record: any) => {
    if (!record.id) return;
    if (record.status !== "FAILED") return;
    setOverrides((prev) => ({ ...prev, [record.id]: !prev[record.id] }));
  };

  const handleSave = async () => {
    if (!fromAcademicYearId || !toAcademicYearId || fromLocked || records.length === 0) return;
    const updates = records
      .filter((row: any) => row.id)
      .filter((row: any) => overrides[row.id] !== Boolean(row.isManuallyPromoted))
      .map((row: any) => ({
        promotionRecordId: row.id,
        studentId: row.studentId,
        isManuallyPromoted: Boolean(overrides[row.id]),
      }));
    if (updates.length === 0) return;

    setSaving(true);
    try {
      await updateManualPromotions(updates);
      listQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Promotion Management"
        subtitle="Review student eligibility and handle under-consideration promotions."
      />

      <Card title="Promotion Filters" subtitle="Select academic years and promotion type.">
        {yearsQuery.isLoading ? (
          <LoadingState label="Loading academic years..." />
        ) : academicYears.length === 0 ? (
          <EmptyState title="No academic years" subtitle="Create academic years to start promotions." />
        ) : (
          <View style={styles.filterGrid}>
            <Select
              label="From Academic Year"
              value={fromAcademicYearId}
              onChange={setFromAcademicYearId}
              options={academicYears.map((year) => ({ value: year.id, label: year.label }))}
              placeholder="Select year"
            />
            <Select
              label="To Academic Year"
              value={toAcademicYearId}
              onChange={setToAcademicYearId}
              options={academicYears
                .filter((year) => year.id !== fromAcademicYearId)
                .map((year) => ({ value: year.id, label: year.label }))}
              placeholder="Select year"
            />
            <Select
              label="Promotion Type"
              value={promoteBy}
              onChange={(value) => setPromoteBy(value as "RANK" | "PERCENTAGE")}
              options={PROMOTE_OPTIONS}
            />
            {sameYearSelected ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>Source and target academic year cannot be the same.</Text>
              </View>
            ) : null}
            {fromLocked ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>Promotions already published for this academic year.</Text>
              </View>
            ) : null}
            <View style={styles.refreshRow}>
              <Button
                title="Refresh Preview"
                variant="secondary"
                onPress={() => listQuery.refetch()}
                disabled={
                  listQuery.isLoading ||
                  !fromAcademicYearId ||
                  !toAcademicYearId ||
                  sameYearSelected ||
                  fromLocked
                }
              />
            </View>
          </View>
        )}
      </Card>

      <Card title="Promotion List" subtitle="Only failed students can be marked under consideration.">
        {listQuery.isLoading ? (
          <LoadingState label="Loading promotion list..." />
        ) : listQuery.error ? (
          <Text style={styles.errorText}>Unable to load promotion list.</Text>
        ) : records.length === 0 ? (
          <EmptyState title="No students match promotion criteria" subtitle="Adjust criteria or academic years to see eligible students." />
        ) : (
          <View style={styles.list}>
            {records.map((row: any) => {
              const isOverridden = Boolean(overrides[row.id]);
              const status = isOverridden ? "UNDER_CONSIDERATION" : row.status;
              const failedSubjects =
                row.failedSubjects ??
                (row.totalSubjects != null && row.passedSubjects != null
                  ? Math.max(0, row.totalSubjects - row.passedSubjects)
                  : null);
              return (
                <View key={row.id} style={[styles.rowCard, isOverridden && styles.rowOverride]}>
                  <View style={styles.rowHeader}>
                    <View>
                      <Text style={styles.studentName}>{row.student?.fullName ?? row.studentName ?? "—"}</Text>
                      <Text style={styles.studentMeta}>{row.studentId ?? ""}</Text>
                    </View>
                    <StatusBadge variant={status === "FAILED" ? "danger" : status === "UNDER_CONSIDERATION" ? "warning" : "neutral"} label={status ?? "—"} dot={false} />
                  </View>
                  <View style={styles.rowGrid}>
                    <Text style={styles.rowItem}>Attendance %: {row.attendancePercent ?? "—"}</Text>
                    <Text style={styles.rowItem}>Failed Subjects: {failedSubjects ?? "—"}</Text>
                    <Text style={styles.rowItem}>Percentage: {row.percentage ?? "—"}</Text>
                    <Text style={styles.rowItem}>Rank: {row.rank ?? "—"}</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Promote Under Consideration</Text>
                    <Switch
                      value={isOverridden}
                      onValueChange={() => handleToggle(row)}
                      disabled={row.status !== "FAILED" || saving || listQuery.isLoading || fromLocked}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.saveRow}>
          <Button
            title={saving ? "Saving..." : "Save Changes"}
            onPress={handleSave}
            disabled={
              saving ||
              listQuery.isLoading ||
              records.length === 0 ||
              !fromAcademicYearId ||
              !toAcademicYearId ||
              sameYearSelected ||
              fromLocked ||
              !hasChanges
            }
          />
        </View>
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
  filterGrid: {
    gap: 12,
  },
  alertBox: {
    borderWidth: 1,
    borderColor: colors.rose[200],
    backgroundColor: colors.rose[50],
    borderRadius: 12,
    padding: 10,
  },
  alertText: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
  refreshRow: {
    alignItems: "flex-end",
  },
  errorText: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
  },
  list: {
    gap: 12,
    marginTop: 8,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    gap: 10,
  },
  rowOverride: {
    backgroundColor: colors.sunrise[50],
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  studentMeta: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  rowGrid: {
    gap: 4,
  },
  rowItem: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  saveRow: {
    marginTop: 12,
    alignItems: "flex-end",
  },
});
