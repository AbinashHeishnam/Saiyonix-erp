import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";

export default function StudentParentMessagesScreen() {
  const unreadQuery = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: getUnreadCount,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Messages" subtitle="Chat with teachers" />

      {unreadQuery.isLoading ? <LoadingState /> : null}
      {unreadQuery.error ? <ErrorState message="Unable to load messages." /> : null}

      <Card title="Messages" subtitle="Unread communications">
        {unreadQuery.data !== undefined ? (
          <View style={styles.listItem}>
            <Text style={styles.title}>Unread messages: {unreadQuery.data}</Text>
            <Text style={styles.meta}>Open a conversation from classroom updates in a future release.</Text>
          </View>
        ) : (
          <EmptyState title="Messaging setup needed" subtitle="Contacts will appear once messaging is enabled." />
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
  listItem: {
    marginTop: 12,
    gap: 8,
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
});
