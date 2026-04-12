import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { getParentDashboard, getStudentDashboard, getStudentFeeStatus, getStudentMe, getUnreadCount } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge, colors, typography } from "@saiyonix/ui";

export default function StudentParentDashboardScreen() {
  const { role } = useAuth();
  const navigation = useNavigation();
  const query = useQuery({
    queryKey: ["dashboard", role],
    queryFn: role === "PARENT" ? getParentDashboard : getStudentDashboard,
  });
  const studentQuery = useQuery({
    queryKey: ["student", "me"],
    queryFn: getStudentMe,
    enabled: role === "STUDENT",
  });
  const feeQuery = useQuery({
    queryKey: ["fee-status", studentQuery.data?.id],
    queryFn: () => getStudentFeeStatus(studentQuery.data?.id as string),
    enabled: Boolean(studentQuery.data?.id) && role === "STUDENT",
  });
  const unreadQuery = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: getUnreadCount,
    enabled: role === "PARENT",
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {role === "PARENT" ? (
        <LinearGradient colors={["#1e1b4b", "#0f172a"]} style={styles.hero}>
          <Text style={styles.heroGreeting}>{greeting} 👋</Text>
          <Text style={styles.heroTitle}>Parent Dashboard</Text>
          <Text style={styles.heroSubtitle}>
            Monitor your children's attendance, performance, and school announcements.
          </Text>
          <View style={styles.heroActions}>
            <Button title="Family Profile" variant="secondary" size="sm" onPress={() => navigation.navigate("Profile" as never)} />
            <Button title="Apply Leave" variant="secondary" size="sm" onPress={() => navigation.navigate("Leaves" as never)} />
            <Button
              title={`Class Teachers${unreadQuery.data ? ` (${unreadQuery.data})` : ""}`}
              size="sm"
              onPress={() => navigation.navigate("Messages" as never)}
            />
          </View>
        </LinearGradient>
      ) : (
        <LinearGradient colors={["#10b981", "#06b6d4"]} style={styles.hero}>
          <Text style={styles.heroGreeting}>{greeting} 👋</Text>
          <Text style={styles.heroTitle}>Student Space</Text>
          <Text style={styles.heroSubtitle}>
            Track attendance, prepare for exams, and stay updated with school announcements.
          </Text>
          {query.data?.currentClassName || query.data?.currentSectionName ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                Class: {query.data?.currentClassName ?? "—"} • Section: {query.data?.currentSectionName ?? "—"}
              </Text>
            </View>
          ) : null}
          <View style={styles.heroActions}>
            <Button title="Timetable" variant="secondary" size="sm" onPress={() => navigation.navigate("Timetable" as never)} />
            <Button title="Class Teacher" size="sm" onPress={() => navigation.navigate("Messages" as never)} />
          </View>
        </LinearGradient>
      )}

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load dashboard." /> : null}

      {query.data ? (
        <>
          {role === "PARENT" ? (
            <>
              <View style={styles.statsRow}>
                <StatCard label="Registered Children" value={query.data.children?.length ?? 0} color="jade" />
                <StatCard label="Unread Notifications" value={query.data.unreadNotificationsCount ?? 0} color="purple" />
                <StatCard label="Recent Notices" value={query.data.recentNotices?.length ?? 0} color="sky" />
              </View>

              <Card title="Children Highlights">
                {query.data.children?.length ? (
                  <View style={styles.cardList}>
                    {query.data.children.map((child: any) => {
                      const att = child.attendanceSummary?.attendancePercentage ?? 0;
                      return (
                        <View key={child.studentId} style={styles.childCard}>
                          <View style={styles.childHeader}>
                            <View>
                              <Text style={styles.listTitle}>{child.studentName ?? "Student"}</Text>
                              <Text style={styles.meta}>
                                {child.className ?? ""} {child.sectionName ?? ""} {child.rollNumber ? `• Roll ${child.rollNumber}` : ""}
                              </Text>
                            </View>
                            <Text style={[styles.attendanceValue, att < 75 ? styles.attendanceRisk : styles.attendanceOk]}>{att}%</Text>
                          </View>
                          <View style={styles.childStatusRow}>
                            <Text style={styles.meta}>Today's Presence</Text>
                            <StatusBadge
                              variant={
                                child.todaysAttendanceStatus === "PRESENT"
                                  ? "success"
                                  : child.todaysAttendanceStatus === "ABSENT"
                                    ? "danger"
                                    : child.todaysAttendanceStatus === "LATE"
                                      ? "warning"
                                      : "neutral"
                              }
                              label={child.todaysAttendanceStatus ?? "Not marked"}
                              dot={false}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <EmptyState title="No linked students" subtitle="Please ask administration to link your profile to your children." />
                )}
              </Card>

              <Card title="Recent Notices" subtitle="Important announcements">
                {query.data.recentNotices?.length ? (
                  <View style={styles.list}>
                    {query.data.recentNotices.map((notice) => (
                      <View key={notice.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{notice.title}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No notices" subtitle="New notices will appear here." compact />
                )}
              </Card>

              <Card title="Circulars" subtitle="Official school documents">
                {query.data.recentCirculars?.length ? (
                  <View style={styles.list}>
                    {query.data.recentCirculars.map((circular) => (
                      <View key={circular.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{circular.title}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No circulars" subtitle="Circulars will appear here." compact />
                )}
              </Card>

              <Card title="Upcoming Family Exams" subtitle="Track approaching tests">
                {query.data.upcomingExams?.length ? (
                  <View style={styles.list}>
                    {query.data.upcomingExams.map((exam: any, idx: number) => (
                      <View key={`${exam.examId}-${idx}`} style={styles.examItem}>
                        <Text style={styles.listTitle}>
                          {exam.studentName ?? "Student"} • {exam.subject}
                        </Text>
                        <Text style={styles.meta}>
                          {new Date(exam.date).toLocaleDateString()} • {exam.startTime ?? "TBA"}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No exams scheduled" subtitle="Check back later for upcoming exams." />
                )}
              </Card>
            </>
          ) : (
            <>
              <Card title="Fee Snapshot" subtitle="Payment progress and quick actions">
                <View style={styles.feeRow}>
                  <View style={styles.feeBlock}>
                    <Text style={styles.metaLabel}>Total Fee</Text>
                    <Text style={styles.feeValue}>₹{feeQuery.data?.totalAmount ?? 0}</Text>
                  </View>
                  <View style={styles.feeBlock}>
                    <Text style={styles.metaLabel}>Paid</Text>
                    <Text style={styles.feeValue}>₹{feeQuery.data?.paidAmount ?? 0}</Text>
                  </View>
                  <View style={styles.feeBlock}>
                    <Text style={styles.metaLabel}>Remaining</Text>
                    <Text style={styles.feeValue}>₹{Math.max((feeQuery.data?.totalAmount ?? 0) - (feeQuery.data?.paidAmount ?? 0), 0)}</Text>
                  </View>
                </View>
                <View style={styles.feeStatusRow}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <StatusBadge
                    variant={
                      feeQuery.data?.status === "PAID"
                        ? "success"
                        : feeQuery.data?.status === "PARTIAL"
                          ? "warning"
                          : "danger"
                    }
                    label={feeQuery.data?.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <View style={styles.heroActions}>
                  <Button title="Pay Now" size="sm" />
                  <Button title="Register Exam" variant="secondary" size="sm" disabled={feeQuery.data?.status !== "PAID"} />
                  <Button title="Admit Card" variant="ghost" size="sm" />
                </View>
              </Card>

              <View style={styles.statsRow}>
                <StatCard label="Overall Attendance" value={`${query.data.attendanceSummary?.attendancePercentage ?? 0}%`} color="jade" />
                <StatCard label="Today's Status" value={query.data.todaysAttendanceStatus ?? "Not marked"} color="sky" />
                <StatCard label="Notifications" value={query.data.unreadNotificationsCount ?? 0} color="purple" />
              </View>

              <Card title="Attendance Breakdown" subtitle="Your register history for the current term">
                <View style={styles.breakdownGrid}>
                  {[
                    { label: "Present", value: query.data.attendanceSummary?.presentDays ?? 0, bg: "#ecfdf3", color: colors.jade[700] },
                    { label: "Absent", value: query.data.attendanceSummary?.absentDays ?? 0, bg: "#fff1f2", color: colors.rose[700] },
                    { label: "Late", value: query.data.attendanceSummary?.lateDays ?? 0, bg: "#fff7ed", color: colors.sunrise[700] },
                    { label: "Half Day", value: query.data.attendanceSummary?.halfDays ?? 0, bg: "#f0f7ff", color: colors.sky[700] },
                  ].map((item) => (
                    <View key={item.label} style={[styles.breakdownItem, { backgroundColor: item.bg }]}>
                      <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Card title="Recent Notices" subtitle="Important announcements">
                {query.data.recentNotices?.length ? (
                  <View style={styles.list}>
                    {query.data.recentNotices.map((notice) => (
                      <View key={notice.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{notice.title}</Text>
                        {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No notices" subtitle="New notices will appear here." compact />
                )}
              </Card>

              <Card title="Circulars" subtitle="Official school documents">
                {query.data.recentCirculars?.length ? (
                  <View style={styles.list}>
                    {query.data.recentCirculars.map((circular) => (
                      <View key={circular.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{circular.title}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No circulars" subtitle="Circulars will appear once published." compact />
                )}
              </Card>

              <Card title="Upcoming Exams" subtitle="Prepare for your next tests">
                {query.data.upcomingExams?.length ? (
                  <View style={styles.list}>
                    {query.data.upcomingExams.map((exam: any, idx: number) => (
                      <View key={`${exam.examId}-${idx}`} style={styles.examItem}>
                        <Text style={styles.listTitle}>{exam.subject} • {exam.examTitle}</Text>
                        <Text style={styles.meta}>
                          {new Date(exam.date).toLocaleDateString()} • {exam.startTime ?? "TBA"} {exam.roomNumber ? `• RM ${exam.roomNumber}` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No exams scheduled" subtitle="Check back later for upcoming exams." />
                )}
              </Card>
            </>
          )}
        </>
      ) : null}
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
  hero: {
    padding: 20,
    borderRadius: 20,
    gap: 10,
  },
  heroGreeting: {
    color: "rgba(255,255,255,0.75)",
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
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: typography.fontBody,
  },
  heroActions: {
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
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardList: {
    marginTop: 12,
    gap: 12,
  },
  childCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 10,
  },
  childHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  attendanceValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  attendanceOk: {
    color: colors.jade[600],
  },
  attendanceRisk: {
    color: colors.rose[600],
  },
  childStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  listItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
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
  examItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 4,
  },
  feeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  feeBlock: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    gap: 6,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  feeStatusRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  breakdownItem: {
    width: "48%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  breakdownLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
