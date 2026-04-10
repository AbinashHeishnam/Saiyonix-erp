import api from "./client";

export type MessageItem = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  messageText: string;
  sentAt: string;
  readAt?: string | null;
};

export async function sendMessage(payload: { receiverId: string; message: string }) {
  const res = await api.post("/messages/send", payload);
  return res.data?.data ?? res.data;
}

export async function getConversation(userId: string) {
  const res = await api.get(`/messages/${userId}`);
  return (res.data?.data ?? res.data) as MessageItem[];
}

export type MessageContact = {
  userId: string;
  name: string;
  roleType: "STUDENT" | "PARENT";
  studentId?: string;
  parentId?: string;
};

export async function getTeacherContacts() {
  const res = await api.get("/messages/contacts");
  return (res.data?.data ?? res.data) as MessageContact[];
}

export async function getUnreadCount() {
  const res = await api.get("/messages/unread-count");
  const payload = res.data?.data ?? res.data;
  return payload?.count ?? 0;
}

export type TeacherUnreadItem = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: "STUDENT" | "PARENT";
  messageText: string;
  sentAt: string;
};

export async function getTeacherUnread() {
  const res = await api.get("/messages/teacher-unread");
  return (res.data?.data ?? res.data) as TeacherUnreadItem[];
}

export type TeacherUnreadSummary = {
  senderUserId: string;
  senderName: string;
  senderRole: "STUDENT" | "PARENT";
  count: number;
  lastMessage: string;
  lastSentAt: string;
};

export async function getTeacherUnreadSummary() {
  const res = await api.get("/messages/teacher-unread-summary");
  return (res.data?.data ?? res.data) as TeacherUnreadSummary[];
}
