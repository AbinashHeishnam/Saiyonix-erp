import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { applyStudentLeave, listStudentLeaves } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";

export default function StudentParentLeaveScreen() {
  const query = useQuery({
    queryKey: ["student", "leaves"],
    queryFn: listStudentLeaves,
  });

  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", leaveType: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      setError("From Date, To Date, and Reason are required.");
      return;
    }
    setSaving(true);
    try {
      await applyStudentLeave({
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
        leaveType: form.leaveType || undefined,
      });
      setMessage("Leave request submitted.");
      setForm({ fromDate: "", toDate: "", reason: "", leaveType: "" });
      await query.refetch();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to submit leave request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="My Leaves" subtitle="Apply for leave and track approvals." />

      <Card title="Apply Leave">
        <Text style={styles.label}>From Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={form.fromDate}
          onChangeText={(value) => setForm({ ...form, fromDate: value })}
        />
        <Text style={styles.label}>To Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={form.toDate}
          onChangeText={(value) => setForm({ ...form, toDate: value })}
        />
        <Text style={styles.label}>Leave Type</Text>
        <TextInput
          style={styles.input}
          placeholder="Sick / Casual / Emergency / Other"
          value={form.leaveType}
          onChangeText={(value) => setForm({ ...form, leaveType: value })}
        />
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Explain your leave request"
          value={form.reason}
          onChangeText={(value) => setForm({ ...form, reason: value })}
          multiline
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Button title={saving ? "Submitting..." : "Submit Leave"} onPress={handleSubmit} loading={saving} />
      </Card>

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load leave requests." /> : null}

      <Card title="Leave Requests" subtitle="Track your applications">
        {query.data?.length ? (
          <View style={styles.list}>
            {query.data.map((leave: any) => (
              <View key={leave.id} style={styles.listItem}>
                <View style={styles.listHeader}>
                  <Text style={styles.title}>{leave.leaveType ?? "Leave"}</Text>
                  <StatusBadge
                    variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "danger" : "warning"}
                    label={leave.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <Text style={styles.meta}>{formatDate(leave.fromDate)} → {formatDate(leave.toDate)}</Text>
                <Text style={styles.meta}>{leave.reason ?? ""}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No leave requests" subtitle="Apply for leave to track approvals." />
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
  label: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
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
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  error: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
    marginTop: 6,
  },
  success: {
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
    marginTop: 6,
  },
});
