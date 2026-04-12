import React, { useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listNotices, resolvePublicUrl } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDateTime } from "@saiyonix/utils";
import PageShell from "../../components/PageShell";

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

function isRecent(date?: string | null) {
  if (!date) return false;
  const published = new Date(date);
  if (Number.isNaN(published.getTime())) return false;
  const diffMs = Date.now() - published.getTime();
  return diffMs <= 1000 * 60 * 60 * 24 * 3;
}

export default function TeacherNoticesScreen() {
  const [selected, setSelected] = useState<any | null>(null);
  const query = useQuery({
    queryKey: ["notices"],
    queryFn: () => listNotices({ page: 1, limit: 50, active: true }),
  });

  const items = useMemo(() => {
    const payload = query.data?.data ?? query.data?.items ?? query.data ?? [];
    return Array.isArray(payload) ? payload : [];
  }, [query.data]);

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading notices">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Notice Board" subtitle="Create and manage school notices" />

      {query.error ? <ErrorState message="Unable to load notices." /> : null}

      <Card title="Notices">
        {items.length ? (
          <View style={styles.list}>
            {items.map((notice: any) => (
              <Pressable key={notice.id} style={styles.listItem} onPress={() => setSelected(notice)}>
                <View style={styles.listHeader}>
                  <View style={styles.headerLeft}>
                    <Text style={styles.listTitle}>{notice.title}</Text>
                    {isRecent(notice.publishedAt) ? (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    ) : null}
                  </View>
                  {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                </View>
                <Text style={styles.meta}>{formatDateTime(notice.publishedAt ?? notice.createdAt)}</Text>
                {notice.content ? <Text style={styles.body} numberOfLines={3}>{notice.content}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="No notices" subtitle="No notices have been published yet." />
        )}
      </Card>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.meta}>{formatDateTime(selected.publishedAt ?? selected.createdAt)}</Text>
                {selected.noticeType ? (
                  <View style={{ marginTop: 8 }}>
                    <StatusBadge variant="info" label={selected.noticeType} dot={false} />
                  </View>
                ) : null}
                {selected.content ? <Text style={styles.modalBody}>{selected.content}</Text> : null}
                {selected.attachments?.length ? (
                  <View style={styles.attachments}>
                    {selected.attachments.map((file: string, idx: number) => {
                      const fileUrl = resolvePublicUrl(file);
                      return (
                        <Pressable key={`${file}-${idx}`} onPress={() => Linking.openURL(fileUrl)} style={styles.attachmentChip}>
                          <Text style={styles.attachmentText}>{getFileIcon(file)} {getFileName(file) ?? "Attachment"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <Button title="Close" variant="secondary" onPress={() => setSelected(null)} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: colors.jade[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.jade[600],
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
  modalBody: {
    fontSize: 13,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  attachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attachmentChip: {
    backgroundColor: colors.ink[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  attachmentText: {
    fontSize: 11,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
});
