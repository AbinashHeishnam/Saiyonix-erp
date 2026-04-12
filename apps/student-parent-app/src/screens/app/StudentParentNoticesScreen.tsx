import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listNotices } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useAuth } from "@saiyonix/auth";

export default function StudentParentNoticesScreen() {
  const { role } = useAuth();
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
              <View key={notice.id} style={styles.listItem}>
                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>{notice.title}</Text>
                  {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                </View>
                <Text style={styles.meta}>{formatDate(notice.publishedAt ?? notice.createdAt)}</Text>
                {notice.content ? <Text style={styles.body}>{notice.content}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No notices" subtitle="No notices have been published yet." />
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
});
