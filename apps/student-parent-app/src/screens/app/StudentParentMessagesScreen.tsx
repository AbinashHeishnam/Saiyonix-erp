import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getConversation, getTeacherContacts, getTeacherUnreadSummary, getUnreadCount, sendMessage } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, colors, typography } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";

export default function StudentParentMessagesScreen() {
  const { user, role } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const contactsQuery = useQuery({
    queryKey: ["messages", "contacts", role],
    queryFn: getTeacherContacts,
  });
  const unreadCountQuery = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: getUnreadCount,
  });
  const unreadSummaryQuery = useQuery({
    queryKey: ["messages", "unread-summary"],
    queryFn: getTeacherUnreadSummary,
  });

  const contacts = contactsQuery.data ?? [];
  const unreadSummary = unreadSummaryQuery.data ?? [];

  useEffect(() => {
    if (!selectedContactId && contacts.length) {
      setSelectedContactId(contacts[0].userId);
    }
  }, [contacts, selectedContactId]);

  const selectedContact = useMemo(
    () => contacts.find((item: any) => item.userId === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const messagesQuery = useQuery({
    queryKey: ["messages", "conversation", selectedContactId],
    queryFn: () => (selectedContactId ? getConversation(selectedContactId) : Promise.resolve([])),
    enabled: Boolean(selectedContactId),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      contactsQuery.refetch();
      unreadSummaryQuery.refetch();
      if (selectedContactId) {
        messagesQuery.refetch();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [contactsQuery, unreadSummaryQuery, messagesQuery, selectedContactId]);

  const unreadBySender = useMemo(() => {
    const map = new Map<string, any>();
    unreadSummary.forEach((item: any) => map.set(item.senderUserId, item));
    return map;
  }, [unreadSummary]);

  const handleSend = async () => {
    if (!selectedContactId || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: selectedContactId, message: messageText.trim() });
      setMessageText("");
      await messagesQuery.refetch();
    } finally {
      setSending(false);
    }
  };

  const contactOptions = contacts.map((contact: any) => {
    const count = unreadBySender.get(contact.userId)?.count ?? 0;
    return {
      value: contact.userId,
      label: `${contact.name} (${contact.roleType})${count ? ` • ${count} new` : ""}`,
    };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Messages"
        subtitle={role === "PARENT" ? "Chat with teachers and staff" : "Chat with teachers"}
        actions={<Text style={styles.unreadText}>Unread: {unreadCountQuery.data ?? 0}</Text>}
      />

      {contactsQuery.isLoading || unreadSummaryQuery.isLoading ? <LoadingState /> : null}
      {contactsQuery.error || unreadSummaryQuery.error ? <ErrorState message="Unable to load messages." /> : null}

      {contacts.length ? (
        <Card>
          <Select
            label="Select Contact"
            value={selectedContactId}
            onChange={setSelectedContactId}
            options={contactOptions}
            placeholder="Select a contact"
          />
        </Card>
      ) : (
        <Card>
          <EmptyState title="No contacts" subtitle="Contacts appear once messaging is enabled." />
        </Card>
      )}

      <Card title="Chat">
        {!selectedContact ? (
          <Text style={styles.meta}>Select a contact to view messages.</Text>
        ) : messagesQuery.isLoading ? (
          <Text style={styles.meta}>Loading messages...</Text>
        ) : (
          <View style={styles.chatList}>
            {(messagesQuery.data ?? []).length ? (
              (messagesQuery.data as any[]).map((msg) => {
                const isMine = msg.senderUserId === user?.id;
                return (
                  <View key={msg.id} style={[styles.chatBubble, isMine ? styles.chatMine : styles.chatTheirs]}>
                    <Text style={[styles.chatText, isMine ? styles.chatTextMine : styles.chatTextTheirs]}>
                      {msg.messageText}
                    </Text>
                    <View style={styles.chatMetaRow}>
                      <Text style={styles.chatMeta}>{new Date(msg.sentAt).toLocaleString()}</Text>
                      {isMine ? (
                        <Text style={[styles.chatMeta, msg.readAt ? styles.read : styles.unread]}>
                          {msg.readAt ? "vv" : "v"}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.meta}>No messages yet.</Text>
            )}
          </View>
        )}
        {selectedContact ? (
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type your message..."
              value={messageText}
              onChangeText={setMessageText}
            />
            <Button title={sending ? "Sending..." : "Send"} onPress={handleSend} disabled={sending || !messageText.trim()} />
          </View>
        ) : null}
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
  unreadText: {
    fontSize: 12,
    color: colors.ink[600],
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
  chatBubble: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 14,
  },
  chatMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.ink[900],
  },
  chatTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.ink[50],
  },
  chatText: {
    fontSize: 13,
    fontFamily: typography.fontBody,
  },
  chatTextMine: {
    color: colors.white,
  },
  chatTextTheirs: {
    color: colors.ink[800],
  },
  chatMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  chatMeta: {
    fontSize: 9,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  read: {
    color: colors.sky[400],
  },
  unread: {
    color: colors.ink[400],
  },
  chatInputRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
  },
});
