import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listCertificateRequests, requestCertificate } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";
import { openFileUrl } from "../../utils/files";

export default function StudentParentCertificatesScreen() {
  const { role, user } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [form, setForm] = useState({ type: "TC", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isRestricted = Boolean(user?.restricted);

  const query = useQuery({
    queryKey: ["certificates", activeStudentId, role],
    queryFn: () => listCertificateRequests(role === "PARENT" ? { studentId: activeStudentId ?? undefined } : undefined),
  });

  const items = Array.isArray(query.data) ? query.data : [];

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!form.type) {
      setError("Select a certificate type.");
      return;
    }
    if (role === "PARENT" && !activeStudentId) {
      setError("Select a student.");
      return;
    }
    setSaving(true);
    try {
      await requestCertificate({
        type: form.type,
        reason: form.reason.trim() || undefined,
        studentId: role === "PARENT" ? activeStudentId ?? undefined : undefined,
      });
      setMessage("Certificate requested successfully.");
      setForm({ type: "TC", reason: "" });
      await query.refetch();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Unable to submit request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Certificates" subtitle="Request and download certificates." />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to view certificates">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      {!isRestricted ? (
        <Card title="Request Certificate" subtitle="Submit a new certificate request">
          <Select
            label="Certificate Type"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value })}
            options={[
              { value: "TC", label: "Transfer Certificate (TC)" },
              { value: "CHARACTER", label: "Character Certificate" },
              { value: "REGISTRATION", label: "Registration Certificate" },
            ]}
          />
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Explain why you need this certificate"
            value={form.reason}
            onChangeText={(value) => setForm({ ...form, reason: value })}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <Button title={saving ? "Submitting..." : "Request Certificate"} onPress={handleSubmit} disabled={saving} />
        </Card>
      ) : (
        <Card>
          <Text style={styles.meta}>Access limited. You can only view/download certificates.</Text>
        </Card>
      )}

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load certificates." /> : null}

      <Card title="Certificates" subtitle="Requests & downloads">
        {items.length ? (
          <View style={styles.list}>
            {items.map((item: any) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listHeader}>
                  <Text style={styles.title}>{item.type ?? "Certificate"}</Text>
                  <StatusBadge
                    variant={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}
                    label={item.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <Text style={styles.meta}>Requested: {formatDate(item.createdAt)}</Text>
                {item.reason ? <Text style={styles.meta}>Reason: {item.reason}</Text> : null}
                {item.status === "REJECTED" && item.rejectedReason ? (
                  <Text style={styles.error}>Rejected: {item.rejectedReason}</Text>
                ) : null}
                {item.status === "APPROVED" && item.fileUrl ? (
                  <Button
                    title="Download Certificate"
                    size="sm"
                    variant="secondary"
                    onPress={() => openFileUrl(item.fileUrl)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No certificate requests" subtitle="Requests will appear here." />
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
    gap: 6,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  label: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  textarea: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    backgroundColor: colors.white,
    minHeight: 80,
    textAlignVertical: "top",
  },
  error: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
  success: {
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
  },
});
