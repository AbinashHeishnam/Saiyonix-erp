import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getStudentExamRoutine } from "@saiyonix/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";

type ViewKey = "day" | "week" | "month";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString();
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function withinRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

export default function StudentParentExamScreen() {
  const { role } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [view, setView] = useState<ViewKey>("day");
  const [selected, setSelected] = useState<any | null>(null);

  const query = useQuery({
    queryKey: ["exam-routine", activeStudentId, role],
    queryFn: () => getStudentExamRoutine(role === "PARENT" ? activeStudentId ?? undefined : undefined),
    enabled: role !== "PARENT" || Boolean(activeStudentId),
  });

  const rawItems = useMemo(() => {
    const payload = query.data ?? [];
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [query.data]);

  const items = useMemo(() => {
    const list = rawItems as any[];
    if (role === "PARENT" && activeStudentId) {
      return list.filter((item) => !item.studentId || item.studentId === activeStudentId);
    }
    return list;
  }, [rawItems, role, activeStudentId]);

  const filtered = useMemo(() => {
    const now = new Date();
    if (view === "day") {
      return items.filter((item: any) => isSameDay(new Date(item.date), now));
    }
    if (view === "week") {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      return items.filter((item: any) => withinRange(new Date(item.date), start, end));
    }
    const month = now.getMonth();
    const year = now.getFullYear();
    return items.filter((item: any) => {
      const d = new Date(item.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [items, view]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((item: any) => {
      const key = formatDate(item.date);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }, [filtered]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Exam Routine" subtitle="View upcoming exams and room details." />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to view exam routine">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      <View style={styles.toggleRow}>
        {(["day", "week", "month"] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setView(key)}
            style={[styles.toggleChip, view === key && styles.toggleChipActive]}
          >
            <Text style={[styles.toggleText, view === key && styles.toggleTextActive]}>{key.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load exams." /> : null}

      <Card title="Exam Routine" subtitle="Published schedules">
        {grouped.length ? (
          <View style={styles.list}>
            {grouped.map(([dateKey, entries]) => (
              <View key={dateKey} style={styles.dayBlock}>
                <Text style={styles.dayTitle}>{dateKey}</Text>
                <View style={styles.entries}>
                  {entries.map((entry: any) => (
                    <Pressable
                      key={`${entry.examId}-${entry.subject}-${entry.startTime}`}
                      style={styles.entryCard}
                      onPress={() => setSelected(entry)}
                    >
                      <View style={styles.entryRow}>
                        <Text style={styles.title}>{entry.subject ?? "Subject"}</Text>
                        <StatusBadge variant={entry.shift === "AFTERNOON" ? "info" : "success"} label={entry.shift ?? "MORNING"} dot={false} />
                      </View>
                      <Text style={styles.meta}>
                        {entry.examTitle ?? "Exam"} • {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                      </Text>
                      {entry.roomNumber ? <Text style={styles.meta}>Room {entry.roomNumber}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No exams scheduled" subtitle="Exam routine will appear once published." />
        )}
      </Card>

      <Modal transparent visible={Boolean(selected)} animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Exam Details</Text>
            {selected ? (
              <View style={styles.modalBody}>
                <View>
                  <Text style={styles.metaLabel}>Subject</Text>
                  <Text style={styles.title}>{selected.subject ?? "—"}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Exam</Text>
                  <Text style={styles.title}>{selected.examTitle ?? "—"}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.title}>{formatDate(selected.date)}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Time</Text>
                  <Text style={styles.title}>{formatTime(selected.startTime)} - {formatTime(selected.endTime)}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Shift</Text>
                  <Text style={styles.title}>{selected.shift ?? "MORNING"}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Room</Text>
                  <Text style={styles.title}>{selected.roomNumber ?? "—"}</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
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
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  toggleChipActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  toggleText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  toggleTextActive: {
    color: colors.white,
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  dayBlock: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 10,
  },
  dayTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  entries: {
    gap: 8,
  },
  entryCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 4,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.ink[400],
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
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  modalBody: {
    gap: 10,
  },
});
