import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { getStudentFeeStatus, listReceipts, listExamRegistrations } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";

export default function StudentParentFeesScreen() {
  const navigation = useNavigation();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const feeQuery = useQuery({
    queryKey: ["fees", activeStudentId],
    queryFn: () => getStudentFeeStatus(activeStudentId ?? ""),
    enabled: Boolean(activeStudentId),
  });
  const receiptsQuery = useQuery({
    queryKey: ["fees", "receipts", activeStudentId],
    queryFn: () => listReceipts({ studentId: activeStudentId ?? undefined }),
    enabled: Boolean(activeStudentId),
  });
  const registrationQuery = useQuery({
    queryKey: ["exam", "registrations", activeStudentId],
    queryFn: () => listExamRegistrations(activeStudentId ?? undefined),
    enabled: Boolean(activeStudentId),
  });

  const status = feeQuery.data?.status ?? "NOT_PUBLISHED";
  const remaining = Math.max((feeQuery.data?.finalAmount ?? 0) - (feeQuery.data?.paidAmount ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Fees & Exam Access"
        subtitle="Track your payments, eligibility, and quick actions for exams."
        actions={
          <View style={styles.actionsRow}>
            <Button title="Register for Exam" variant="secondary" size="sm" disabled={status !== "PAID"} onPress={() => navigation.navigate("ExamRegistration" as never)} />
            <Button title="Pay Now" size="sm" disabled={status === "NOT_PUBLISHED"} onPress={() => navigation.navigate("Payment" as never)} />
          </View>
        }
      />

      {parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to view fees">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      {feeQuery.isLoading || receiptsQuery.isLoading ? <LoadingState /> : null}
      {feeQuery.error || receiptsQuery.error ? <ErrorState message="Unable to load fee details." /> : null}

      {feeQuery.data ? (
        <>
          <Card title="Fee Summary" subtitle="Your fee status for the current term">
            <View style={styles.summaryGrid}>
              {[
                { label: "Base Fee", value: feeQuery.data.baseAmount ?? 0 },
                { label: "Scholarship", value: feeQuery.data.scholarshipAmount ?? 0 },
                { label: "Discount", value: feeQuery.data.discountAmount ?? 0 },
                { label: "Late Fee", value: feeQuery.data.lateFee ?? 0 },
                { label: "Payable", value: feeQuery.data.finalAmount ?? feeQuery.data.totalAmount ?? 0 },
                { label: "Paid", value: feeQuery.data.paidAmount ?? 0 },
                { label: "Remaining", value: remaining },
              ].map((item) => (
                <View key={item.label} style={styles.summaryCard}>
                  <Text style={styles.metaLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>₹{item.value}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card title="Status" subtitle="Eligibility snapshot">
            <View style={styles.statusRow}>
              <Text style={styles.meta}>Fee Status</Text>
              <StatusBadge
                variant={status === "PAID" ? "success" : status === "PARTIAL" ? "warning" : status === "NOT_PUBLISHED" ? "neutral" : "danger"}
                label={status}
                dot
              />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.meta}>Exam Registration</Text>
              <StatusBadge
                variant={(registrationQuery.data?.length ?? 0) > 0 ? "success" : "neutral"}
                label={(registrationQuery.data?.length ?? 0) > 0 ? "Registered" : "Not Registered"}
                dot
              />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.meta}>Fee Due Date</Text>
              <Text style={styles.metaStrong}>{feeQuery.data.dueDate ? formatDate(feeQuery.data.dueDate) : "—"}</Text>
            </View>
            <View style={styles.statusNote}>
              <Text style={styles.meta}>
                {status === "NOT_PUBLISHED"
                  ? "Fee not available yet."
                  : status === "PAID"
                    ? "You can register for exams and download admit cards when published."
                    : "Complete payment to unlock exam registration and admit cards."}
              </Text>
            </View>
            <Button title={status === "PAID" ? "Pay Again" : "Pay Now"} variant={status === "PAID" ? "secondary" : "primary"} onPress={() => navigation.navigate("Payment" as never)} />
          </Card>
        </>
      ) : (
        <EmptyState title="No fee status" subtitle="Fee status will appear once published." />
      )}

      <Card title="Receipts" subtitle="All fee payment receipts">
        {receiptsQuery.data?.length ? (
          <View style={styles.list}>
            {receiptsQuery.data.map((entry: any) => (
              <View key={entry?.payment?.id ?? entry?.id} style={styles.listItem}>
                <View>
                  <Text style={styles.title}>
                    Receipt #{entry?.receipt?.number ?? entry?.payment?.id ?? entry?.id ?? "—"}
                  </Text>
                  <Text style={styles.meta}>
                    Paid: {entry?.payment?.createdAt ? formatDate(entry.payment.createdAt) : "—"}
                  </Text>
                </View>
                <Button
                  title="View"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate(
                      "Receipt" as never,
                      { paymentId: entry?.payment?.id ?? entry?.paymentId ?? entry?.id } as never
                    )
                  }
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No receipts" subtitle="Receipts appear after payments are completed." />
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  summaryCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink[100],
    gap: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statusNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  metaStrong: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
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
});
