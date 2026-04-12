import React, { useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery } from "@tanstack/react-query";
import { applyTeacherLeave, listTeacherLeaves, resolvePublicUrl } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import AppDatePicker from "../../components/AppDatePicker";
import { toUploadFile } from "../../utils/files";
import PageShell from "../../components/PageShell";

const LEAVE_TYPES = [
  { value: "", label: "Select" },
  { value: "SICK", label: "Sick" },
  { value: "CASUAL", label: "Casual" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "OTHER", label: "Other" },
];

function getFileName(url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const name = clean.split("/").pop() ?? "";
  return decodeURIComponent(name) || null;
}

function getFileIcon(url?: string | null) {
  if (!url) return null;
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📄";
  if (["jpg", "jpeg", "png"].includes(ext)) return "🖼";
  return "📎";
}

export default function TeacherLeaveScreen() {
  const query = useQuery({
    queryKey: ["teacher", "leaves"],
    queryFn: listTeacherLeaves,
  });

  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", leaveType: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [pickerField, setPickerField] = useState<"fromDate" | "toDate" | null>(null);

  const setDateField = (field: "fromDate" | "toDate", value: Date) => {
    const iso = value.toISOString().slice(0, 10);
    setForm((prev) => ({ ...prev, [field]: iso }));
  };

  const items = useMemo(() => {
    const list = query.data ?? [];
    if (!queryText.trim()) return list;
    const q = queryText.trim().toLowerCase();
    return list.filter((leave) =>
      [leave.reason, leave.leaveType, leave.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [query.data, queryText]);

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0] ?? null;
    setFile(asset);
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      setError("From Date, To Date, and Reason are required.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("fromDate", form.fromDate);
      formData.append("toDate", form.toDate);
      formData.append("reason", form.reason);
      if (form.leaveType) formData.append("leaveType", form.leaveType);
      if (file?.uri) {
        formData.append("attachment", toUploadFile(file) as any);
      }
      await applyTeacherLeave(formData);
      setMessage("Leave request submitted.");
      setForm({ fromDate: "", toDate: "", reason: "", leaveType: "" });
      setFile(null);
      await query.refetch();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to submit leave request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading leave requests">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="My Leaves" subtitle="Apply for leave and track approvals." />

      <Card title="Apply Leave">
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.label}>From Date</Text>
            <Pressable style={styles.input} onPress={() => setPickerField("fromDate")}>
              <Text style={styles.inputText}>{form.fromDate || "Select date"}</Text>
            </Pressable>
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>To Date</Text>
            <Pressable style={styles.input} onPress={() => setPickerField("toDate")}>
              <Text style={styles.inputText}>{form.toDate || "Select date"}</Text>
            </Pressable>
          </View>
          <Select
            label="Leave Type"
            value={form.leaveType}
            onChange={(value) => setForm({ ...form, leaveType: value })}
            options={LEAVE_TYPES}
          />
          <View style={styles.formField}>
            <Text style={styles.label}>Attachment (optional)</Text>
            <Pressable style={styles.fileButton} onPress={handlePickFile}>
              <Text style={styles.fileButtonText}>{file?.name ?? "Choose file"}</Text>
            </Pressable>
          </View>
          <View style={styles.formFieldFull}>
            <Text style={styles.label}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Explain your leave request"
              value={form.reason}
              onChangeText={(value) => setForm({ ...form, reason: value })}
              multiline
            />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Button title={saving ? "Submitting..." : "Submit Leave"} onPress={handleSubmit} loading={saving} />
      </Card>

      {query.error ? <ErrorState message="Unable to load leave requests." /> : null}

      <Card>
        <View style={styles.searchBlock}>
          <Text style={styles.label}>Search</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by reason, type, or status"
            value={queryText}
            onChangeText={setQueryText}
          />
        </View>
        {items.length ? (
          <View style={styles.list}>
            {items.map((leave: any) => (
              <Pressable key={leave.id} style={styles.listItem} onPress={() => setSelected(leave)}>
                <View style={styles.listHeader}>
                  <View>
                    <Text style={styles.title}>{formatDate(leave.fromDate)} → {formatDate(leave.toDate)}</Text>
                    <Text style={styles.meta}>{leave.leaveType ?? "Leave"} • {leave.reason}</Text>
                  </View>
                  <StatusBadge
                    variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "danger" : "warning"}
                    label={leave.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <View style={styles.attachmentRow}>
                  <Text style={styles.meta}>Attachment</Text>
                  {leave.attachmentUrl ? (
                    <View style={styles.attachmentInline}>
                      <Text style={styles.meta}>{getFileIcon(leave.attachmentUrl)}</Text>
                      <Text style={styles.meta}>{getFileName(leave.attachmentUrl) ?? "Attachment"}</Text>
                    </View>
                  ) : (
                    <Text style={styles.meta}>—</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="No leave requests yet" subtitle="Apply for leave to track approvals." />
        )}
      </Card>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>Leave Details</Text>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Date Range</Text>
                  <Text style={styles.modalValue}>{formatDate(selected.fromDate)} → {formatDate(selected.toDate)}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Status</Text>
                  <StatusBadge
                    variant={selected.status === "APPROVED" ? "success" : selected.status === "REJECTED" ? "danger" : "warning"}
                    label={selected.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Leave Type</Text>
                  <Text style={styles.modalValue}>{selected.leaveType ?? "—"}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Approved At</Text>
                  <Text style={styles.modalValue}>{formatDate(selected.approvedAt)}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Reason</Text>
                  <Text style={styles.modalValue}>{selected.reason ?? "—"}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Admin Remarks</Text>
                  <Text style={styles.modalValue}>{selected.adminRemarks ?? "—"}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.meta}>Attachment</Text>
                  {selected.attachmentUrl ? (
                    <Pressable
                      style={styles.attachmentChip}
                      onPress={() => Linking.openURL(resolvePublicUrl(selected.attachmentUrl))}
                    >
                      <Text style={styles.attachmentText}>{getFileIcon(selected.attachmentUrl)} {getFileName(selected.attachmentUrl) ?? "Attachment"}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.modalValue}>No attachment uploaded.</Text>
                  )}
                </View>
                <Button title="Close" variant="secondary" onPress={() => setSelected(null)} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <AppDatePicker
        visible={pickerField !== null}
        title={pickerField === "fromDate" ? "Select From Date" : "Select To Date"}
        value={pickerField ? form[pickerField] : undefined}
        onCancel={() => setPickerField(null)}
        onConfirm={(selectedDate) => {
          if (!pickerField) return;
          setDateField(pickerField, selectedDate);
          setPickerField(null);
        }}
      />
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
  formGrid: {
    gap: 12,
  },
  formField: {
    gap: 6,
  },
  formFieldFull: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[900],
    backgroundColor: colors.white,
  },
  inputText: {
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[900],
    fontWeight: "600",
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  fileButton: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  fileButtonText: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
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
  searchBlock: {
    gap: 6,
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
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attachmentInline: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  modalSection: {
    gap: 4,
  },
  modalValue: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "500",
  },
  attachmentChip: {
    backgroundColor: colors.ink[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  attachmentText: {
    fontSize: 11,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
});
