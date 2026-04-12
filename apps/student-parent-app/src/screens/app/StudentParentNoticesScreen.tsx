import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listNotices } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useAuth } from "@saiyonix/auth";
import { openFileUrl } from "../../utils/files";

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
  if (["xls", "xlsx"].includes(ext)) return "📊";
  return "📎";
}

export default function StudentParentNoticesScreen() {
  const { role } = useAuth();
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const query = useQuery({
    queryKey: ["notices"],
    queryFn: () => listNotices({ page: 1, limit: 50, active: true }),
  });

  const items = query.data?.data ?? query.data?.items ?? query.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Notice Board" subtitle={role === "PARENT" ? "School announcements for your family" : "School announcements"} />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load notices." /> : null}

      <Card title="Notices">
        {Array.isArray(items) && items.length ? (
          <View style={styles.list}>
            {items.map((notice: any) => (
              <Pressable key={notice.id} style={styles.listItem} onPress={() => setSelectedNotice(notice)}>
                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>{notice.title}</Text>
                  {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                </View>
                <Text style={styles.meta}>{formatDate(notice.publishedAt ?? notice.createdAt)}</Text>
                {notice.content ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {notice.content}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="No notices" subtitle="No notices have been published yet." />
        )}
      </Card>

      <Modal visible={Boolean(selectedNotice)} transparent animationType="fade" onRequestClose={() => setSelectedNotice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedNotice ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedNotice.title}</Text>
                  <Pressable onPress={() => setSelectedNotice(null)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </Pressable>
                </View>
                <Text style={styles.meta}>{formatDate(selectedNotice.publishedAt ?? selectedNotice.createdAt)}</Text>
                {selectedNotice.noticeType ? (
                  <StatusBadge variant="info" label={selectedNotice.noticeType} dot={false} />
                ) : null}
                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  <Text style={styles.bodyFull}>{selectedNotice.content ?? "No description available."}</Text>
                  {selectedNotice.attachments && selectedNotice.attachments.length > 0 ? (
                    <View style={styles.attachments}>
                      {selectedNotice.attachments.map((file: string) => (
                        <Pressable
                          key={file}
                          onPress={() => openFileUrl(file)}
                          style={styles.attachmentChip}
                        >
                          <Text style={styles.attachmentText}>
                            {getFileIcon(file)} {getFileName(file) ?? "Attachment"} • View
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 6,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listTitle: {
    flex: 1,
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
  body: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderRadius: 18,
    backgroundColor: colors.white,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  closeButtonText: {
    fontSize: 11,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    gap: 12,
  },
  bodyFull: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  attachments: {
    marginTop: 6,
    gap: 8,
  },
  attachmentChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
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
});
