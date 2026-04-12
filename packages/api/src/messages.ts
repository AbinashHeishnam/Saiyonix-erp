import api from "./client";
import type {
  MessageContact,
  MessageItem,
  TeacherUnreadItem,
  TeacherUnreadSummary,
} from "@saiyonix/types";

export async function sendMessage(payload: { receiverId: string; message: string }) {
  const res = await api.post("/messages/send", payload);
  return res.data?.data ?? res.data;
}

export async function getConversation(userId: string) {
  const res = await api.get(`/messages/${userId}`);
  return (res.data?.data ?? res.data) as MessageItem[];
}

export async function getTeacherContacts() {
  const res = await api.get("/messages/contacts");
  return (res.data?.data ?? res.data) as MessageContact[];
}

export async function getUnreadCount() {
  const res = await api.get("/messages/unread-count");
  const payload = res.data?.data ?? res.data;
  return payload?.count ?? 0;
}

export async function getTeacherUnread() {
  const res = await api.get("/messages/teacher-unread");
  return (res.data?.data ?? res.data) as TeacherUnreadItem[];
}

export async function getTeacherUnreadSummary() {
  const res = await api.get("/messages/teacher-unread-summary");
  return (res.data?.data ?? res.data) as TeacherUnreadSummary[];
}
