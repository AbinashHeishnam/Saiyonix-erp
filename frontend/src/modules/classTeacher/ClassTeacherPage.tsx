import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import PageHeader from "../../components/PageHeader";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { getClassTeacher } from "../../services/api/classTeacher";
import { getConversation, getUnreadCount, sendMessage, MessageItem } from "../../services/api/messages";
import SecureImage from "../../components/SecureImage";

export default function ClassTeacherPage() {
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [openChat, setOpenChat] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: teacher, loading, error, refresh } = useAsync(getClassTeacher, []);
  const { data: unread } = useAsync(getUnreadCount, []);

  const {
    data: messages,
    loading: loadingMessages,
    refresh: refreshMessages,
  } = useAsync(async () => {
    if (!teacher?.userId) return [];
    return await getConversation(teacher.userId);
  }, [teacher?.userId]);

  useEffect(() => {
    if (teacher?.userId) {
      refreshMessages();
    }
  }, [teacher?.userId, refreshMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
      refreshMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [refresh, refreshMessages]);

  const sortedMessages = useMemo(() => messages ?? [], [messages]);

  const handleSend = async () => {
    if (!teacher?.userId || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: teacher.userId, message: messageText.trim() });
      setMessageText("");
      await refreshMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Class Teacher"
        subtitle="Reach your class teacher directly."
        actions={
          <div className="text-xs font-semibold text-ink-600">
            Unread: {unread ?? 0}
          </div>
        }
      />

      {loading && (
        <Card>
          <p className="text-sm text-ink-500">Loading class teacher...</p>
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-sm text-sunrise-600">{error}</p>
        </Card>
      )}

      {!loading && !teacher && (
        <EmptyState
          title="No class teacher assigned"
          description="Your class teacher details are not available yet."
        />
      )}

      {teacher && (
        <>
          <Card title="Teacher Details">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-full bg-ink-100 flex items-center justify-center text-lg font-semibold text-ink-600">
                  {teacher.photoUrl ? (
                    <SecureImage
                      fileUrl={teacher.photoUrl}
                      alt={teacher.fullName ?? "Teacher"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    teacher.fullName?.slice(0, 1) ?? "T"
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{teacher.fullName}</p>
                  <p className="text-xs text-ink-500">{teacher.email ?? "—"}</p>
                </div>
              </div>
              <Button variant="secondary" onClick={refresh}>
                Refresh
              </Button>
            </div>
          </Card>

          <Card title="Chat">
            {!openChat ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-800">Class Teacher</p>
                  <p className="text-xs text-ink-500">
                    {teacher.fullName}
                    {unread ? ` • ${unread} new` : ""}
                  </p>
                </div>
                <Button onClick={() => setOpenChat(true)}>Enter Chat</Button>
              </div>
            ) : (
              <>
                {loadingMessages ? (
                  <p className="text-sm text-ink-500">Loading messages...</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sortedMessages.length ? (
                      sortedMessages.map((msg: MessageItem) => {
                        const isMine = msg.senderUserId === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-soft ${
                                isMine
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
                      <p className="text-sm text-ink-500">
                        No messages yet. Say hello!
                      </p>
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
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
