import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { getParentDashboard, getStudentDashboard, getStudentFeeStatus, getStudentMe, getUnreadCount } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge, colors, typography } from "@saiyonix/ui";
import { TAB_ROUTES } from "../../config/webParity";

function toSnakeCase(value?: string | null) {
  if (!value) return "";
  return value.trim().replace(/[\s\-]+/g, "_").replace(/__+/g, "_").toLowerCase();
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "TBA" : date.toLocaleDateString("en-IN");
}

export default function StudentParentDashboardScreen() {
  const { role } = useAuth();
  const navigation = useNavigation();

  const query = useQuery<any>({
    queryKey: ["dashboard", role],
    queryFn: async () => (role === "PARENT" ? getParentDashboard() : getStudentDashboard()),
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

  const navigateTo = (route: string) => {
    if (TAB_ROUTES.has(route as any)) {
      (navigation as any).navigate("Tabs", { screen: route });
      return;
    }
    (navigation as any).navigate(route);
  };

  if (query.isLoading) {
    return (
      <View style={styles.stateWrap}>
        <LoadingState label="Loading dashboard" />
      </View>
    );
  }

  if (query.error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState message="Unable to load dashboard." />
      </View>
    );
  }

  const data: any = query.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {role === "PARENT" ? (
        <>
          <LinearGradient colors={["#1e1b4b", "#0f172a"]} style={styles.heroCard}>
            <View style={styles.heroGlowTopRight} />
            <View style={styles.heroGlowBottom} />
            <View style={styles.heroInner}>
              <View style={styles.heroTextBlock}>
                <Text style={[styles.heroGreeting, styles.parentHeroGreeting]}>{greeting} 👋</Text>
                <Text style={styles.heroTitle}>Parent Dashboard</Text>
                <Text style={[styles.heroSubtitle, styles.parentHeroSubtitle]}>
                  Monitor your children's attendance, performance, and school announcements.
                </Text>
              </View>

              <View style={styles.heroActionStack}>
                <Button title="Family Profile" variant="secondary" size="sm" onPress={() => navigateTo("Profile")} />
                <Button title="Apply Leave" variant="secondary" size="sm" onPress={() => navigateTo("Leaves")} />
                <Button
                  title={unreadQuery.data ? `Class Teachers (${unreadQuery.data})` : "Class Teachers"}
                  size="sm"
                  onPress={() => navigateTo("ClassTeacher")}
                />
              </View>
            </View>
          </LinearGradient>

          <View style={styles.statsGrid}>
            <StatCard label="Registered Children" value={data?.children?.length ?? 0} color="jade" />
            <StatCard label="Unread Notifications" value={data?.unreadNotificationsCount ?? 0} color="purple" />
            <StatCard label="Recent Notices" value={data?.recentNotices?.length ?? 0} color="sky" />
          </View>

          <Card title="Children Highlights">
            {data?.children?.length ? (
              <View style={styles.sectionStack}>
                {data.children.map((child: any) => {
                  const att = child.attendanceSummary?.attendancePercentage ?? 0;
                  const atRisk = att < 75;
                  return (
                    <View key={child.studentId} style={styles.childCard}>
                      <View style={[styles.childAccent, atRisk ? styles.childAccentRisk : styles.childAccentOk]} />
                      <View style={styles.childHeader}>
                        <View style={styles.childHeaderText}>
                          <Text style={styles.childName}>{child.studentName ?? "Student"}</Text>
                          <Text style={styles.childMeta}>
                            {child.className ?? ""} {toSnakeCase(child.sectionName)}
                            {child.rollNumber != null ? ` • Roll ${child.rollNumber}` : ""}
                            {child.currentAcademicYear?.label ? ` • ${child.currentAcademicYear.label}` : ""}
                          </Text>
                        </View>
                        <View style={styles.childAttendanceBlock}>
                          <Text style={[styles.childAttendanceValue, atRisk ? styles.attendanceRisk : styles.attendanceOk]}>{att}%</Text>
                          <Text style={styles.childAttendanceLabel}>Attendance</Text>
                        </View>
                      </View>

                      {child.promotionStatus === "PROMOTED" && child.promotionIsFinalClass ? (
                        <View style={styles.successBanner}>
                          <Text style={styles.successBannerText}>🎉 Final class completed.</Text>
                        </View>
                      ) : null}
                      {child.promotionCongrats && !child.promotionIsFinalClass ? (
                        <View style={styles.successBanner}>
                          <Text style={styles.successBannerText}>
                            🎉 Promoted to {child.className ?? "new class"}
                            {child.sectionName ? ` • ${toSnakeCase(child.sectionName)}` : ""}
                          </Text>
                        </View>
                      ) : null}
                      {!child.promotionCongrats && child.promotionStatus === "PROMOTED" && !child.promotionIsFinalClass ? (
                        <View style={styles.warningBanner}>
                          <Text style={styles.warningBannerText}>⏳ Promotion processing.</Text>
                        </View>
                      ) : null}

                      <View style={styles.todayRow}>
                        <Text style={styles.todayLabel}>Today's Presence</Text>
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

                      <View style={styles.breakdownGrid}>
                        {[
                          { label: "Present", value: child.attendanceSummary?.presentDays ?? 0, style: styles.breakdownOk },
                          { label: "Absent", value: child.attendanceSummary?.absentDays ?? 0, style: styles.breakdownDanger },
                          { label: "Late", value: child.attendanceSummary?.lateDays ?? 0, style: styles.breakdownWarn },
                          { label: "Half", value: child.attendanceSummary?.halfDays ?? 0, style: styles.breakdownInfo },
                        ].map((item) => (
                          <View key={item.label} style={[styles.breakdownTile, item.style]}>
                            <Text style={styles.breakdownValue}>{item.value}</Text>
                            <Text style={styles.breakdownLabel}>{item.label}</Text>
                          </View>
                        ))}
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
            {data?.recentNotices?.length ? (
              <View style={styles.sectionStack}>
                {data.recentNotices.map((notice: any) => (
                  <Pressable key={notice.id} style={styles.listCard} onPress={() => navigateTo("Notices")}>
                    <Text style={styles.listTitle}>{notice.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState title="No notices" subtitle="New notices will appear here." compact />
            )}
          </Card>

          <Card title="Circulars" subtitle="Official school documents">
            {data?.recentCirculars?.length ? (
              <View style={styles.sectionStack}>
                {data.recentCirculars.map((circular: any) => (
                  <View key={circular.id} style={styles.docCard}>
                    <View style={[styles.docIconWrap, styles.parentDocIcon]}>
                      <Text style={styles.docIconText}>PDF</Text>
                    </View>
                    <Text style={styles.listTitle}>{circular.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No circulars" subtitle="Circulars will appear here." compact />
            )}
          </Card>

          <Card title="Upcoming Family Exams" subtitle="Track approaching tests">
            {data?.upcomingExams?.length ? (
              <View style={styles.sectionStack}>
                {data.upcomingExams.map((exam: any, idx: number) => (
                  <View key={`${exam.examId}-${idx}`} style={styles.timelineItem}>
                    <View style={styles.timelineDotParent} />
                    <View style={styles.timelineCard}>
                      <Text style={styles.listTitle}>
                        {exam.studentName ?? "Student"} <Text style={styles.inlineMeta}>• {exam.subject}</Text>
                      </Text>
                      <View style={styles.chipRow}>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{formatDate(exam.date)}</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{exam.startTime ?? "TBA"}</Text>
                        </View>
                        {exam.roomNumber ? (
                          <View style={[styles.metaChip, styles.roomChipParent]}>
                            <Text style={[styles.metaChipText, styles.roomChipParentText]}>RM {exam.roomNumber}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
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
          <LinearGradient colors={["#10b981", "#0f766e", "#0891b2"]} style={styles.heroCard}>
            <View style={styles.heroGlowLeft} />
            <View style={styles.heroGlowBottom} />
            <View style={styles.heroInner}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroGreeting}>{greeting} 👋</Text>
                <Text style={styles.heroTitle}>Student Space</Text>
                <Text style={styles.heroSubtitle}>
                  Track attendance, prepare for exams, and stay updated with school announcements.
                </Text>
                {data?.currentClassName || data?.currentSectionName ? (
                  <View style={styles.classBadge}>
                    <Text style={styles.classBadgeText}>
                      Class: {data?.currentClassName ?? "—"} • Section: {toSnakeCase(data?.currentSectionName) || "—"}
                      {data?.currentAcademicYear?.label ? ` • ${data.currentAcademicYear.label}` : ""}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroActionStack}>
                <Button title="Timetable" variant="secondary" size="sm" onPress={() => navigateTo("Timetable")} />
                <Button title="Class Teacher" size="sm" onPress={() => navigateTo("ClassTeacher")} />
              </View>
            </View>
          </LinearGradient>

          {data?.promotionStatus === "PROMOTED" && data?.promotionIsFinalClass ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>🎉 Congratulations! You have completed your final class.</Text>
            </View>
          ) : null}
          {data?.promotionCongrats && !data?.promotionIsFinalClass ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>
                🎉 Promoted to {data?.currentClassName ?? "new class"}
                {data?.currentSectionName ? ` • ${toSnakeCase(data.currentSectionName)}` : ""}
              </Text>
            </View>
          ) : null}
          {!data?.promotionCongrats && data?.promotionStatus === "PROMOTED" && !data?.promotionIsFinalClass ? (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>⏳ Promotion is being processed. Please check back soon.</Text>
            </View>
          ) : null}

          <Card title="Fee Snapshot" subtitle="Payment progress and quick actions">
            <View style={styles.feeSummaryGrid}>
              {[
                { label: "Total Fee", value: formatCurrency(feeQuery.data?.totalAmount ?? 0) },
                { label: "Paid", value: formatCurrency(feeQuery.data?.paidAmount ?? 0) },
                {
                  label: "Remaining",
                  value: formatCurrency(
                    Math.max((feeQuery.data?.totalAmount ?? 0) - (feeQuery.data?.paidAmount ?? 0), 0)
                  ),
                },
              ].map((item) => (
                <View key={item.label} style={styles.feeBlock}>
                  <Text style={styles.smallCaps}>{item.label}</Text>
                  <Text style={styles.feeValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.feeStatusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.smallCaps}>Status</Text>
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
              <Text style={styles.helperText}>
                Exams unlock after full payment. Admit cards unlock after admin publishes.
              </Text>
              <View style={styles.actionRow}>
                <Button title="Pay Now" size="sm" onPress={() => navigateTo("Payment")} />
                <Button
                  title="Register Exam"
                  variant="secondary"
                  size="sm"
                  disabled={feeQuery.data?.status !== "PAID"}
                  onPress={() => navigateTo("ExamRegistration")}
                />
                <Button title="Admit Card" variant="ghost" size="sm" onPress={() => navigateTo("AdmitCards")} />
              </View>
            </View>
          </Card>

          <View style={styles.statsGrid}>
            <StatCard label="Overall Attendance" value={`${data?.attendanceSummary?.attendancePercentage ?? 0}%`} color="jade" />
            <StatCard label="Today's Status" value={data?.todaysAttendanceStatus ?? "Not marked"} color="sky" />
            <StatCard label="Notifications" value={data?.unreadNotificationsCount ?? 0} color="purple" />
          </View>

          {data?.attendanceSummary ? (
            <Card title="Attendance Breakdown" subtitle="Your register history for the current term">
              <View style={styles.breakdownGrid}>
                {[
                  { label: "Present", value: data.attendanceSummary.presentDays ?? 0, style: styles.breakdownOk },
                  { label: "Absent", value: data.attendanceSummary.absentDays ?? 0, style: styles.breakdownDanger },
                  { label: "Late", value: data.attendanceSummary.lateDays ?? 0, style: styles.breakdownWarn },
                  { label: "Half Day", value: data.attendanceSummary.halfDays ?? 0, style: styles.breakdownInfo },
                ].map((item) => (
                  <View key={item.label} style={[styles.breakdownTile, item.style]}>
                    <Text style={styles.breakdownValue}>{item.value}</Text>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {data.attendanceSummary.riskFlag ? (
                <View style={styles.riskBanner}>
                  <Text style={styles.riskTitle}>Attendance Warning</Text>
                  <Text style={styles.riskText}>
                    Your attendance is below the required 75% threshold. Please maintain regular presence.
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card title="Recent Notices" subtitle="Important announcements">
            {data?.recentNotices?.length ? (
              <View style={styles.sectionStack}>
                {data.recentNotices.map((notice: any) => (
                  <Pressable key={notice.id} style={styles.listCard} onPress={() => navigateTo("Notices")}>
                    <Text style={styles.listTitle}>{notice.title}</Text>
                    {notice.noticeType ? <StatusBadge variant="info" label={notice.noticeType} dot={false} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState title="No notices" subtitle="New notices will appear here." compact />
            )}
          </Card>

          <Card title="Circulars" subtitle="Official school documents">
            {data?.recentCirculars?.length ? (
              <View style={styles.sectionStack}>
                {data.recentCirculars.map((circular: any) => (
                  <View key={circular.id} style={styles.docCard}>
                    <View style={styles.docIconWrap}>
                      <Text style={styles.docIconText}>PDF</Text>
                    </View>
                    <Text style={styles.listTitle}>{circular.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No circulars" subtitle="Circulars will appear once published." compact />
            )}
          </Card>

          <Card title="Upcoming Exams" subtitle="Prepare for your next tests">
            {data?.upcomingExams?.length ? (
              <View style={styles.sectionStack}>
                {data.upcomingExams.map((exam: any, idx: number) => (
                  <View key={`${exam.examId}-${idx}`} style={styles.timelineItem}>
                    <View style={styles.timelineDotStudent} />
                    <View style={styles.timelineCard}>
                      <Text style={styles.listTitle}>
                        {exam.subject} <Text style={styles.inlineMeta}>• {exam.examTitle}</Text>
                      </Text>
                      <View style={styles.chipRow}>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{formatDate(exam.date)}</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{exam.startTime ?? "TBA"}</Text>
                        </View>
                        {exam.roomNumber ? (
                          <View style={[styles.metaChip, styles.roomChipStudent]}>
                            <Text style={[styles.metaChipText, styles.roomChipStudentText]}>RM {exam.roomNumber}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No exams scheduled" subtitle="Check back later for upcoming exams." />
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[50],
  },
  content: {
    padding: 16,
    gap: 16,
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink[50],
    padding: 20,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroInner: {
    gap: 18,
  },
  heroGlowLeft: {
    position: "absolute",
    top: -34,
    left: -26,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroGlowTopRight: {
    position: "absolute",
    top: -42,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -50,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.14)",
  },
  heroTextBlock: {
    gap: 6,
  },
  heroGreeting: {
    fontSize: 14,
    color: "#d1fae5",
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  parentHeroGreeting: {
    color: "#c7d2fe",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.white,
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#ecfdf5",
    fontFamily: typography.fontBody,
    fontWeight: "500",
  },
  parentHeroSubtitle: {
    color: "#cbd5e1",
  },
  classBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  classBadgeText: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.white,
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroActionStack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsGrid: {
    gap: 12,
  },
  feeSummaryGrid: {
    gap: 10,
  },
  feeBlock: {
    borderRadius: 16,
    backgroundColor: "rgba(248,250,252,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    padding: 14,
  },
  smallCaps: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  feeValue: {
    marginTop: 6,
    fontSize: 21,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  feeStatusCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "rgba(248,250,252,0.8)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    padding: 14,
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  successBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successBannerText: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  warningBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warningBannerText: {
    color: "#b45309",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  riskBanner: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
    padding: 14,
    gap: 4,
  },
  riskTitle: {
    color: colors.rose[700],
    fontSize: 14,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  riskText: {
    color: colors.rose[600],
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.fontBody,
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  breakdownTile: {
    width: "47%",
    minHeight: 92,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  breakdownOk: {
    backgroundColor: "#ecfdf3",
  },
  breakdownDanger: {
    backgroundColor: "#fff1f2",
  },
  breakdownWarn: {
    backgroundColor: "#fffbeb",
  },
  breakdownInfo: {
    backgroundColor: "#eff6ff",
  },
  breakdownValue: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  breakdownLabel: {
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  sectionStack: {
    gap: 10,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.75)",
    padding: 14,
    backgroundColor: colors.white,
    gap: 8,
  },
  listTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  inlineMeta: {
    color: colors.ink[400],
    fontWeight: "500",
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.75)",
    padding: 14,
    backgroundColor: colors.white,
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  parentDocIcon: {
    backgroundColor: "#e0e7ff",
  },
  docIconText: {
    color: colors.ink[700],
    fontSize: 10,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  timelineItem: {
    paddingLeft: 18,
  },
  timelineDotStudent: {
    position: "absolute",
    left: 0,
    top: 18,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: colors.white,
  },
  timelineDotParent: {
    position: "absolute",
    left: 0,
    top: 18,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#6366f1",
    borderWidth: 2,
    borderColor: colors.white,
  },
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.75)",
    backgroundColor: colors.white,
    padding: 14,
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    borderRadius: 10,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontSize: 10,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  roomChipStudent: {
    backgroundColor: "#ccfbf1",
  },
  roomChipStudentText: {
    color: "#0f766e",
  },
  roomChipParent: {
    backgroundColor: "#e0e7ff",
  },
  roomChipParentText: {
    color: "#4338ca",
  },
  childCard: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.75)",
    backgroundColor: colors.white,
    padding: 16,
    gap: 12,
  },
  childAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  childAccentOk: {
    backgroundColor: "#3b82f6",
  },
  childAccentRisk: {
    backgroundColor: "#fb7185",
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  childHeaderText: {
    flex: 1,
    gap: 4,
  },
  childName: {
    fontSize: 19,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  childMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  childAttendanceBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  childAttendanceValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: typography.fontDisplay,
  },
  childAttendanceLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  attendanceOk: {
    color: "#10b981",
  },
  attendanceRisk: {
    color: "#f43f5e",
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    backgroundColor: colors.ink[50],
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todayLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
});
