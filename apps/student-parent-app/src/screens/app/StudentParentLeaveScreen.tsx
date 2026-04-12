import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery } from "@tanstack/react-query";
import { applyStudentLeave, listStudentLeaves } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";
import AppDatePicker from "../../components/AppDatePicker";
import { openFileUrl, toUploadFile } from "../../utils/files";

function getFileName(url?: string | null) {
  if (!url) return null;
  try {
    const clean = url.split("?")[0];
    const parts = clean.split("/");
    return parts[parts.length - 1];
  } catch {
    return "Attachment";
  }
}

function getFileIcon(url?: string | null) {
  if (!url) return "📎";
  const clean = url.split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  return "📎";
}

export default function StudentParentLeaveScreen() {
  const { role } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const query = useQuery({
    queryKey: ["student", "leaves"],
    queryFn: listStudentLeaves,
  });

  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", leaveType: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [pickerField, setPickerField] = useState<"fromDate" | "toDate" | null>(null);

  const setDateField = (field: "fromDate" | "toDate", value: Date) => {
    const iso = value.toISOString().slice(0, 10);
    setForm((prev) => ({ ...prev, [field]: iso }));
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    setFile(result.assets?.[0] ?? null);
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      setError("From Date, To Date, and Reason are required.");
      return;
    }
    if (role === "PARENT" && !activeStudentId) {
      setError("Please select a student.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("fromDate", form.fromDate);
      formData.append("toDate", form.toDate);
      formData.append("reason", form.reason);
      if (form.leaveType) formData.append("leaveType", form.leaveType);
      if (role === "PARENT" && activeStudentId) formData.append("studentId", activeStudentId);
      if (file?.uri) {
        formData.append("attachment", toUploadFile(file) as any);
      }
      await applyStudentLeave(formData);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title={role === "PARENT" ? "Student Leaves" : "My Leaves"} subtitle="Apply for leave and track approvals." />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to apply leave">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      <Card title="Apply Leave">
        <Text style={styles.label}>From Date</Text>
        <Pressable style={styles.input} onPress={() => setPickerField("fromDate")}>
          <Text style={styles.inputText}>{form.fromDate || "Select date"}</Text>
        </Pressable>
        <Text style={styles.label}>To Date</Text>
        <Pressable style={styles.input} onPress={() => setPickerField("toDate")}>
          <Text style={styles.inputText}>{form.toDate || "Select date"}</Text>
        </Pressable>
        <Text style={styles.label}>Leave Type</Text>
        <TextInput
          style={styles.input}
          placeholder="Sick / Casual / Emergency / Other"
          value={form.leaveType}
          onChangeText={(value) => setForm({ ...form, leaveType: value })}
        />
        <Text style={styles.label}>Attachment (optional)</Text>
        <Button title={file ? "Change File" : "Upload File"} variant="secondary" onPress={handlePickFile} />
        {file ? <Text style={styles.meta}>Selected: {file.name ?? "File"}</Text> : null}
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
                {leave.attachmentUrl ? (
                  <Pressable style={styles.attachment} onPress={() => openFileUrl(leave.attachmentUrl)}>
                    <Text style={styles.attachmentText}>
                      {getFileIcon(leave.attachmentUrl)} {getFileName(leave.attachmentUrl) ?? "Attachment"} • View
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No leave requests" subtitle="Apply for leave to track approvals." />
        )}
      </Card>

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
  inputText: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
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
  attachment: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[50],
    borderWidth: 1,
    borderColor: colors.ink[100],
  },
  attachmentText: {
    fontSize: 11,
    color: colors.ink[700],
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
});
