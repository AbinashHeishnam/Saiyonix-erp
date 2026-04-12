import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getClassTeacher, getConversation, getUnreadCount, sendMessage } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import { resolvePublicUrl } from "@saiyonix/api";
import { useActiveStudent } from "../../hooks/useActiveStudent";
import StudentSelector from "../../components/StudentSelector";
import { Image } from "react-native";

export default function StudentParentClassTeacherScreen() {
  const { user, role } = useAuth();
  const { activeStudentId, parentStudents, setActiveStudentId } = useActiveStudent();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const teacherQuery = useQuery({
    queryKey: ["class-teacher", activeStudentId, role],
    queryFn: () => getClassTeacher(role === "PARENT" ? activeStudentId ?? undefined : undefined),
    enabled: role !== "PARENT" || Boolean(activeStudentId),
  });

  const messagesQuery = useQuery({
    queryKey: ["class-teacher", "messages", teacherQuery.data?.userId],
    queryFn: () => getConversation(teacherQuery.data?.userId as string),
    enabled: Boolean(teacherQuery.data?.userId),
  });

  const unreadQuery = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: getUnreadCount,
  });

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const handleSend = async () => {
    if (!teacherQuery.data?.userId || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: teacherQuery.data.userId, message: messageText.trim() });
      setMessageText("");
      await messagesQuery.refetch();
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Class Teacher"
        subtitle="Reach your class teacher directly."
        actions={<Text style={styles.unreadText}>Unread: {unreadQuery.data ?? 0}</Text>}
      />

      {role === "PARENT" && parentStudents.length > 1 ? (
        <Card title="Student" subtitle="Select a child to message">
          <StudentSelector
            students={parentStudents}
            activeId={activeStudentId}
            onSelect={setActiveStudentId}
          />
        </Card>
      ) : null}

      {teacherQuery.isLoading ? <LoadingState label="Loading class teacher" /> : null}
      {teacherQuery.error ? <ErrorState message="Unable to load class teacher." /> : null}

      {!teacherQuery.isLoading && !teacherQuery.data ? (
        <EmptyState title="No class teacher assigned" subtitle="Your class teacher details are not available yet." />
      ) : null}

      {teacherQuery.data ? (
        <>
          <Card title="Teacher Details">
            <View style={styles.teacherRow}>
              <View style={styles.avatar}>
                {teacherQuery.data.photoUrl ? (
                  <Image
                    source={{ uri: resolvePublicUrl(teacherQuery.data.photoUrl) }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>{teacherQuery.data.fullName?.slice(0, 1) ?? "T"}</Text>
                )}
              </View>
              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName}>{teacherQuery.data.fullName ?? "Teacher"}</Text>
                <Text style={styles.teacherMeta}>{teacherQuery.data.email ?? "—"}</Text>
                <Text style={styles.teacherMeta}>{teacherQuery.data.mobile ?? "—"}</Text>
              </View>
            </View>
          </Card>

          <Card title="Chat">
            {messagesQuery.isLoading ? (
              <LoadingState label="Loading messages" />
            ) : messagesQuery.error ? (
              <Text style={styles.meta}>Unable to load conversation.</Text>
            ) : messages.length ? (
              <View style={styles.chatList}>
                {messages.map((msg: any) => {
                  const isMine = msg.senderUserId === user?.id;
                  return (
                    <View key={msg.id} style={[styles.chatRow, isMine ? styles.chatRowMine : styles.chatRowOther]}>
                      <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                        <Text style={[styles.chatText, isMine ? styles.chatTextMine : styles.chatTextOther]}>
                          {msg.messageText}
                        </Text>
                        <Text style={styles.chatTime}>{new Date(msg.sentAt).toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.meta}>No messages yet. Say hello!</Text>
            )}

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type your message..."
                value={messageText}
                onChangeText={setMessageText}
                multiline
              />
              <Button title={sending ? "Sending..." : "Send"} onPress={handleSend} disabled={sending || !messageText.trim()} />
            </View>
          </Card>
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
  unreadText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  teacherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.ink[100],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[600],
    fontFamily: typography.fontDisplay,
  },
  teacherInfo: {
    flex: 1,
    gap: 4,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontBody,
  },
  teacherMeta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  chatList: {
    marginTop: 8,
    gap: 10,
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
    borderRadius: 16,
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
  chatTime: {
    fontSize: 9,
    color: colors.ink[400],
    textAlign: "right",
    fontFamily: typography.fontBody,
  },
  chatInputRow: {
    marginTop: 12,
    gap: 10,
  },
  chatInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    backgroundColor: colors.white,
  },
});
