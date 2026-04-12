import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, PageHeader, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function resolveLink(item: any) {
  if (item?.notification?.linkUrl) return item.notification.linkUrl as string;
  const meta = item?.notification?.metadata;
  if (meta && typeof meta === "object") {
    const routes = (meta as { routes?: Record<string, string> }).routes;
    if (routes?.TEACHER) return routes.TEACHER;
  }
  return null;
}

function mapRouteToScreen(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/teacher/timetable")) return "Timetable";
  if (path.startsWith("/teacher/attendance")) return "Attendance";
  if (path.startsWith("/classroom")) return "Classroom";
  if (path.startsWith("/notifications")) return "Alerts";
  if (path.startsWith("/teacher/messages")) return "TeacherMessages";
  if (path.startsWith("/teacher/notices")) return "TeacherNotices";
  if (path.startsWith("/teacher/profile")) return "TeacherProfile";
  if (path.startsWith("/marks")) return "TeacherMarks";
  if (path.startsWith("/teacher/analytics")) return "TeacherAnalytics";
  if (path.startsWith("/ranking")) return "TeacherRank";
  return path;
}

export default function TeacherNotificationsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications({ page: 1, limit: 50 }),
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const unreadCount = useMemo(() => items.filter((item: any) => !item.readAt).length, [items]);

  const refreshBadges = () => {
    queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    refreshBadges();
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead(id);
    refreshBadges();
  };

  const navigateTo = (route: string) => {
    const tabRoutes = new Set(["Dashboard", "Classroom", "Timetable", "Attendance", "Alerts"]);
    if (tabRoutes.has(route)) {
      navigation.navigate("Tabs" as never, { screen: route } as never);
      return;
    }
    navigation.navigate(route as never);
  };

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading notifications">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "Inbox and alerts"}
        actions={<Button title="Mark all read" variant="secondary" onPress={handleMarkAll} />}
      />

      {query.error ? <ErrorState message="Unable to load notifications." /> : null}

      <Card>
        {items.length ? (
          <View style={styles.list}>
            {items.map((item: any) => {
              const link = resolveLink(item);
              const mapped = mapRouteToScreen(link);
              const isUnread = !item.readAt;
              return (
                <View key={item.id} style={[styles.notice, isUnread && styles.noticeUnread]}>
                  <View style={styles.noticeHeader}>
                    <View style={styles.noticeTitleRow}>
                      <Text style={styles.noticeTitle}>{item.notification?.title ?? "Notification"}</Text>
                      {item.notification?.category ? (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>{item.notification.category}</Text>
                        </View>
                      ) : null}
                      {isUnread ? (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>New</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.noticeTime}>
                      {formatTime(item.notification?.sentAt ?? item.notification?.createdAt ?? item.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.noticeBody}>{item.notification?.body ?? "—"}</Text>
                  <View style={styles.noticeActions}>
                    {mapped ? (
                      <Button
                        title="View"
                        variant="secondary"
                        onPress={() => {
                          if (typeof mapped === "string" && mapped.startsWith("http")) {
                            Linking.openURL(mapped);
                          } else if (typeof mapped === "string") {
                            navigateTo(mapped);
                          }
                          if (isUnread) {
                            handleMarkOne(item.id);
                          }
                        }}
                      />
                    ) : null}
                    {isUnread ? (
                      <Button title="Mark read" variant="ghost" onPress={() => handleMarkOne(item.id)} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState title="No notifications" subtitle="You're all caught up." />
        )}
      </Card>
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
    gap: 12,
  },
  notice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 14,
    gap: 8,
  },
  noticeUnread: {
    borderColor: colors.sky[200],
    backgroundColor: "rgba(239,246,255,0.7)",
  },
  noticeHeader: {
    gap: 6,
  },
  noticeTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  categoryBadge: {
    backgroundColor: colors.ink[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  newBadge: {
    backgroundColor: colors.rose[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.white,
    fontFamily: typography.fontBody,
  },
  noticeTime: {
    fontSize: 10,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  noticeBody: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  noticeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
