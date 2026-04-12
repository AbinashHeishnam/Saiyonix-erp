import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { getTeacherDashboard, getTeacherUnread, getUnreadCount } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, StatCard, StatusBadge, Button, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";

export default function TeacherDashboardScreen() {
  const navigation = useNavigation();
  const query = useQuery({
    queryKey: ["dashboard", "teacher"],
    queryFn: getTeacherDashboard,
  });
  const unreadQuery = useQuery({
    queryKey: ["messages", "teacher-unread"],
    queryFn: getTeacherUnread,
  });
  const unreadCountQuery = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: getUnreadCount,
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading dashboard">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#4f46e5", "#1d4ed8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlowTop} />
        <View style={styles.heroGlowBottom} />
        <View style={styles.heroContent}>
          <Text style={styles.heroGreeting}>{greeting} 👋</Text>
          <Text style={styles.heroTitle}>Teacher Dashboard</Text>
          <Text style={styles.heroSubtitle}>Manage your daily classes, monitor students, and track communications.</Text>
          <View style={styles.heroBadges}>
            {query.data?.currentAcademicYear?.label ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{query.data.currentAcademicYear.label}</Text>
              </View>
            ) : null}
            {query.data?.classTeacherSections?.map((section) => (
              <View key={section.id} style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>CT: {section.className ?? "Class"} {section.sectionName ?? ""}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heroActions}>
            <Button
              title="Timetable"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate("Timetable" as never)}
            />
            <Button
              title="Apply Leave"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate("TeacherLeave" as never)}
            />
            <Button
              title={`Messages${unreadCountQuery.data ? ` (${unreadCountQuery.data})` : ""}`}
              onPress={() => navigation.navigate("TeacherMessages" as never)}
              size="sm"
            />
          </View>
        </View>
      </LinearGradient>

      {query.error ? <ErrorState message="Unable to load dashboard." /> : null}

      {query.data ? (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Today's Classes" value={query.data.todaysClasses?.length ?? 0} color="sky" style={styles.statCard} />
            <StatCard label="At-Risk Students" value={query.data.atRiskStudents?.length ?? 0} color="sunrise" style={styles.statCard} />
            <StatCard label="Unread Notifications" value={query.data.unreadNotificationsCount ?? 0} color="purple" style={styles.statCard} />
          </View>

          <Card title="Today's Schedule" subtitle="Your period timeline">
            {query.data.todaysClasses?.length ? (
              <View style={styles.list}>
                {query.data.todaysClasses.map((slot: any, idx: number) => (
                  <View key={slot.id ?? `slot-${idx}`} style={styles.scheduleItem}>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodText}>P{slot.periodNumber ?? "-"}</Text>
                    </View>
                    <View style={styles.scheduleText}>
                      <Text style={styles.listTitle}>{slot.subjectName ?? "Subject"}</Text>
                      <Text style={styles.listSubtitle}>
                        {slot.periodStartTime && slot.periodEndTime ? `${slot.periodStartTime} - ${slot.periodEndTime} • ` : ""}
                        {slot.className ?? ""} {slot.sectionName ?? ""}
                      </Text>
                      {slot.isSubstitution && slot.label ? (
                        <Text style={styles.subLabel}>{slot.label}</Text>
                      ) : null}
                    </View>
                    <View style={styles.scheduleMeta}>
                      {slot.isSubstitution ? <StatusBadge variant="warning" label="Sub" dot={false} /> : null}
                      {slot.roomNo ? (
                        <View style={styles.roomBadge}>
                          <Text style={styles.roomText}>{slot.roomNo}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No classes today" subtitle="Enjoy your day off!" />
            )}
          </Card>

          <View style={styles.gridTwo}>
            <Card title="New Messages" subtitle="Unread communications">
              {unreadQuery.data?.length ? (
                <View style={styles.list}>
                  {unreadQuery.data.slice(0, 3).map((msg: any, idx: number) => (
                    <View key={msg.id ?? `msg-${idx}`} style={styles.messageItem}>
                      <View style={styles.messageHeader}>
                        <Text style={styles.listTitle}>{msg.senderName}</Text>
                        <StatusBadge variant="neutral" label={msg.senderRole ?? "User"} dot={false} />
                      </View>
                      <Text style={styles.listSubtitle}>{msg.messageText}</Text>
                    </View>
                  ))}
                  <Button
                    title="View All Messages →"
                    variant="secondary"
                    size="sm"
                    onPress={() => navigation.navigate("TeacherMessages" as never)}
                    style={styles.fullButton}
                  />
                </View>
              ) : (
                <EmptyState title="No new messages" subtitle="All caught up!" compact />
              )}
            </Card>

            <Card title="At-Risk Students" subtitle="Attendance below 75%">
              {query.data.atRiskStudents?.length ? (
                <View style={styles.list}>
                  {query.data.atRiskStudents.map((student: any, idx: number) => (
                    <View key={student.studentId ?? `risk-${idx}`} style={styles.riskItem}>
                      <View>
                        <Text style={styles.listTitle}>{student.studentName ?? "Unknown"}</Text>
                        <Text style={styles.listSubtitle}>{student.className ?? ""} {student.sectionName ?? ""}</Text>
                      </View>
                      <StatusBadge
                        variant={student.attendancePercentage < 75 ? "danger" : "warning"}
                        label={`${student.attendancePercentage}%`}
                        dot={false}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState title="All clear" subtitle="All students are on track." compact />
              )}
            </Card>
          </View>

          <Card title="Recent Notices" subtitle="School-wide announcements">
            {query.data.recentNotices?.length ? (
              <View style={styles.noticeGrid}>
                {query.data.recentNotices.map((notice) => (
                  <View key={notice.id} style={styles.noticeCard}>
                    {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No active notices" subtitle="Check back later." />
            )}
          </Card>
        </>
      ) : null}
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
  hero: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  heroGlowTop: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -40,
    right: 60,
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: "rgba(59,130,246,0.25)",
  },
  heroContent: {
    gap: 10,
  },
  heroGreeting: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: typography.fontBody,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: typography.fontBody,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  heroBadgeText: {
    fontSize: 10,
    color: colors.white,
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 140,
  },
  gridTwo: {
    gap: 16,
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: "#f8fafc",
  },
  periodBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sky[100],
  },
  periodText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.sky[700],
    fontFamily: typography.fontDisplay,
  },
  scheduleText: {
    flex: 1,
    gap: 4,
  },
  scheduleMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  roomBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  roomText: {
    fontSize: 10,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  subLabel: {
    fontSize: 10,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  listTitle: {
    fontSize: 14,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  listSubtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  messageItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullButton: {
    alignSelf: "stretch",
  },
  riskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: colors.sunrise[100],
  },
  noticeGrid: {
    gap: 12,
  },
  noticeCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
});
