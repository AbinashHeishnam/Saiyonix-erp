import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import type { Socket } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import {
  getClassroomChatRoomMessages,
  getStudentClassroom,
  getSubjectClassroom,
  submitAssignment,
  uploadFile,
} from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import StudentSelector from "../../components/StudentSelector";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import { disconnectSocket, ensureSocketConnected, getSocket } from "../../services/socket";
import { openFileUrl, toUploadFile } from "../../utils/files";

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

function renderChatTextParts(text?: string | null) {
  if (!text) return null;
  const parts = text.split(/(@teacher|@all)/gi);
  return parts.map((part, index) => {
    if (part.toLowerCase() === "@teacher" || part.toLowerCase() === "@all") {
      return (
        <Text key={`${part}-${index}`} style={styles.chatMention}>
          {part}
        </Text>
      );
    }
    return <Text key={`${part}-${index}`}>{part}</Text>;
  });
}

export default function StudentParentClassroomScreen() {
  const { role, user } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const socketRef = useRef<Socket | null>(null);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const chatRoomIdRef = useRef<string | null>(null);
  const chatRefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!socketRef.current) {
    socketRef.current = getSocket();
  }

  const [selected, setSelected] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"stream" | "assignments" | "notes">("stream");
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submissionFile, setSubmissionFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatFile, setChatFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [chatUploading, setChatUploading] = useState(false);

  const query = useQuery({
    queryKey: ["classroom", "student", activeStudentId, role],
    queryFn: () => getStudentClassroom(role === "PARENT" ? activeStudentId ?? undefined : undefined),
    enabled: role !== "PARENT" || Boolean(activeStudentId),
  });

  const items = useMemo(() => {
    const payload = query.data ?? [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.subjects)) return payload.subjects;
    return [] as any[];
  }, [query.data]);

  useEffect(() => {
    if (!selected && items.length) {
      setSelected(items[0]);
    }
  }, [items, selected]);

  useEffect(() => {
    setSelected(null);
  }, [activeStudentId]);

  useEffect(() => {
    return () => {
      if (chatRefetchTimeoutRef.current) {
        clearTimeout(chatRefetchTimeoutRef.current);
        chatRefetchTimeoutRef.current = null;
      }
      disconnectSocket();
    };
  }, []);

  const subjectQuery = useQuery({
    queryKey: ["classroom", "subject", selected?.classSubjectId, activeStudentId],
    queryFn: () => getSubjectClassroom(selected?.classSubjectId ?? "", role === "PARENT" ? activeStudentId ?? undefined : undefined),
    enabled: Boolean(selected?.classSubjectId),
  });

  const subjectDetail = subjectQuery.data ?? null;
  const announcements = subjectDetail?.announcements ?? [];
  const notesRaw = subjectDetail?.notes ?? [];
  const assignments = subjectDetail?.assignments ?? [];

  const notes = useMemo(() => {
    return (Array.isArray(notesRaw) ? notesRaw : []).map((note: any) => {
      const existing = Array.isArray(note?.attachments) ? note.attachments : [];
      const fileUrl = typeof note?.fileUrl === "string" ? note.fileUrl : null;
      const attachments = fileUrl ? [...existing, { fileUrl, fileName: getFileName(fileUrl) }] : existing;
      return { ...note, attachments };
    });
  }, [notesRaw]);

  const streamItems = useMemo(() => {
    const mappedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      type: "assignment",
      title: assignment.title,
      description: assignment.description,
      createdAt: assignment.createdAt ?? assignment.dueAt ?? null,
      dueAt: assignment.dueAt ?? null,
      attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
      submissionStatus: assignment.submissionStatus ?? null,
    }));
    const mappedNotes = notes.map((note: any) => ({
      id: note.id,
      type: "note",
      title: note.title,
      description: note.description,
      createdAt: note.createdAt ?? null,
      attachments: Array.isArray(note.attachments) ? note.attachments : [],
      fileUrl: typeof note.fileUrl === "string" ? note.fileUrl : null,
    }));
    const mappedAnnouncements = announcements.map((announcement: any) => ({
      id: announcement.id,
      type: "announcement",
      title: announcement.title,
      description: announcement.content,
      createdAt: announcement.createdAt ?? null,
      attachments: Array.isArray(announcement.attachments) ? announcement.attachments : [],
    }));
    return [...mappedAnnouncements, ...mappedAssignments, ...mappedNotes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [assignments, notes, announcements]);

  const handleReceiveMessage = useCallback((msg: any) => {
    if (chatRoomIdRef.current && msg?.roomId && msg.roomId !== chatRoomIdRef.current) return;
    setChatMessages((prev) => {
      if (prev.some((item) => item?.id && item.id === msg?.id)) return prev;
      const clientId = msg?.clientId;
      if (clientId) {
        const idx = prev.findIndex((item) => item?.clientId === clientId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = msg;
          return next;
        }
      }
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    const socket = socketRef.current ?? getSocket();
    socket.off("receive_message", handleReceiveMessage);
    socket.on("receive_message", handleReceiveMessage);
    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [handleReceiveMessage, socketEpoch]);

  const openChat = async () => {
    const roomId = subjectDetail?.chatRoomId ?? subjectDetail?.chatRoom?.id;
    if (!roomId) {
      console.log("[SOCKET ERROR] Missing roomId");
      setChatError("Chat room not available yet.");
      setChatOpen(true);
      return;
    }
    setChatError(null);
    setChatOpen(true);
    setChatText("");
    setChatFile(null);
    chatRoomIdRef.current = roomId;
    try {
      const payload = await getClassroomChatRoomMessages(roomId, { limit: 50 });
      setChatMessages(payload?.messages ?? payload ?? []);
    } catch (err: any) {
      setChatError(err?.response?.data?.message ?? "Unable to load chat.");
    }
    try {
      try {
        const connected = await ensureSocketConnected();
        if (socketRef.current !== connected) {
          socketRef.current = connected;
          setSocketEpoch((prev) => prev + 1);
        }
      } catch (err) {
        console.log("[SOCKET CONNECT FAILED]", err);
        setChatError("Unable to connect to chat.");
        return;
      }
      socketRef.current?.emit("join_room", roomId);
    } catch (err: any) {
      setChatError(err?.message ?? "Unable to connect to chat.");
    }
  };

  const handlePickChatFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    setChatFile(result.assets?.[0] ?? null);
  };

  const handleSendChat = async () => {
    const roomId = subjectDetail?.chatRoomId ?? subjectDetail?.chatRoom?.id;
    if (!roomId) {
      console.log("[SOCKET ERROR] Missing roomId");
      return;
    }
    const msg = chatText.trim();
    if (!msg && !chatFile) return;
    if (chatSending || chatUploading) return;
    const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic = {
      id: clientId,
      clientId,
      roomId,
      senderId: user?.id ?? "me",
      senderRole: role ?? "USER",
      senderName: "You",
      message: msg || null,
      fileUrl: chatFile ? "uploading" : null,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimistic]);
    setChatSending(true);
    try {
      try {
        const connected = await ensureSocketConnected();
        if (socketRef.current !== connected) {
          socketRef.current = connected;
          setSocketEpoch((prev) => prev + 1);
        }
      } catch (err) {
        console.log("[SOCKET CONNECT FAILED]", err);
        setChatError("Unable to connect to chat.");
        return;
      }
      socketRef.current?.emit("join_room", roomId);
      let fileUrl: string | null = null;
      if (chatFile) {
        setChatUploading(true);
        try {
          const upload = await uploadFile({
            file: toUploadFile(chatFile),
            userType: role === "PARENT" ? "parent" : "student",
            userId: user?.id ?? undefined,
            module: "chat",
          });
          fileUrl = upload?.fileUrl ?? upload?.url ?? upload?.path ?? null;
          if (!fileUrl) {
            throw new Error("File upload failed.");
          }
        } catch (err: any) {
          setChatError(err?.response?.data?.message ?? err?.message ?? "File upload failed.");
          return;
        } finally {
          setChatUploading(false);
        }
      }

      socketRef.current?.emit("send_message", { roomId, message: msg || null, fileUrl, replyToId: null, clientId });
      setChatText("");
      setChatFile(null);

      if (chatRefetchTimeoutRef.current) {
        clearTimeout(chatRefetchTimeoutRef.current);
      }
      chatRefetchTimeoutRef.current = setTimeout(() => {
        void (async () => {
          try {
            const payload = await getClassroomChatRoomMessages(roomId, { limit: 50 });
            setChatMessages(payload?.messages ?? payload ?? []);
          } catch (err: any) {
            console.log("[CHAT REFRESH ERROR]", err);
          }
        })();
      }, 1000);
    } finally {
      setChatSending(false);
    }
  };

  const handleOpenFile = async (url?: string | null) => {
    if (!url) return;
    await openFileUrl(url);
  };

  const handlePickSubmission = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    setSubmissionFile(result.assets?.[0] ?? null);
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !submissionFile) {
      setSubmissionError("Please attach your assignment file.");
      return;
    }
    setSubmissionError(null);
    setSubmissionSaving(true);
    try {
      const upload = await uploadFile({
        file: toUploadFile(submissionFile),
        userType: "student",
        userId: user?.id ?? undefined,
        module: "assignment-submissions",
      });
      const fileUrl = upload?.fileUrl ?? upload?.url ?? upload?.path;
      if (!fileUrl) {
        throw new Error("Upload failed. Please try again.");
      }
      await submitAssignment({
        assignmentId: selectedAssignment.id,
        submissionUrl: fileUrl,
        studentId: role === "PARENT" ? activeStudentId ?? undefined : undefined,
      });
      setSubmissionFile(null);
      setSubmissionOpen(false);
      await subjectQuery.refetch();
    } catch (err: any) {
      setSubmissionError(err?.response?.data?.message ?? err?.message ?? "Failed to submit assignment.");
    } finally {
      setSubmissionSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Classroom" subtitle="Assignments, notes, and announcements" />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to view classroom">
          <StudentSelector students={parentStudents} activeId={activeStudentId} onSelect={setActiveStudentId} />
        </Card>
      ) : null}

      {query.isLoading ? <LoadingState label="Loading classroom" /> : null}
      {query.error ? <ErrorState message="Unable to load classroom." /> : null}

      <Card title="Subjects" subtitle="Select a class subject">
        {items.length ? (
          <View style={styles.subjectList}>
            {items.map((item: any, index: number) => {
              const isActive = selected?.classSubjectId === item.classSubjectId;
              return (
                <Pressable key={`${item.classSubjectId ?? item.subjectId ?? item.subjectName ?? index}`} onPress={() => setSelected(item)}>
                  {({ pressed }) => (
                    <LinearGradient
                      colors={isActive ? ["#0ea5e9", "#2563eb"] : ["#f8fafc", "#f1f5f9"]}
                      style={[styles.subjectCard, isActive && styles.subjectCardActive, pressed && styles.pressedCard]}
                    >
                      <Text style={[styles.subjectTitle, isActive && styles.subjectTitleActive]}>
                        {item.subjectName ?? "Subject"}
                      </Text>
                      <Text style={[styles.subjectMeta, isActive && styles.subjectMetaActive]}>
                        {item.className ?? "Class"} {item.sectionName ?? ""}
                      </Text>
                      {item.teacherName ? (
                        <Text style={[styles.subjectMeta, isActive && styles.subjectMetaActive]}>
                          {item.teacherName}
                        </Text>
                      ) : null}
                    </LinearGradient>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState title="No classroom mapped" subtitle="Ask the school to map your subjects." />
        )}
      </Card>

      {selected ? (
        <Card title="Classroom Stream" subtitle={selected.subjectName ?? "Updates"}>
          <View style={styles.tabRow}>
            {(["stream", "assignments", "notes"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "stream" ? "Stream" : tab === "assignments" ? "Assignments" : "Notes"}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={openChat} style={styles.chatButton}>
              <Text style={styles.chatButtonText}>Open Chat</Text>
            </Pressable>
          </View>

          {subjectQuery.isLoading ? (
            <LoadingState label="Loading classroom updates" />
          ) : subjectQuery.error ? (
            <Text style={styles.meta}>Unable to load classroom details.</Text>
          ) : activeTab === "stream" ? (
            streamItems.length ? (
              <View style={styles.streamList}>
                {streamItems.map((item: any) => (
                  <View key={`${item.type}-${item.id}`} style={styles.streamCard}>
                    <View style={styles.streamHeader}>
                      <Text style={styles.streamTitle}>{item.title ?? "Untitled"}</Text>
                      <StatusBadge
                        variant={item.type === "assignment" ? "warning" : item.type === "note" ? "info" : "neutral"}
                        label={item.type}
                        dot={false}
                      />
                    </View>
                    {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
                    {item.dueAt ? <Text style={styles.meta}>Due: {new Date(item.dueAt).toLocaleString()}</Text> : null}
                    {item.submissionStatus ? (
                      <Text style={styles.meta}>Submission: {item.submissionStatus}</Text>
                    ) : null}
                    {Array.isArray(item.attachments) && item.attachments.length ? (
                      <View style={styles.attachments}>
                        {item.attachments.map((file: any, idx: number) => (
                          <Pressable
                            key={`${item.id}-${file.fileUrl ?? file}-${idx}`}
                            onPress={() => void openFileUrl(file.fileUrl ?? file)}
                          >
                            {({ pressed }) => (
                              <View style={[styles.attachmentChip, pressed && styles.pressedChip]}>
                                <Text style={styles.attachmentText}>{getFileIcon(file.fileUrl ?? file)} {getFileName(file.fileUrl ?? file) ?? "Attachment"}</Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No updates" subtitle="Classroom updates will appear here." />
            )
          ) : activeTab === "assignments" ? (
            assignments.length ? (
              <View style={styles.streamList}>
                {assignments.map((assignment: any) => (
                  <View key={assignment.id} style={styles.streamCard}>
                    <Text style={styles.streamTitle}>{assignment.title ?? "Assignment"}</Text>
                    {assignment.description ? <Text style={styles.meta}>{assignment.description}</Text> : null}
                    <Text style={styles.meta}>Due: {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "—"}</Text>
                    {assignment.submissionStatus ? (
                      <Text style={styles.meta}>Submission: {assignment.submissionStatus}</Text>
                    ) : null}
                    {Array.isArray(assignment.attachments) && assignment.attachments.length ? (
                      <View style={styles.attachments}>
                        {assignment.attachments.map((file: any, idx: number) => (
                          <Pressable
                            key={`${assignment.id}-${file.fileUrl ?? file}-${idx}`}
                            onPress={() => void openFileUrl(file.fileUrl ?? file)}
                          >
                            {({ pressed }) => (
                              <View style={[styles.attachmentChip, pressed && styles.pressedChip]}>
                                <Text style={styles.attachmentText}>{getFileIcon(file.fileUrl ?? file)} {getFileName(file.fileUrl ?? file) ?? "Attachment"}</Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <Button
                      title="Submit Assignment"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setSelectedAssignment(assignment);
                        setSubmissionOpen(true);
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No assignments" subtitle="Assignments will appear here." />
            )
          ) : notes.length ? (
            <View style={styles.streamList}>
              {notes.map((note: any) => (
                <Pressable key={note.id} onPress={() => setSelectedNote(note)}>
                  {({ pressed }) => (
                    <View style={[styles.streamCard, pressed && styles.pressedCard]}>
                      <Text style={styles.streamTitle}>{note.title ?? "Note"}</Text>
                      {note.description ? <Text style={styles.meta}>{note.description}</Text> : null}
                      {Array.isArray(note.attachments) && note.attachments.length ? (
                        <View style={styles.attachments}>
                          {note.attachments.map((file: any, idx: number) => (
                            <Pressable
                              key={`${note.id}-${file.fileUrl ?? file}-${idx}`}
                              onPress={() => void openFileUrl(file.fileUrl ?? file)}
                            >
                              {({ pressed: attachmentPressed }) => (
                                <View style={[styles.attachmentChip, attachmentPressed && styles.pressedChip]}>
                                  <Text style={styles.attachmentText}>{getFileIcon(file.fileUrl ?? file)} {getFileName(file.fileUrl ?? file) ?? "Attachment"}</Text>
                                </View>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState title="No notes" subtitle="Notes will appear here." />
          )}
        </Card>
      ) : null}

      <Modal visible={submissionOpen} transparent animationType="fade" onRequestClose={() => setSubmissionOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Assignment</Text>
            <Text style={styles.meta}>{selectedAssignment?.title ?? "Assignment"}</Text>
            <Button title={submissionFile ? "Change File" : "Upload File"} variant="secondary" onPress={handlePickSubmission} />
            {submissionFile ? <Text style={styles.meta}>Selected: {submissionFile.name ?? "File"}</Text> : null}
            {submissionError ? <Text style={styles.errorText}>{submissionError}</Text> : null}
            <Button title={submissionSaving ? "Submitting..." : "Submit"} onPress={handleSubmitAssignment} loading={submissionSaving} />
            <Button title="Close" variant="ghost" onPress={() => setSubmissionOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={chatOpen} transparent animationType="fade" onRequestClose={() => setChatOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.chatModal}>
            <View style={styles.chatHeader}>
              <Text style={styles.modalTitle}>Classroom Chat</Text>
              <Pressable onPress={() => setChatOpen(false)}>
                <Text style={styles.chatClose}>Close</Text>
              </Pressable>
            </View>
            {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
            <ScrollView style={styles.chatList} contentContainerStyle={{ gap: 10 }}>
              {chatMessages.length ? (
                chatMessages.map((msg: any, idx: number) => {
                  const isMine = msg.senderId === user?.id || msg.senderUserId === user?.id;
                  const rawSenderName = typeof msg.senderName === "string" ? msg.senderName : null;
                  const senderName = isMine ? "You" : rawSenderName ?? "User";
                  const senderLabel = msg.senderRole === "TEACHER" ? `${senderName} (teacher)` : senderName;
                  const message = typeof msg.message === "string" ? msg.message : null;
                  const fileUrl = typeof msg.fileUrl === "string" ? msg.fileUrl : null;

                  if (!message && !fileUrl) return null;

                  return (
                    <View key={msg.id || msg.clientId || idx} style={[styles.chatRow, isMine ? styles.chatRowMine : styles.chatRowOther]}>
                      <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                        <Text style={[styles.chatAuthor, isMine ? styles.chatAuthorMine : styles.chatAuthorOther]}>{senderLabel}</Text>
                        {message ? (
                          <Text style={[styles.chatText, isMine ? styles.chatTextMine : styles.chatTextOther]}>
                            {renderChatTextParts(message)}
                          </Text>
                        ) : null}
                        {fileUrl && fileUrl !== "uploading" ? (
                          <Pressable onPress={() => void handleOpenFile(fileUrl)} style={styles.chatAttachmentButton}>
                            <Text style={[styles.chatText, isMine ? styles.chatTextMine : styles.chatTextOther]}>
                              {getFileIcon(fileUrl)} {getFileName(fileUrl) ?? "Attachment"}
                            </Text>
                          </Pressable>
                        ) : null}
                        {fileUrl === "uploading" ? (
                          <Text style={[styles.meta, { marginBottom: 0 }]}>Uploading file...</Text>
                        ) : null}
                        <Text style={styles.chatTime}>{new Date(msg.createdAt ?? msg.sentAt).toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.meta}>No messages yet.</Text>
              )}
            </ScrollView>
            {chatFile ? (
              <View style={styles.chatFileRow}>
                <Text style={styles.meta}>Selected: {chatFile.name ?? "File"}</Text>
                <Pressable onPress={() => setChatFile(null)}>
                  <Text style={styles.chatClose}>✕</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message"
                value={chatText}
                onChangeText={setChatText}
              />
              <Button title="+" size="sm" variant="secondary" onPress={handlePickChatFile} disabled={chatSending || chatUploading} />
              <Button
                title={chatSending || chatUploading ? "Sending..." : "Send"}
                size="sm"
                onPress={() => void handleSendChat()}
                disabled={(chatSending || chatUploading) || (!chatText.trim() && !chatFile)}
                loading={chatSending || chatUploading}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedNote)} transparent animationType="fade" onRequestClose={() => setSelectedNote(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedNote ? (
              <>
                <Text style={styles.modalTitle}>{selectedNote.title ?? "Note"}</Text>
                <Text style={styles.meta}>{selectedNote.description ?? "No description available."}</Text>
                {Array.isArray(selectedNote.attachments) && selectedNote.attachments.length ? (
                  <View style={styles.attachments}>
                    {selectedNote.attachments.map((file: any, idx: number) => (
                      <Pressable
                        key={`${selectedNote.id}-${file.fileUrl ?? file}-${idx}`}
                        onPress={() => void openFileUrl(file.fileUrl ?? file)}
                      >
                        {({ pressed }) => (
                          <View style={[styles.attachmentChip, pressed && styles.pressedChip]}>
                            <Text style={styles.attachmentText}>{getFileIcon(file.fileUrl ?? file)} {getFileName(file.fileUrl ?? file) ?? "Attachment"}</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Button title="Close" variant="ghost" onPress={() => setSelectedNote(null)} />
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
  subjectList: {
    gap: 12,
    marginTop: 12,
  },
  subjectCard: {
    padding: 14,
    borderRadius: 16,
  },
  subjectCardActive: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  subjectTitleActive: {
    color: colors.white,
  },
  subjectMeta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  subjectMetaActive: {
    color: "rgba(255,255,255,0.8)",
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  tabChipActive: {
    borderColor: colors.sky[300],
    backgroundColor: colors.sky[50],
  },
  tabText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  tabTextActive: {
    color: colors.sky[700],
    fontWeight: "700",
  },
  chatButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
  },
  chatButtonText: {
    fontSize: 11,
    color: colors.white,
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  streamList: {
    marginTop: 12,
    gap: 12,
  },
  streamCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    gap: 6,
  },
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streamTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  attachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attachmentChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  pressedCard: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  pressedChip: {
    opacity: 0.72,
  },
  attachmentText: {
    fontSize: 11,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: colors.white,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  errorText: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
  },
  chatModal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: colors.white,
    padding: 16,
    gap: 12,
    maxHeight: "80%",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatClose: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  chatList: {
    flexGrow: 0,
  },
  chatRow: {
    flexDirection: "row",
  },
  chatRowMine: {
    justifyContent: "flex-end",
  },
  chatRowOther: {
    justifyContent: "flex-start",
  },
  chatBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  chatBubbleMine: {
    backgroundColor: colors.ink[900],
  },
  chatBubbleOther: {
    backgroundColor: colors.ink[100],
  },
  chatText: {
    fontSize: 12,
    fontFamily: typography.fontBody,
  },
  chatTextMine: {
    color: colors.white,
  },
  chatTextOther: {
    color: colors.ink[700],
  },
  chatAuthor: {
    fontSize: 10,
    fontFamily: typography.fontBody,
    opacity: 0.85,
  },
  chatAuthorMine: {
    color: colors.white,
  },
  chatAuthorOther: {
    color: colors.ink[700],
  },
  chatTime: {
    fontSize: 9,
    color: colors.ink[400],
    textAlign: "right",
    fontFamily: typography.fontBody,
  },
  chatAttachmentButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  chatMention: {
    color: colors.sky[600],
    fontWeight: "700",
  },
  chatFileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    backgroundColor: colors.white,
  },
});
