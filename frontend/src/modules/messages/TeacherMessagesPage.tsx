import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import {
  getConversation,
  getTeacherContacts,
  getTeacherUnreadSummary,
  getUnreadCount,
  MessageContact,
  MessageItem,
  sendMessage,
  TeacherUnreadSummary,
} from "../../services/api/messages";

export default function TeacherMessagesPage() {
  const { user } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: contacts, loading, error, refresh: refreshContacts } = useAsync(getTeacherContacts, []);
  const { data: unread } = useAsync(getUnreadCount, []);
  const { data: unreadSummary, refresh: refreshUnreadSummary } = useAsync<TeacherUnreadSummary[]>(getTeacherUnreadSummary, []);

  useEffect(() => {
    if (!selectedContactId && contacts?.length) {
      setSelectedContactId(contacts[0].userId);
    }
  }, [contacts, selectedContactId]);

  const selectedContact = useMemo(
    () => contacts?.find((item) => item.userId === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const {
    data: messages,
    loading: loadingMessages,
    refresh: refreshMessages,
  } = useAsync(async () => {
    if (!selectedContactId) return [];
    return await getConversation(selectedContactId);
  }, [selectedContactId]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshContacts();
      refreshUnreadSummary();
      if (selectedContactId) {
        refreshMessages();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshContacts, refreshUnreadSummary, refreshMessages, selectedContactId]);

  const unreadBySender = useMemo(() => {
    const map = new Map<string, TeacherUnreadSummary>();
    (unreadSummary ?? []).forEach((item) => map.set(item.senderUserId, item));
    return map;
  }, [unreadSummary]);

  const handleSend = async () => {
    if (!selectedContactId || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: selectedContactId, message: messageText.trim() });
      setMessageText("");
      await refreshMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Messages"
        subtitle="Chat with parents and students"
        actions={
          <div className="text-xs font-semibold text-ink-600">
            Unread: {unread ?? 0}
          </div>
        }
      />

      {loading && (
        <Card>
          <p className="text-sm text-ink-500">Loading contacts...</p>
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-sm text-sunrise-600">{error}</p>
        </Card>
      )}

      {contacts && (
        <Card>
          <Select
            label="Select Contact"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
          >
            {contacts.length === 0 && <option value="">No contacts</option>}
            {contacts.map((contact: MessageContact) => (
              <option key={contact.userId} value={contact.userId}>
                {contact.name} ({contact.roleType})
                {unreadBySender.get(contact.userId)?.count
                  ? ` • ${unreadBySender.get(contact.userId)?.count} new`
                  : ""}
              </option>
            ))}
          </Select>
        </Card>
      )}

      <Card title="Chat">
        {!selectedContact && (
          <p className="text-sm text-ink-500">
            Select a contact to view messages.
          </p>
        )}
        {selectedContact && (
          <div className="flex flex-col gap-3">
            {loadingMessages ? (
              <p className="text-sm text-ink-500">Loading messages...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(messages ?? []).length ? (
                  (messages as MessageItem[]).map((msg) => {
                    const isMine = msg.senderUserId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-soft ${isMine
                              ? "bg-ink-900 text-white"
                              : "bg-ink-50 text-ink-800"
                            }`}
                        >
                          <p>{msg.messageText}</p>
                          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                            <span>{new Date(msg.sentAt).toLocaleString()}</span>
                            {isMine && (
                              <span
                                className={
                                  msg.readAt ? "text-sky-400" : "text-ink-400"
                                }
                              >
                                {msg.readAt ? "vv" : "v"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-ink-500">No messages yet.</p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-200"
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <Button onClick={handleSend} disabled={sending || !messageText.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
