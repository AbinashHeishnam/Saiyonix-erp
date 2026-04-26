import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import {
  API_ORIGIN,
  createClassroomAnnouncement,
  createClassroomAssignment,
  createClassroomNote,
  getAssignmentSubmissions,
  getClassroomChatRoomMessages,
  getSectionClassroom,
  getSubjectClassroom,
  getTeacherClassroom,
  getTeacherProfile,
  getAuthTokens,
  resolvePublicUrl,
  uploadFile,
} from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import PageShell from "../../components/PageShell";
import { formatDateTime } from "@saiyonix/utils";
import { toUploadFile } from "../../utils/files";

type TeacherClassroomItem = {
  kind?: "subject" | "classTeacher";
  classId: string;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  subjectName?: string | null;
  subjectId?: string | null;
  classSubjectId?: string | null;
};

export default function TeacherClassroomScreen() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["classroom", "teacher"],
    queryFn: getTeacherClassroom,
  });

  const items = Array.isArray(query.data) ? query.data : query.data?.subjects ?? [];
  const [selected, setSelected] = useState<TeacherClassroomItem | null>(null);
  const [activeTab, setActiveTab] = useState<"stream" | "classwork" | "people">("stream");
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", dueAt: "", maxMarks: "" });
  const [noteForm, setNoteForm] = useState({ title: "", description: "" });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", content: "" });
  const [assignmentFile, setAssignmentFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [noteFile, setNoteFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const cards = useMemo(
    () =>
      (items ?? []).map((item: TeacherClassroomItem) => ({
        ...item,
        kind: item.kind ?? (item.classSubjectId ? "subject" : "classTeacher"),
      })) as TeacherClassroomItem[],
    [items]
  );

  useEffect(() => {
    if (!selected && cards.length) {
      setSelected(cards[0]);
    }
  }, [cards, selected]);

  const sectionQuery = useQuery({
    queryKey: ["classroom", "section", selected?.sectionId],
    queryFn: () => getSectionClassroom(selected?.sectionId as string),
    enabled: Boolean(selected?.sectionId),
  });

  const subjectQuery = useQuery({
    queryKey: ["classroom", "subject", selected?.classSubjectId],
    queryFn: () => getSubjectClassroom(selected?.classSubjectId as string),
    enabled: Boolean(selected?.classSubjectId) && selected?.kind === "subject",
  });

  useEffect(() => {
    if (selected) {
      setActiveTab("stream");
    }
  }, [selected?.classSubjectId, selected?.sectionId, selected?.kind]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const profileQuery = useQuery({
    queryKey: ["teacher", "profile"],
    queryFn: getTeacherProfile,
  });

  const teacherName = profileQuery.data?.teacher?.fullName ?? user?.email ?? "Teacher";

  const streamItems = useMemo(() => {
    if (!selected) return [];
    const assignments =
      selected.kind === "subject"
        ? subjectQuery.data?.assignments ?? []
        : sectionQuery.data?.assignments ?? [];
    const notes =
      selected.kind === "subject"
        ? subjectQuery.data?.notes ?? []
        : sectionQuery.data?.notes ?? [];
    const announcements =
      selected.kind === "subject"
        ? subjectQuery.data?.announcements ?? []
        : sectionQuery.data?.announcements ?? [];

    const mappedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      type: "assignment",
      title: assignment.title,
      description: assignment.description,
      createdAt: assignment.createdAt ?? assignment.dueAt ?? null,
      dueAt: assignment.dueAt ?? null,
      subjectName: assignment.classSubject?.subject?.name ?? selected.subjectName ?? null,
      attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
    }));
    const mappedNotes = notes.map((note: any) => ({
      id: note.id,
      type: "note",
      title: note.title,
      description: note.description,
      createdAt: note.createdAt ?? note.publishedAt ?? null,
      subjectName: note.classSubject?.subject?.name ?? selected.subjectName ?? null,
      fileUrl: note.fileUrl ?? null,
    }));
    const mappedAnnouncements = announcements.map((item: any) => ({
      id: item.id,
      type: "announcement",
      title: item.title,
      description: item.content,
      createdAt: item.createdAt ?? null,
      subjectName: selected.subjectName ?? null,
    }));

    return [...mappedAnnouncements, ...mappedAssignments, ...mappedNotes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [selected, sectionQuery.data, subjectQuery.data]);

  const classwork = useMemo(() => {
    if (!selected) return { assignments: [], notes: [] };
    return {
      assignments:
        selected.kind === "subject"
          ? subjectQuery.data?.assignments ?? []
          : sectionQuery.data?.assignments ?? [],
      notes:
        selected.kind === "subject"
          ? subjectQuery.data?.notes ?? []
          : sectionQuery.data?.notes ?? [],
    };
  }, [selected, sectionQuery.data, subjectQuery.data]);

  const people = useMemo(() => {
    if (!selected) return { teachers: [], students: [] };
    const teachers = sectionQuery.data?.teachers?.length
      ? sectionQuery.data.teachers
      : subjectQuery.data?.teacher
        ? [subjectQuery.data.teacher]
        : [];
    const students = sectionQuery.data?.students ?? [];
    return { teachers, students };
  }, [selected, sectionQuery.data, subjectQuery.data]);

  const handlePickAssignmentFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length) {
      setAssignmentFile(result.assets[0]);
    }
  };

  const handlePickNoteFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length) {
      setNoteFile(result.assets[0]);
    }
  };

  const handleCreateAssignment = async () => {
    setAssignmentError(null);
    if (!selected?.classId || !selected?.subjectId) {
      setAssignmentError("Please select a subject.");
      return;
    }
    if (!assignmentForm.title.trim()) {
      setAssignmentError("Title is required.");
      return;
    }
    if (!assignmentForm.dueAt.trim()) {
      setAssignmentError("Deadline is required.");
      return;
    }
    setAssignmentSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (assignmentFile) {
        const uploadRes = await uploadFile({
          file: toUploadFile(assignmentFile),
          userType: "teacher",
          userId: user?.id ?? "shared",
          module: "assignments",
        });
        fileUrl = uploadRes?.fileUrl ?? null;
        fileName = assignmentFile.name ?? null;
      }
      const deadlineValue =
        assignmentForm.dueAt.length === 10 ? `${assignmentForm.dueAt}T23:59:00` : assignmentForm.dueAt;
      await createClassroomAssignment({
        classId: selected.classId,
        sectionId: selected.sectionId ?? null,
        subjectId: selected.subjectId ?? "",
        title: assignmentForm.title,
        description: assignmentForm.description || undefined,
        deadline: deadlineValue,
        maxMarks: assignmentForm.maxMarks ? Number(assignmentForm.maxMarks) : undefined,
        fileUrl,
        fileName,
      });
      setAssignmentForm({ title: "", description: "", dueAt: "", maxMarks: "" });
      setAssignmentFile(null);
      setShowAssignmentModal(false);
      await subjectQuery.refetch();
      await sectionQuery.refetch();
    } catch (err: any) {
      setAssignmentError(err?.response?.data?.message ?? "Failed to create assignment.");
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleCreateNote = async () => {
    setNoteError(null);
    if (!selected?.classId || !selected?.subjectId) {
      setNoteError("Please select a subject.");
      return;
    }
    if (!noteForm.title.trim()) {
      setNoteError("Title is required.");
      return;
    }
    setNoteSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      if (noteFile) {
        const uploadRes = await uploadFile({
          file: toUploadFile(noteFile),
          userType: "teacher",
          userId: user?.id ?? "shared",
          module: "notes",
        });
        fileUrl = uploadRes?.fileUrl ?? null;
        fileType = noteFile.mimeType ?? null;
      }
      await createClassroomNote({
        classId: selected.classId,
        sectionId: selected.sectionId ?? null,
        subjectId: selected.subjectId ?? "",
        title: noteForm.title,
        description: noteForm.description || undefined,
        fileUrl,
        fileType,
      });
      setNoteForm({ title: "", description: "" });
      setNoteFile(null);
      setShowNoteModal(false);
      await subjectQuery.refetch();
      await sectionQuery.refetch();
    } catch (err: any) {
      setNoteError(err?.response?.data?.message ?? "Failed to create notes.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    setAnnouncementError(null);
    if (!selected?.classId) {
      setAnnouncementError("Please select a class.");
      return;
    }
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setAnnouncementError("Title and announcement are required.");
      return;
    }
    setAnnouncementSaving(true);
    try {
      await createClassroomAnnouncement({
        classId: selected.classId,
        sectionId: selected.sectionId ?? null,
        title: announcementForm.title,
        content: announcementForm.content,
      });
      setAnnouncementForm({ title: "", content: "" });
      setShowAnnouncementModal(false);
      await subjectQuery.refetch();
      await sectionQuery.refetch();
    } catch (err: any) {
      setAnnouncementError(err?.response?.data?.message ?? "Failed to create announcement.");
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleViewSubmissions = async (assignment: any) => {
    setSubmissionsError(null);
    setSubmissionsLoading(true);
    setSelectedAssignment(assignment);
    try {
      const payload = await getAssignmentSubmissions(assignment.id, { page: 1, limit: 200 });
      const items = payload?.items ?? payload ?? [];
      setSubmissions(Array.isArray(items) ? items : []);
      setSubmissionsOpen(true);
    } catch (err: any) {
      setSubmissionsError(err?.response?.data?.message ?? "Failed to load submissions.");
      setSubmissionsOpen(true);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current;
    const tokens = getAuthTokens();
    const socket = io(API_ORIGIN, {
      transports: ["websocket"],
      auth: { token: tokens.accessToken },
    });
    socketRef.current = socket;
    return socket;
  };

  const openGroupChat = async () => {
    const roomId = subjectQuery.data?.chatRoomId;
    if (!roomId) return;
    setChatOpen(true);
    setChatError(null);
    try {
      const payload = await getClassroomChatRoomMessages(roomId, { limit: 50 });
      setChatMessages(payload?.messages ?? []);
    } catch (err: any) {
      setChatError(err?.response?.data?.message ?? "Unable to load chat.");
    }
    const socket = ensureSocket();
    socket.emit("join_room", roomId);
    socket.off("receive_message");
    socket.on("receive_message", (msg: any) => {
      setChatMessages((prev) => [...prev, msg]);
    });
  };

  const handleSendChat = () => {
    const roomId = subjectQuery.data?.chatRoomId;
    if (!roomId || !chatText.trim()) return;
    const socket = ensureSocket();
    socket.emit("send_message", { roomId, message: chatText.trim(), clientId: `${Date.now()}` });
    setChatText("");
  };

  const closeChat = () => {
    setChatOpen(false);
  };

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading classroom">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Classroom" subtitle="Manage classes and share classwork updates" />
      {query.error ? <ErrorState message="Unable to load classroom." /> : null}

      <Card title="Classroom" subtitle="Assignments & resources">
        {cards.length ? (
          <View style={styles.list}>
            {cards.map((item: TeacherClassroomItem, index: number) => {
              const isActive =
                selected?.sectionId === item.sectionId &&
                selected?.classSubjectId === item.classSubjectId &&
                selected?.kind === item.kind;
              return (
                <Pressable
                  key={`${item.kind}-${item.classSubjectId ?? "section"}-${item.sectionId ?? index}`}
                  style={[styles.listItem, isActive && styles.listItemActive]}
                  onPress={() => setSelected(item)}
                >
                  <LinearGradient
                    colors={["#3b82f6", "#0ea5e9", "#4f46e5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.listHero}
                  >
                    <Text style={styles.listTitle}>
                      {item.className ?? "Class"} {item.subjectName ? `- ${item.subjectName}` : ""}
                    </Text>
                    <Text style={styles.listSubtitle}>{item.sectionName ?? "All Sections"}</Text>
                  </LinearGradient>
                  <View style={styles.listFooter}>
                    <Text style={styles.listFooterText}>{teacherName}</Text>
                    <StatusBadge
                      variant={item.kind === "classTeacher" ? "info" : "neutral"}
                      label={item.kind === "classTeacher" ? "Class Teacher" : "Subject"}
                      dot={false}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState title="No classroom assignments found yet" subtitle="Please ask the admin to map your subject or class." />
        )}
      </Card>

      {selected ? (
        <View style={styles.detailWrap}>
          <View style={styles.detailHero}>
            <LinearGradient
              colors={["#3b82f6", "#0ea5e9", "#4f46e5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHeroBg}
            >
              <Text style={styles.detailTitle}>
                {selected.className ?? "Class"} {selected.sectionName ? `• ${selected.sectionName}` : ""}
              </Text>
              <Text style={styles.detailSubtitle}>
                {selected.subjectName ?? "Classroom"} {selected.kind === "classTeacher" ? "• Class Teacher" : ""}
              </Text>
              <Text style={styles.detailTeacher}>{teacherName}</Text>
              {selected.kind === "subject" && subjectQuery.data?.chatRoomId ? (
                <View style={styles.heroActionRow}>
                  <Button title="Open Group Chat" variant="secondary" onPress={openGroupChat} />
                </View>
              ) : null}
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {[
              { key: "stream", label: "Stream" },
              { key: "classwork", label: "Classwork" },
              { key: "people", label: "People" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as "stream" | "classwork" | "people")}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {sectionQuery.isLoading || subjectQuery.isLoading ? <LoadingState /> : null}
          {sectionQuery.error || subjectQuery.error ? (
            <ErrorState message="Unable to load classroom details." />
          ) : null}

          {activeTab === "stream" ? (
            <View style={styles.streamList}>
              <View style={styles.streamHeader}>
                <Text style={styles.sectionTitle}>Stream</Text>
                <View style={styles.streamActions}>
                  {selected.kind === "subject" && subjectQuery.data?.chatRoomId ? (
                    <Button title="Open Group Chat" variant="secondary" onPress={openGroupChat} />
                  ) : null}
                  <Button title="+ Announcement" variant="secondary" onPress={() => setShowAnnouncementModal(true)} />
                </View>
              </View>
              {streamItems.length ? (
                streamItems.map((item) => (
                  <View key={`${item.type}-${item.id}`} style={styles.streamCard}>
                    <Text style={styles.streamType}>
                      {item.type === "assignment" ? "Assignment" : item.type === "note" ? "Note" : "Announcement"}
                    </Text>
                    <Text style={styles.streamTitle}>{item.title ?? "Untitled"}</Text>
                    {item.subjectName ? <Text style={styles.streamMeta}>{item.subjectName}</Text> : null}
                    {item.description ? <Text style={styles.streamBody}>{item.description}</Text> : null}
                    {item.type === "assignment" && item.attachments?.length ? (
                      <View style={styles.attachmentRow}>
                        {item.attachments.map((file: any, idx: number) => (
                          <Button
                            key={`${file.fileUrl ?? file}-${idx}`}
                            title={file.fileName ?? "Attachment"}
                            variant="secondary"
                            onPress={() => Linking.openURL(resolvePublicUrl(file.fileUrl ?? file))}
                          />
                        ))}
                      </View>
                    ) : null}
                    {item.type === "note" && item.fileUrl ? (
                      <Button
                        title="Open Attachment"
                        variant="secondary"
                        onPress={() => Linking.openURL(resolvePublicUrl(item.fileUrl))}
                      />
                    ) : null}
                    <View style={styles.streamFooter}>
                      <Text style={styles.streamMeta}>
                        {item.createdAt ? formatDateTime(item.createdAt) : "Just now"}
                      </Text>
                      {item.dueAt ? (
                        <Text style={styles.streamMeta}>Due {formatDateTime(item.dueAt)}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState title="No stream updates yet" subtitle="Announcements, assignments, and notes will appear here." />
              )}
            </View>
          ) : null}

          {activeTab === "classwork" ? (
            <View style={styles.classworkWrap}>
              <View style={styles.classworkHeader}>
                <View style={styles.classworkActions}>
                  <Button title="+ Assignment" onPress={() => setShowAssignmentModal(true)} />
                  <Button title="+ Notes" variant="secondary" onPress={() => setShowNoteModal(true)} />
                  <Button title="+ Announcement" variant="secondary" onPress={() => setShowAnnouncementModal(true)} />
                </View>
                <Text style={styles.helperText}>
                  Use the buttons above to create assignments, notes, or announcements.
                </Text>
              </View>
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Assignments</Text>
                {classwork.assignments.length ? (
                  classwork.assignments.map((assignment: any) => (
                    <View key={assignment.id} style={styles.classworkCard}>
                      <Text style={styles.classworkTitle}>{assignment.title ?? "Assignment"}</Text>
                      {assignment.description ? (
                        <Text style={styles.classworkBody}>{assignment.description}</Text>
                      ) : null}
                      {assignment.dueAt ? (
                        <Text style={styles.classworkMeta}>Due {formatDateTime(assignment.dueAt)}</Text>
                      ) : null}
                      {sectionQuery.data?.students?.length ? (
                        <View style={styles.countRow}>
                          <Text style={styles.classworkMeta}>
                            Submitted: {assignment._count?.submissions ?? 0}
                          </Text>
                          <Text style={styles.classworkMeta}>
                            Pending:{" "}
                            {Math.max(
                              0,
                              (sectionQuery.data?.students?.length ?? 0) -
                              (assignment._count?.submissions ?? 0)
                            )}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.alignRight}>
                        <Button title="View Submissions" variant="secondary" onPress={() => handleViewSubmissions(assignment)} />
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState title="No assignments yet" subtitle="Assignments will appear here." />
                )}
              </View>
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {classwork.notes.length ? (
                  classwork.notes.map((note: any) => (
                    <View key={note.id} style={styles.classworkCard}>
                      <Text style={styles.classworkTitle}>{note.title ?? "Note"}</Text>
                      {note.description ? (
                        <Text style={styles.classworkBody}>{note.description}</Text>
                      ) : null}
                      {note.createdAt ? (
                        <Text style={styles.classworkMeta}>{formatDateTime(note.createdAt)}</Text>
                      ) : null}
                      {note.fileUrl ? (
                        <Button
                          title="Open Attachment"
                          variant="secondary"
                          onPress={() => Linking.openURL(resolvePublicUrl(note.fileUrl))}
                        />
                      ) : null}
                    </View>
                  ))
                ) : (
                  <EmptyState title="No notes yet" subtitle="Notes will appear here." />
                )}
              </View>
            </View>
          ) : null}

          {activeTab === "people" ? (
            <View style={styles.peopleWrap}>
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Teachers</Text>
                {people.teachers.length ? (
                  people.teachers.map((teacher: any) => (
                    <View key={teacher.id ?? teacher.email} style={styles.peopleCard}>
                      <View style={styles.avatarStub}>
                        <Text style={styles.avatarText}>
                          {(teacher.fullName ?? "T").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.peopleInfo}>
                        <Text style={styles.peopleName}>{teacher.fullName ?? "Teacher"}</Text>
                        {teacher.email ? <Text style={styles.peopleMeta}>{teacher.email}</Text> : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState title="No teachers mapped yet" subtitle="Teachers will appear here." />
                )}
              </View>
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Students</Text>
                {people.students.length ? (
                  people.students.map((student: any) => (
                    <View key={student.id ?? student.studentId} style={styles.peopleCard}>
                      <View style={styles.avatarStub}>
                        <Text style={styles.avatarText}>
                          {(student.fullName ?? "S").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.peopleInfo}>
                        <Text style={styles.peopleName}>{student.fullName ?? "Student"}</Text>
                        {student.rollNumber ? (
                          <Text style={styles.peopleMeta}>Roll {student.rollNumber}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState title="No students mapped yet" subtitle="Students will appear here." />
                )}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal visible={showAssignmentModal} transparent animationType="fade" onRequestClose={() => setShowAssignmentModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Assignment</Text>
            <Input label="Title" value={assignmentForm.title} onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, title: value }))} />
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalTextarea}
              multiline
              value={assignmentForm.description}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, description: value }))}
              placeholder="Assignment details"
            />
            <Input
              label="Deadline (YYYY-MM-DD)"
              value={assignmentForm.dueAt}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, dueAt: value }))}
            />
            <Input
              label="Max Marks"
              value={assignmentForm.maxMarks}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, maxMarks: value }))}
              keyboardType="numeric"
            />
            <View style={styles.fileRow}>
              <Button title={assignmentFile?.name ?? "Attach File"} variant="secondary" onPress={handlePickAssignmentFile} />
              {assignmentFile ? <Button title="Remove" variant="ghost" onPress={() => setAssignmentFile(null)} /> : null}
            </View>
            {assignmentError ? <Text style={styles.errorText}>{assignmentError}</Text> : null}
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowAssignmentModal(false)} />
              <Button title={assignmentSaving ? "Saving..." : "Create"} onPress={handleCreateAssignment} loading={assignmentSaving} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNoteModal} transparent animationType="fade" onRequestClose={() => setShowNoteModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Notes</Text>
            <Input label="Title" value={noteForm.title} onChangeText={(value) => setNoteForm((prev) => ({ ...prev, title: value }))} />
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalTextarea}
              multiline
              value={noteForm.description}
              onChangeText={(value) => setNoteForm((prev) => ({ ...prev, description: value }))}
              placeholder="Notes summary"
            />
            <View style={styles.fileRow}>
              <Button title={noteFile?.name ?? "Attach File"} variant="secondary" onPress={handlePickNoteFile} />
              {noteFile ? <Button title="Remove" variant="ghost" onPress={() => setNoteFile(null)} /> : null}
            </View>
            {noteError ? <Text style={styles.errorText}>{noteError}</Text> : null}
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowNoteModal(false)} />
              <Button title={noteSaving ? "Saving..." : "Create"} onPress={handleCreateNote} loading={noteSaving} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAnnouncementModal} transparent animationType="fade" onRequestClose={() => setShowAnnouncementModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <Input
              label="Title"
              value={announcementForm.title}
              onChangeText={(value) => setAnnouncementForm((prev) => ({ ...prev, title: value }))}
            />
            <Text style={styles.modalLabel}>Announcement</Text>
            <TextInput
              style={styles.modalTextarea}
              multiline
              value={announcementForm.content}
              onChangeText={(value) => setAnnouncementForm((prev) => ({ ...prev, content: value }))}
              placeholder="Write announcement"
            />
            {announcementError ? <Text style={styles.errorText}>{announcementError}</Text> : null}
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowAnnouncementModal(false)} />
              <Button title={announcementSaving ? "Saving..." : "Create"} onPress={handleCreateAnnouncement} loading={announcementSaving} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={submissionsOpen} transparent animationType="fade" onRequestClose={() => setSubmissionsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submissions</Text>
            {submissionsLoading ? <LoadingState /> : null}
            {submissionsError ? <Text style={styles.errorText}>{submissionsError}</Text> : null}
            {selectedAssignment ? (
              <Text style={styles.modalSubtitle}>{selectedAssignment.title ?? "Assignment"}</Text>
            ) : null}
            {submissions.length ? (
              <View style={styles.submissionList}>
                {submissions.map((submission: any) => (
                  <View key={submission.id} style={styles.submissionRow}>
                    <Text style={styles.submissionName}>{submission.student?.fullName ?? "Student"}</Text>
                    <Text style={styles.submissionMeta}>
                      {submission.submittedAt ? formatDateTime(submission.submittedAt) : "Submitted"}
                    </Text>
                    {submission.submissionUrl ? (
                      <Button
                        title="Open"
                        variant="secondary"
                        onPress={() => Linking.openURL(resolvePublicUrl(submission.submissionUrl))}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No submissions yet" subtitle="Submissions will appear here." />
            )}
            <View style={styles.modalActions}>
              <Button title="Close" variant="ghost" onPress={() => setSubmissionsOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={chatOpen} transparent animationType="fade" onRequestClose={closeChat}>
        <View style={styles.modalBackdrop}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.modalTitle}>Classroom Group Chat</Text>
              <Button title="Close" variant="ghost" onPress={closeChat} />
            </View>
            <View style={styles.chatMetaBlock}>
              <Text style={styles.chatMetaText}>{subjectQuery.data?.subjectName ?? "Subject"}</Text>
              <Text style={styles.chatMetaText}>
                {subjectQuery.data?.className ?? "Class"} {subjectQuery.data?.sectionName ? `• ${subjectQuery.data.sectionName}` : ""}
              </Text>
              <Text style={styles.chatMetaText}>{teacherName}</Text>
            </View>
            {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
            <ScrollView style={styles.chatList}>
              {chatMessages.map((msg: any) => {
                const isMine = msg.senderId === user?.id;
                const rawSenderName = typeof msg.senderName === "string" ? msg.senderName : null;
                const senderName = isMine ? "You" : rawSenderName ?? "User";
                const senderLabel = msg.senderRole === "TEACHER" ? `${senderName} (teacher)` : senderName;
                return (
                <View key={msg.id ?? msg.clientId} style={styles.chatBubble}>
                  <Text style={styles.chatAuthor}>{senderLabel}</Text>
                  <Text style={styles.chatText}>{msg.message ?? msg.messageText ?? ""}</Text>
                  <Text style={styles.chatMeta}>{msg.createdAt ? formatDateTime(msg.createdAt) : ""}</Text>
                </View>
              );
              })}
            </ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                value={chatText}
                onChangeText={setChatText}
              />
              <Button title="Send" onPress={handleSendChat} />
            </View>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  listItemActive: {
    borderColor: colors.sky[300],
    backgroundColor: colors.sky[50],
  },
  listHero: {
    padding: 14,
    gap: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
    fontFamily: typography.fontDisplay,
  },
  listSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontFamily: typography.fontBody,
  },
  listFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listFooterText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  detailWrap: {
    gap: 14,
  },
  detailHero: {
    borderRadius: 18,
    overflow: "hidden",
  },
  detailHeroBg: {
    padding: 16,
    gap: 6,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
    fontFamily: typography.fontDisplay,
  },
  detailSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontFamily: typography.fontBody,
  },
  detailTeacher: {
    fontSize: 12,
    color: "rgba(255,255,255,0.95)",
    fontFamily: typography.fontBody,
    fontWeight: "600",
    marginTop: 4,
  },
  heroActionRow: {
    marginTop: 10,
    alignItems: "flex-start",
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
  },
  tabActive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink[100],
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  tabTextActive: {
    color: colors.ink[800],
  },
  streamList: {
    gap: 12,
  },
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  streamActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  streamCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 14,
    gap: 6,
  },
  streamType: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink[400],
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  streamBody: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  streamMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  streamFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  attachmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  classworkWrap: {
    gap: 16,
  },
  classworkHeader: {
    gap: 8,
  },
  classworkActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  classworkCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 12,
    gap: 4,
  },
  classworkTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  classworkBody: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  classworkMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  alignRight: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  peopleWrap: {
    gap: 16,
  },
  peopleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 12,
  },
  avatarStub: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink[900],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    color: colors.white,
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  peopleInfo: {
    gap: 2,
  },
  peopleName: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  peopleMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  modalTextarea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  fileRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  submissionList: {
    gap: 10,
    marginTop: 8,
  },
  submissionRow: {
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  submissionName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  submissionMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  chatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chatMetaBlock: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    gap: 2,
  },
  chatMetaText: {
    fontSize: 11,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  chatList: {
    flex: 1,
  },
  chatBubble: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    padding: 10,
    gap: 4,
    marginBottom: 8,
  },
  chatAuthor: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  chatText: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  chatMeta: {
    fontSize: 10,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  errorText: {
    fontSize: 12,
    color: colors.rose[500],
    fontFamily: typography.fontBody,
  },
});
