import React, { useEffect, useMemo, useRef, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Textarea from "../../components/Textarea";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api/client";
import {
  getSectionClassroom,
  getStudentClassroom,
  getSubjectClassroom,
} from "../../services/api/classroom";
import { ensureSocketConnected, getSocket } from "../../services/socket";

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

function renderChatText(text?: string | null) {
  if (!text) return null;
  const parts = text.split(/(@teacher|@all)/gi);
  return parts.map((part, index) => {
    if (part.toLowerCase() === "@teacher" || part.toLowerCase() === "@all") {
      return (
        <span key={`${part}-${index}`} className="text-blue-600 font-semibold">
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

type TeacherClassroomItem = {
  kind: "subject" | "classTeacher";
  classId: string;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  subjectName?: string | null;
  subjectId?: string | null;
  classSubjectId?: string | null;
};

type SubjectItem = {
  classSubjectId: string;
  subjectName?: string | null;
  className?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  teacherId?: string | null;
  teacherUserId?: string | null;
  teacherName?: string | null;
  teacherPhotoUrl?: string | null;
  totalAssignments?: number | null;
  pendingAssignments?: number | null;
};

export default function ClassroomPage() {
  const { role, user } = useAuth();
  const isTeacher = role === "TEACHER";
  const isParent = role === "PARENT";
  const DEBUG = import.meta.env.MODE !== "production";

  const [selectedTeacherItem, setSelectedTeacherItem] = useState<TeacherClassroomItem | null>(null);
  const [activeTab, setActiveTab] = useState("stream");
  const [studentActiveTab, setStudentActiveTab] = useState("stream");
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedAssignmentForSubmit, setSelectedAssignmentForSubmit] = useState<any>(null);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [submissionsData, setSubmissionsData] = useState<any[]>([]);
  const [selectedAssignmentForReview, setSelectedAssignmentForReview] = useState<any>(null);
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const [groupChatRoomId, setGroupChatRoomId] = useState<string | null>(null);
  const [groupChatMessages, setGroupChatMessages] = useState<
    {
      id: string;
      senderId: string;
      senderRole: string;
      senderName?: string;
      message?: string | null;
      fileUrl?: string | null;
      replyTo?: {
        id: string;
        senderId: string;
        senderRole: string;
        senderName?: string | null;
        message?: string | null;
        fileUrl?: string | null;
        createdAt?: string | null;
      } | null;
      isPinned?: boolean;
      seenCount?: number;
      seenByMe?: boolean;
      clientId?: string | null;
      createdAt: string;
    }[]
  >([]);
  const [groupChatLoading, setGroupChatLoading] = useState(false);
  const [groupChatText, setGroupChatText] = useState("");
  const [groupChatSending, setGroupChatSending] = useState(false);
  const [groupChatError, setGroupChatError] = useState<string | null>(null);
  const [groupChatReplyTo, setGroupChatReplyTo] = useState<any | null>(null);
  const [groupChatTyping, setGroupChatTyping] = useState(false);
  const [groupChatFile, setGroupChatFile] = useState<File | null>(null);
  const [groupChatUploading, setGroupChatUploading] = useState(false);
  const [groupChatPinned, setGroupChatPinned] = useState<any | null>(null);
  const [groupChatNextCursor, setGroupChatNextCursor] = useState<string | null>(null);
  const groupChatFileRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const { data: parentProfile } = useAsync(async () => {
    if (!isParent) return null;
    const res = await api.get("/parent/profile");
    return res.data?.data ?? res.data;
  }, [isParent]);

  const { data: teacherProfile } = useAsync(async () => {
    if (!isTeacher) return null;
    const res = await api.get("/teacher/profile");
    const payload = res.data?.data ?? res.data;
    return payload?.teacher ?? payload ?? null;
  }, [isTeacher]);

  useEffect(() => {
    if (!isParent) return;
    if (selectedStudentId) return;
    const firstStudentId = parentProfile?.students?.[0]?.id;
    if (firstStudentId) {
      setSelectedStudentId(firstStudentId);
    }
  }, [isParent, parentProfile, selectedStudentId]);

  useEffect(() => {
    if (selectedSubject) {
      setStudentActiveTab("stream");
    }
  }, [selectedSubject]);

  useEffect(() => {
    const socket = ensureSocketConnected();
    const onConnect = () => {
      if (DEBUG) {
        console.log("Socket connected:", socket.id);
      }
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
    if (!groupChatRoomId) return;
    const socket = getSocket();
    if (!socket.connected) {
      ensureSocketConnected();
    }
    if (DEBUG) {
      console.log("Joining room:", groupChatRoomId);
    }
    seenMessageIdsRef.current = new Set();
    socket.emit("join_room", groupChatRoomId);
  }, [groupChatRoomId]);

  useEffect(() => {
    const socket = getSocket();
    const handleReceive = (data: {
      roomId: string;
      senderId: string;
      senderRole: string;
      senderName?: string;
      message?: string | null;
      fileUrl?: string | null;
      replyTo?: any | null;
      isPinned?: boolean;
      seenCount?: number;
      seenByMe?: boolean;
      clientId?: string | null;
      createdAt: string;
      id: string;
    }) => {
      if (DEBUG) {
        console.log("Received message:", data);
      }
      if (groupChatRoomId && data.roomId !== groupChatRoomId) {
        return;
      }
      setGroupChatMessages((prev) => {
        if (prev.some((msg) => msg.id === data.id)) {
          return prev;
        }
        if (data.clientId) {
          const idx = prev.findIndex((msg) => msg.clientId === data.clientId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...data };
            return next;
          }
        }
        return [...prev, data];
      });
      if (data.isPinned) {
        setGroupChatPinned(data);
      }
      if (user?.id && data.senderId !== user.id && !seenMessageIdsRef.current.has(data.id)) {
        seenMessageIdsRef.current.add(data.id);
        socket.emit("message_seen", { messageId: data.id });
        setGroupChatMessages((prev) =>
          prev.map((msg) => (msg.id === data.id ? { ...msg, seenByMe: true } : msg))
        );
      }
    };
    const handleTyping = (data: { roomId?: string }) => {
      if (groupChatRoomId && data?.roomId && data.roomId !== groupChatRoomId) return;
      setGroupChatTyping(true);
    };
    const handleStopTyping = (data: { roomId?: string }) => {
      if (groupChatRoomId && data?.roomId && data.roomId !== groupChatRoomId) return;
      setGroupChatTyping(false);
    };
    const handleSeen = (data: { messageId: string; userId: string; roomId?: string }) => {
      if (groupChatRoomId && data?.roomId && data.roomId !== groupChatRoomId) return;
      setGroupChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? {
              ...msg,
              seenCount: (msg.seenCount ?? 0) + 1,
            }
            : msg
        )
      );
    };
    socket.on("receive_message", handleReceive);
    socket.on("user_typing", handleTyping);
    socket.on("user_stop_typing", handleStopTyping);
    socket.on("message_seen", handleSeen);
    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("message_seen", handleSeen);
    };
  }, [groupChatRoomId, user?.id]);

  useEffect(() => {
    if (!groupChatOpen || !groupChatRoomId) return;
    if (!user?.id) return;
    const socket = getSocket();
    const unseen = groupChatMessages.filter(
      (msg) =>
        msg.senderId !== user.id &&
        !msg.seenByMe &&
        !seenMessageIdsRef.current.has(msg.id)
    );
    if (!unseen.length) return;
    unseen.forEach((msg) => {
      seenMessageIdsRef.current.add(msg.id);
      socket.emit("message_seen", { messageId: msg.id });
    });
    setGroupChatMessages((prev) =>
      prev.map((msg) =>
        seenMessageIdsRef.current.has(msg.id) ? { ...msg, seenByMe: true } : msg
      )
    );
  }, [groupChatMessages, groupChatOpen, groupChatRoomId, user?.id]);


  const { data: teacherAssignments, loading: teacherLoading } = useAsync(async () => {
    if (!isTeacher) return [];
    const res = await api.get("/classroom/teacher/me");
    const payload = res.data?.data ?? res.data;
    if (DEBUG) {
      console.log("Teacher classroom API:", payload);
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      const profileRes = await api.get("/teacher/profile");
      const profilePayload = profileRes.data?.data ?? profileRes.data;
      const teacher = profilePayload?.teacher ?? profilePayload ?? null;
      const sectionsRes = await api.get("/sections", { params: { limit: 200 } });
      const sectionsPayload = sectionsRes.data?.data ?? sectionsRes.data?.items ?? [];
      const sections = Array.isArray(sectionsPayload) ? sectionsPayload : [];
      const fallback = sections
        .filter((section: any) => section.classTeacherId && section.classTeacherId === teacher?.id)
        .map((section: any) => ({
          kind: "classTeacher" as const,
          classId: section.classId,
          className: section.class?.className ?? null,
          sectionId: section.id,
          sectionName: section.sectionName ?? null,
          subjectName: "Class Teacher",
          classSubjectId: null,
        }));
      return fallback;
    }

    return payload.map((item: any) => ({ ...item, kind: "subject" as const }));
  }, [isTeacher]);

  const { data: studentSubjects, loading: studentLoading } = useAsync(async () => {
    if (isTeacher) return [];
    const res = await getStudentClassroom(selectedStudentId || undefined);
    return res ?? [];
  }, [isTeacher, selectedStudentId]);

  const { data: sectionDetail, refresh: refreshSection } = useAsync(async () => {
    if (!selectedTeacherItem?.sectionId) return null;
    return await getSectionClassroom(selectedTeacherItem.sectionId);
  }, [selectedTeacherItem?.sectionId]);

  const { data: subjectDetail, loading: subjectLoading, error: subjectError, refresh: refreshSubject } = useAsync(async () => {
    const subjectId =
      isTeacher && selectedTeacherItem?.kind === "subject"
        ? selectedTeacherItem?.classSubjectId
        : selectedSubject?.classSubjectId;
    if (!subjectId) return null;
    const res = await getSubjectClassroom(subjectId, selectedStudentId || undefined);
    return res ?? null;
  }, [
    selectedTeacherItem?.classSubjectId,
    selectedTeacherItem?.kind,
    selectedSubject?.classSubjectId,
    selectedStudentId,
    isTeacher,
  ]);

  const teacherCards = useMemo(
    () => (teacherAssignments ?? []) as TeacherClassroomItem[],
    [teacherAssignments]
  );
  const subjectCards = useMemo(() => (studentSubjects ?? []) as SubjectItem[], [studentSubjects]);
  const subjectOptions = useMemo(
    () => teacherCards.filter((item) => item.kind === "subject"),
    [teacherCards]
  );

  useEffect(() => {
    if (selectedTeacherItem?.kind === "subject") {
      setAssignmentTarget({
        classId: selectedTeacherItem.classId,
        sectionId: selectedTeacherItem.sectionId ?? "",
        subjectId: selectedTeacherItem.subjectId ?? "",
      });
      setNoteTarget({
        classId: selectedTeacherItem.classId,
        sectionId: selectedTeacherItem.sectionId ?? "",
        subjectId: selectedTeacherItem.subjectId ?? "",
      });
    }
  }, [selectedTeacherItem]);

  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    dueAt: "",
    maxMarks: "",
  });
  const [assignmentTarget, setAssignmentTarget] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
  });
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const [noteForm, setNoteForm] = useState({
    title: "",
    description: "",
  });
  const [noteTarget, setNoteTarget] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
  });
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
  });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleCreateAssignment = async () => {
    setAssignmentError(null);
    if (!assignmentTarget.classId || !assignmentTarget.subjectId) {
      setAssignmentError("Please select a subject.");
      return;
    }
    if (!assignmentForm.title.trim()) {
      setAssignmentError("Title is required.");
      return;
    }
    if (!assignmentForm.dueAt) {
      setAssignmentError("Deadline is required.");
      return;
    }
    setAssignmentSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (assignmentFile) {
        const formData = new FormData();
        formData.append("file", assignmentFile);
        formData.append("userType", "teacher");
        formData.append("userId", user?.id ?? "shared");
        formData.append("module", "assignments");
        const uploadRes = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        fileUrl = uploadRes.data?.data?.fileUrl ?? uploadRes.data?.fileUrl ?? null;
        fileName = assignmentFile.name ?? null;
      }
      const deadlineValue =
        assignmentForm.dueAt && assignmentForm.dueAt.length === 10
          ? `${assignmentForm.dueAt}T23:59:00`
          : assignmentForm.dueAt;
      const payload = {
        classId: assignmentTarget.classId,
        sectionId: assignmentTarget.sectionId || null,
        subjectId: assignmentTarget.subjectId,
        title: assignmentForm.title,
        description: assignmentForm.description || undefined,
        deadline: deadlineValue,
        maxMarks: assignmentForm.maxMarks ? Number(assignmentForm.maxMarks) : undefined,
        fileUrl,
        fileName,
      };
      await api.post("/classroom/assignment/create", payload);
      setAssignmentForm({ title: "", description: "", dueAt: "", maxMarks: "" });
      setAssignmentFile(null);
      setShowAssignmentModal(false);
      await refreshSubject();
      await refreshSection();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to create assignment.";
      setAssignmentError(message);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleCreateNote = async () => {
    setNoteError(null);
    if (!noteTarget.classId || !noteTarget.subjectId) {
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
        const formData = new FormData();
        formData.append("file", noteFile);
        formData.append("userType", "teacher");
        formData.append("userId", user?.id ?? "shared");
        formData.append("module", "notes");
        const res = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        fileUrl = res.data?.data?.fileUrl ?? res.data?.fileUrl ?? null;
        fileType = noteFile.type || null;
      }

      await api.post("/classroom/notes/create", {
        classId: noteTarget.classId,
        sectionId: noteTarget.sectionId || null,
        subjectId: noteTarget.subjectId,
        title: noteForm.title,
        description: noteForm.description || undefined,
        fileUrl,
        fileType,
      });

      setNoteForm({ title: "", description: "" });
      setNoteFile(null);
      setShowNotesModal(false);
      await refreshSubject();
      await refreshSection();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to upload notes.";
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    setAnnouncementError(null);
    if (!selectedTeacherItem?.classId) {
      setAnnouncementError("Select a classroom first.");
      return;
    }
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setAnnouncementError("Title and content are required.");
      return;
    }
    setAnnouncementSaving(true);
    try {
      await api.post("/classroom/announcement/create", {
        classId: selectedTeacherItem.classId,
        sectionId: selectedTeacherItem.sectionId ?? null,
        title: announcementForm.title,
        content: announcementForm.content,
      });
      setAnnouncementForm({ title: "", content: "" });
      setShowAnnouncementModal(false);
      await refreshSubject();
      await refreshSection();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to post announcement.";
      setAnnouncementError(message);
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleSubmitAssignment = async () => {
    setSubmissionError(null);
    if (!selectedAssignmentForSubmit || !submissionFile) {
      setSubmissionError("Please attach your assignment file.");
      return;
    }
    setSubmissionSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", submissionFile);
      formData.append("userType", "student");
      formData.append("userId", user?.id ?? "shared");
      formData.append("module", "assignment-submissions");
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = uploadRes.data?.data?.fileUrl ?? uploadRes.data?.fileUrl;
      await api.post("/classroom/assignment/submit", {
        assignmentId: selectedAssignmentForSubmit.id,
        submissionUrl: fileUrl,
        studentId: isParent ? selectedStudentId || undefined : undefined,
      });
      setSubmissionFile(null);
      setShowSubmissionModal(false);
      await refreshSubject();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to submit assignment.";
      setSubmissionError(message);
    } finally {
      setSubmissionSaving(false);
    }
  };

  const handleOpenGroupChat = async (roomId?: string | null) => {
    setGroupChatError(null);
    setGroupChatMessages([]);
    setGroupChatOpen(true);
    setGroupChatReplyTo(null);
    setGroupChatFile(null);
    setGroupChatPinned(null);
    if (!roomId) {
      setGroupChatError("Chat room not available yet.");
      return;
    }
    setGroupChatError(null);
    setGroupChatMessages([]);
    setGroupChatOpen(true);
    setGroupChatLoading(true);
    setGroupChatRoomId(roomId);
    try {
      const res = await api.get(`/classroom/chat/room/${roomId}`, {
        params: { limit: 50 },
      });
      const payload = res.data?.data ?? res.data;
      const messages = payload?.messages ?? [];
      setGroupChatMessages(messages);
      setGroupChatNextCursor(payload?.nextCursor ?? null);
      const pinned = messages.find((msg: any) => msg.isPinned);
      setGroupChatPinned(pinned ?? null);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to load messages.";
      setGroupChatError(message);
    } finally {
      setGroupChatLoading(false);
    }
  };

  const handleLoadOlderMessages = async () => {
    if (!groupChatRoomId || !groupChatNextCursor || groupChatLoading) return;
    setGroupChatLoading(true);
    try {
      const res = await api.get(`/classroom/chat/room/${groupChatRoomId}`, {
        params: { limit: 50, before: groupChatNextCursor },
      });
      const payload = res.data?.data ?? res.data;
      const messages = payload?.messages ?? [];
      if (messages.length) {
        setGroupChatMessages((prev) => [...messages, ...prev]);
        setGroupChatNextCursor(payload?.nextCursor ?? null);
        if (!groupChatPinned) {
          const pinned = messages.find((msg: any) => msg.isPinned);
          if (pinned) setGroupChatPinned(pinned);
        }
      } else {
        setGroupChatNextCursor(null);
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to load older messages.";
      setGroupChatError(message);
    } finally {
      setGroupChatLoading(false);
    }
  };

  const handleSendGroupMessage = async () => {
    if (!groupChatRoomId) return;
    const trimmed = groupChatText.trim();
    if (!trimmed && !groupChatFile) return;
    if (DEBUG) {
      console.log("Sending message:", trimmed);
    }
    setGroupChatSending(true);
    const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage = {
      id: clientId,
      clientId,
      roomId: groupChatRoomId,
      senderId: user?.id ?? "me",
      senderRole: role ?? "USER",
      senderName: "You",
      message: trimmed || null,
      fileUrl: groupChatFile ? "uploading" : null,
      replyTo: groupChatReplyTo ?? null,
      createdAt: new Date().toISOString(),
      seenCount: 0,
      seenByMe: true,
    };
    setGroupChatMessages((prev) => [...prev, optimisticMessage]);
    try {
      let fileUrl: string | null = null;
      if (groupChatFile) {
        setGroupChatUploading(true);
        const formData = new FormData();
        formData.append("file", groupChatFile);
        formData.append("userType", role?.toLowerCase?.() ?? "user");
        formData.append("userId", user?.id ?? "shared");
        formData.append("module", "chat");
        try {
          const uploadRes = await api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          fileUrl = uploadRes.data?.data?.fileUrl ?? uploadRes.data?.fileUrl ?? null;
        } catch (err: any) {
          const message =
            err?.response?.data?.message ??
            err?.response?.data?.error ??
            err?.message ??
            "File upload failed.";
          setGroupChatError(message);
          return;
        } finally {
          setGroupChatUploading(false);
        }
      }
      const socket = getSocket();
      if (!socket.connected) {
        ensureSocketConnected();
      }
      socket.emit("send_message", {
        roomId: groupChatRoomId,
        message: trimmed || null,
        fileUrl,
        replyToId: groupChatReplyTo?.id ?? null,
        clientId,
      });
      socket.emit("stop_typing", groupChatRoomId);
      setGroupChatText("");
      setGroupChatFile(null);
      setGroupChatReplyTo(null);
    } finally {
      setGroupChatSending(false);
    }
  };

  const handlePickChatFile = () => {
    groupChatFileRef.current?.click();
  };

  const handleChatFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setGroupChatError(null);
    setGroupChatFile(file);
  };

  const handleReplyToMessage = (msg: any) => {
    setGroupChatReplyTo(msg);
  };

  const handlePinMessage = async (msg: any, pin: boolean) => {
    if (!msg?.id) return;
    try {
      const res = await api.post(`/classroom/chat/${pin ? "pin" : "unpin"}/${msg.id}`);
      const payload = res.data?.data ?? res.data;
      setGroupChatMessages((prev) =>
        prev.map((item) => ({
          ...item,
          isPinned: item.id === msg.id ? pin : pin ? false : item.isPinned,
        }))
      );
      setGroupChatPinned(pin ? payload ?? msg : null);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to pin message.";
      setGroupChatError(message);
    }
  };

  const handleViewSubmissions = async (assignment: any) => {
    setSubmissionsError(null);
    setSubmissionsLoading(true);
    setSelectedAssignmentForReview(assignment);
    try {
      const res = await api.get(`/assignments/${assignment.id}/submissions`, {
        params: { page: 1, limit: 200 },
      });
      const payload = res.data?.data ?? res.data;
      const items = payload?.items ?? payload ?? [];
      setSubmissionsData(Array.isArray(items) ? items : []);
      setShowSubmissionsModal(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to load submissions.";
      setSubmissionsError(message);
      setShowSubmissionsModal(true);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const groupChatModal = (
    <Modal
      open={groupChatOpen}
      onClose={() => setGroupChatOpen(false)}
      title="Classroom Group Chat"
      size="full"
    >
      <div className="flex h-full flex-col">
        <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {subjectDetail?.subjectName ?? "Subject"}
          </p>
          <p className="text-xs text-slate-500">
            {subjectDetail?.className ?? "Class"}{" "}
            {subjectDetail?.sectionName ? `• ${subjectDetail.sectionName}` : ""}
          </p>
          <p className="text-xs text-slate-500">
            {subjectDetail?.teacher?.fullName ?? "Teacher"}
          </p>
        </div>
        {groupChatPinned && (
          <div className="mb-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-900">
            <span className="mr-2">📌</span>
            {groupChatPinned.message ? renderChatText(groupChatPinned.message) : "Pinned file"}
          </div>
        )}

        <div className="flex flex-1 flex-col">
          {groupChatError && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              <span>{groupChatError}</span>
              <button
                type="button"
                className="text-rose-500 hover:text-rose-700"
                onClick={() => setGroupChatError(null)}
              >
                ✕
              </button>
            </div>
          )}
          {groupChatLoading ? (
            <p className="text-sm text-slate-500">Loading messages...</p>
          ) : (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-slate-50/60 p-4">
              {groupChatNextCursor && (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={handleLoadOlderMessages}>
                    Load older messages
                  </Button>
                </div>
              )}
              {groupChatMessages.length ? (
                groupChatMessages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  const senderName = isMine ? "You" : msg.senderName ?? msg.senderRole;
                  const senderLabel = msg.senderRole === "TEACHER" ? `${senderName} (teacher)` : senderName;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-soft ${isMine ? "bg-blue-500 text-white ml-auto" : "bg-gray-200 text-gray-900"
                          }`}
                      >
                        <p className="text-[10px] opacity-80">{senderLabel}</p>
                        {msg.replyTo && (
                          <div className="mb-2 rounded-xl border border-white/30 bg-white/20 px-2 py-1 text-[11px]">
                            <p className="font-semibold">
                              {msg.replyTo.senderRole === "TEACHER"
                                ? `${msg.replyTo.senderName ?? msg.replyTo.senderRole} (teacher)`
                                : msg.replyTo.senderName ?? msg.replyTo.senderRole}
                            </p>
                            <p className="opacity-80">
                              {msg.replyTo.message ?? "Attachment"}
                            </p>
                          </div>
                        )}
                        {msg.message && <p>{renderChatText(msg.message)}</p>}
                        {msg.fileUrl && msg.fileUrl !== "uploading" && (
                          <SecureLink
                            fileUrl={msg.fileUrl}
                            className={`mt-2 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${isMine ? "bg-white/20 text-white" : "bg-white text-slate-700"
                              }`}
                          >
                            <span>{getFileIcon(msg.fileUrl)}</span>
                            <span>{getFileName(msg.fileUrl) ?? "Attachment"}</span>
                          </SecureLink>
                        )}
                        {msg.fileUrl === "uploading" && (
                          <p className="mt-2 text-xs opacity-80">Uploading file...</p>
                        )}
                        <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                          {isMine && (
                            <span>{(msg.seenCount ?? 0) > 0 ? "✔✔ Seen" : "✔ Sent"}</span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-2 text-[11px]">
                          <button
                            type="button"
                            className={isMine ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-slate-700"}
                            onClick={() => handleReplyToMessage(msg)}
                          >
                            Reply
                          </button>
                          {isTeacher && (
                            <button
                              type="button"
                              className={isMine ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-slate-700"}
                              onClick={() => handlePinMessage(msg, !msg.isPinned)}
                            >
                              {msg.isPinned ? "Unpin" : "Pin"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No messages yet.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-100 pt-3">
          {groupChatReplyTo && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs">
              <div>
                <p className="font-semibold">
                  Replying to {groupChatReplyTo.senderName ?? groupChatReplyTo.senderRole}
                </p>
                <p className="text-slate-500">
                  {groupChatReplyTo.message ?? "Attachment"}
                </p>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-rose-500"
                onClick={() => setGroupChatReplyTo(null)}
              >
                ✕
              </button>
            </div>
          )}
          {groupChatFile && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs">
              <span>{groupChatFile.name}</span>
              <button
                type="button"
                className="text-slate-500 hover:text-rose-500"
                onClick={() => setGroupChatFile(null)}
              >
                ✕
              </button>
            </div>
          )}
          {groupChatTyping && (
            <p className="text-xs text-slate-500">Someone is typing...</p>
          )}
          {groupChatUploading && (
            <p className="text-xs text-slate-500">Uploading file...</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-200"
              placeholder="Type your message..."
              value={groupChatText}
              onChange={(e) => {
                setGroupChatText(e.target.value);
                if (groupChatRoomId) {
                  const socket = getSocket();
                  socket.emit("typing", groupChatRoomId);
                  if (typingTimeoutRef.current) {
                    window.clearTimeout(typingTimeoutRef.current);
                  }
                  typingTimeoutRef.current = window.setTimeout(() => {
                    socket.emit("stop_typing", groupChatRoomId);
                  }, 1200);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendGroupMessage();
                }
              }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handlePickChatFile}>
                +
              </Button>
              <Button
                onClick={handleSendGroupMessage}
                disabled={groupChatSending || groupChatUploading || (!groupChatText.trim() && !groupChatFile)}
              >
                {groupChatSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
          <input
            ref={groupChatFileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv"
            className="hidden"
            onChange={handleChatFileChange}
          />
        </div>
      </div>
    </Modal>
  );


  const teacherTabs = [
    { key: "stream", label: "Stream" },
    { key: "classwork", label: "Classwork" },
    { key: "people", label: "People" },
  ];

  const teacherDisplayName = teacherProfile?.fullName ?? user?.email ?? "Teacher";

  const streamItems = useMemo(() => {
    if (!selectedTeacherItem) return [];
    const assignments =
      selectedTeacherItem.kind === "subject"
        ? subjectDetail?.assignments ?? []
        : sectionDetail?.assignments ?? [];
    const notes =
      selectedTeacherItem.kind === "subject"
        ? subjectDetail?.notes ?? []
        : sectionDetail?.notes ?? [];
    const announcements =
      selectedTeacherItem.kind === "subject"
        ? subjectDetail?.announcements ?? []
        : sectionDetail?.announcements ?? [];

    const mappedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      type: "assignment",
      title: assignment.title,
      description: assignment.description,
      createdAt: assignment.createdAt ?? assignment.dueAt ?? null,
      dueAt: assignment.dueAt ?? null,
      attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
      subjectName: assignment.classSubject?.subject?.name ?? selectedTeacherItem.subjectName ?? null,
    }));

    const mappedNotes = notes.map((note: any) => ({
      id: note.id,
      type: "note",
      title: note.title,
      description: note.description,
      createdAt: note.createdAt ?? note.publishedAt ?? null,
      fileUrl: note.fileUrl ?? null,
      fileType: note.fileType ?? null,
      subjectName: note.classSubject?.subject?.name ?? selectedTeacherItem.subjectName ?? null,
    }));

    const mappedAnnouncements = announcements.map((item: any) => ({
      id: item.id,
      type: "announcement",
      title: item.title,
      description: item.content,
      createdAt: item.createdAt ?? null,
      subjectName: selectedTeacherItem.subjectName ?? null,
    }));

    return [...mappedAnnouncements, ...mappedAssignments, ...mappedNotes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [selectedTeacherItem, sectionDetail, subjectDetail]);

  const peopleTeachers = useMemo(() => {
    if (!selectedTeacherItem) return [];
    if (sectionDetail?.teachers?.length) {
      return sectionDetail.teachers.map((teacher: any) => ({
        id: teacher.id,
        fullName: teacher.fullName ?? "Teacher",
        photoUrl: teacher.photoUrl ?? null,
        email: teacher.email ?? null,
        subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
      }));
    }
    if (subjectDetail?.teacher) {
      return [
        {
          id: subjectDetail.teacher.id,
          fullName: subjectDetail.teacher.fullName ?? "Teacher",
          photoUrl: subjectDetail.teacher.photoUrl ?? null,
          email: subjectDetail.teacher.email ?? null,
          subjects: selectedTeacherItem.subjectName ? [selectedTeacherItem.subjectName] : [],
        },
      ];
    }
    if (teacherProfile) {
      return [
        {
          id: teacherProfile.id,
          fullName: teacherProfile.fullName ?? teacherDisplayName,
          photoUrl: teacherProfile.photoUrl ?? null,
          email: teacherProfile.email ?? null,
          subjects: selectedTeacherItem.subjectName ? [selectedTeacherItem.subjectName] : [],
        },
      ];
    }
    return [];
  }, [selectedTeacherItem, sectionDetail, subjectDetail, teacherProfile, teacherDisplayName]);

  const studentStreamItems = useMemo(() => {
    if (!subjectDetail) return [];
    const announcements = subjectDetail.announcements ?? [];
    const assignments = subjectDetail.assignments ?? [];
    const notes = subjectDetail.notes ?? [];

    const mappedAnnouncements = announcements.map((item: any) => ({
      id: item.id,
      type: "announcement",
      title: item.title,
      description: item.content,
      createdAt: item.createdAt ?? null,
    }));

    const mappedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      type: "assignment",
      title: assignment.title,
      description: assignment.description,
      createdAt: assignment.createdAt ?? assignment.dueAt ?? null,
      dueAt: assignment.dueAt ?? null,
      attachments: Array.isArray(assignment.attachments) ? assignment.attachments : [],
    }));

    const mappedNotes = notes.map((note: any) => ({
      id: note.id,
      type: "note",
      title: note.title,
      description: note.description,
      createdAt: note.createdAt ?? note.publishedAt ?? null,
      fileUrl: note.fileUrl ?? null,
    }));

    return [...mappedAnnouncements, ...mappedAssignments, ...mappedNotes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [subjectDetail]);

  const openAssignmentModal = () => {
    if (selectedTeacherItem?.kind === "subject") {
      setAssignmentTarget({
        classId: selectedTeacherItem.classId,
        sectionId: selectedTeacherItem.sectionId ?? "",
        subjectId: selectedTeacherItem.subjectId ?? "",
      });
    } else if (subjectOptions.length > 0) {
      const defaultSubject =
        subjectOptions.find((item) => item.classId === selectedTeacherItem?.classId) ??
        subjectOptions[0];
      setAssignmentTarget({
        classId: defaultSubject.classId,
        sectionId: defaultSubject.sectionId ?? "",
        subjectId: defaultSubject.subjectId ?? "",
      });
    }
    setShowAssignmentModal(true);
  };

  const openNotesModal = () => {
    if (selectedTeacherItem?.kind === "subject") {
      setNoteTarget({
        classId: selectedTeacherItem.classId,
        sectionId: selectedTeacherItem.sectionId ?? "",
        subjectId: selectedTeacherItem.subjectId ?? "",
      });
    } else if (subjectOptions.length > 0) {
      const defaultSubject =
        subjectOptions.find((item) => item.classId === selectedTeacherItem?.classId) ??
        subjectOptions[0];
      setNoteTarget({
        classId: defaultSubject.classId,
        sectionId: defaultSubject.sectionId ?? "",
        subjectId: defaultSubject.subjectId ?? "",
      });
    }
    setShowNotesModal(true);
  };

  const openAnnouncementModal = () => {
    setShowAnnouncementModal(true);
  };

  if (isTeacher) {
    return (
      <div className="flex flex-col gap-6 scroll-smooth">
        <PageHeader title="Classroom" subtitle="Manage classes and share classwork updates" />

        {teacherLoading ? (
          <Card>
            <p className="text-sm text-ink-500">Loading classrooms...</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teacherCards.map((item) => {
              const isActive =
                selectedTeacherItem?.sectionId === item.sectionId &&
                selectedTeacherItem?.classSubjectId === item.classSubjectId &&
                selectedTeacherItem?.kind === item.kind;
              return (
                <button
                  key={`${item.kind}-${item.classSubjectId ?? "section"}-${item.sectionId ?? "all"}`}
                  type="button"
                  onClick={() => {
                    setSelectedTeacherItem(item);
                    setActiveTab("stream");
                  }}
                  className={`group overflow-hidden rounded-2xl border text-left shadow-lg transition ${isActive ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200 hover:shadow-xl"
                    }`}
                >
                  <div className="h-32 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-600 p-4 text-white">
                    <h2 className="text-lg font-bold">
                      {item.className ?? "Class"} {item.subjectName ? `- ${item.subjectName}` : ""}
                    </h2>
                    <p className="text-sm opacity-90">{item.sectionName ?? "All Sections"}</p>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <p className="text-xs text-slate-500">{teacherDisplayName}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {item.kind === "classTeacher" ? "Class Teacher" : "Subject"}
                    </span>
                  </div>
                </button>
              );
            })}
            {!teacherCards.length && (
              <Card>
                <p className="text-sm text-ink-500">
                  No classroom assignments found yet. Please ask the admin to map your subject or class.
                </p>
              </Card>
            )}
          </div>
        )}

        {selectedTeacherItem && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-40 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-600 p-6 text-white">
                <h2 className="text-2xl font-bold">
                  {selectedTeacherItem.className ?? "Class"} {selectedTeacherItem.sectionName ? `• ${selectedTeacherItem.sectionName}` : ""}
                </h2>
                <p className="text-sm opacity-90">
                  {selectedTeacherItem.subjectName ?? "Classroom"} {selectedTeacherItem.kind === "classTeacher" ? "• Class Teacher" : ""}
                </p>
                <div className="absolute bottom-4 left-6 text-xs font-semibold">
                  {teacherDisplayName}
                </div>
                {selectedTeacherItem.kind === "subject" && subjectDetail?.chatRoomId && (
                  <div className="absolute bottom-4 right-6">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => handleOpenGroupChat(subjectDetail.chatRoomId)}
                    >
                      Open Group Chat
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky top-20 z-10 rounded-2xl bg-slate-50/90 p-2 backdrop-blur">
              <div className="flex flex-wrap gap-2">
                {teacherTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "stream" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Stream</h3>
                  <div className="flex flex-wrap gap-2">
                    {subjectDetail?.chatRoomId && selectedTeacherItem?.kind === "subject" && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => handleOpenGroupChat(subjectDetail.chatRoomId)}
                      >
                        Open Group Chat
                      </Button>
                    )}
                    <Button variant="secondary" onClick={openAnnouncementModal}>
                      ✏️ New Announcement
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">No announcements yet.</p>
                </div>

                {streamItems.length ? (
                  <div className="flex flex-col gap-3">
                    {streamItems.map((item: any) => {
                      const attachments =
                        item.type === "assignment"
                          ? item.attachments ?? []
                          : item.fileUrl
                            ? [{ fileUrl: item.fileUrl, fileName: getFileName(item.fileUrl) }]
                            : [];
                      return (
                        <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl shadow p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-100">
                              {teacherProfile?.photoUrl ? (
                                <SecureImage
                                  fileUrl={teacherProfile.photoUrl}
                                  alt={teacherDisplayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                                  {teacherDisplayName.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{teacherDisplayName}</p>
                              <p className="text-xs text-slate-400">
                                {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.type === "assignment"
                                ? "Assignment"
                                : item.type === "note"
                                  ? "Note"
                                  : "Announcement"}: {item.title}
                            </p>
                            {item.subjectName && (
                              <p className="text-xs text-slate-400 mt-1">{item.subjectName}</p>
                            )}
                            {item.description && (
                              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                            )}
                            {item.dueAt && (
                              <p className="mt-2 text-xs text-slate-400">
                                Due: {new Date(item.dueAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {attachments.map((file: any, idx: number) => (
                                <SecureLink
                                  key={`${file.fileUrl ?? file}-${idx}`}
                                  fileUrl={file.fileUrl ?? file}
                                  fileName={file.fileName ?? getFileName(file.fileUrl ?? file) ?? "Attachment"}
                                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-600"
                                >
                                  <span>{getFileIcon(file.fileUrl ?? file)}</span>
                                  <span>{file.fileName ?? getFileName(file.fileUrl ?? file) ?? "Attachment"}</span>
                                </SecureLink>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No classwork has been posted yet.</p>
                )}
              </div>
            )}

            {activeTab === "classwork" && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={openAssignmentModal}>+ Assignment</Button>
                  <Button variant="secondary" onClick={openNotesModal}>
                    + Notes
                  </Button>
                  <Button variant="secondary" onClick={openAnnouncementModal}>
                    + Announcement
                  </Button>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Assignments</h3>
                    {(subjectDetail?.assignments ?? sectionDetail?.assignments ?? []).length ? (
                      <div className="mt-3 grid gap-3">
                        {(selectedTeacherItem.kind === "subject"
                          ? subjectDetail?.assignments ?? []
                          : sectionDetail?.assignments ?? []
                        ).map((assignment: any) => (
                          <div key={assignment.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900">{assignment.title}</p>
                                <p className="text-xs text-slate-400">
                                  {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No due date"}
                                </p>
                              </div>
                              {sectionDetail?.students?.length ? (
                                <div className="text-xs text-slate-500 text-right">
                                  <p>Submitted: {assignment._count?.submissions ?? 0}</p>
                                  <p>
                                    Pending:{" "}
                                    {Math.max(
                                      0,
                                      (sectionDetail?.students?.length ?? 0) -
                                      (assignment._count?.submissions ?? 0)
                                    )}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-3 flex justify-end">
                              <Button variant="secondary" onClick={() => handleViewSubmissions(assignment)}>
                                View Submissions
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No assignments yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                    {(subjectDetail?.notes ?? sectionDetail?.notes ?? []).length ? (
                      <div className="mt-3 grid gap-3">
                        {(selectedTeacherItem.kind === "subject"
                          ? subjectDetail?.notes ?? []
                          : sectionDetail?.notes ?? []
                        ).map((note: any) => (
                          <div key={note.id} className="border rounded-lg p-3">
                            <p className="font-semibold text-slate-900">{note.title}</p>
                            <p className="text-xs text-slate-400">
                              {note.createdAt ? new Date(note.createdAt).toLocaleString() : "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No notes yet.</p>
                    )}
                  </div>
                </div>

                <Card>
                  <p className="text-sm text-slate-500">
                    Use the buttons above to create assignments, notes, or announcements.
                  </p>
                </Card>
              </div>
            )}

            {activeTab === "people" && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Teachers</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {peopleTeachers.map((teacher: any) => (
                      <div key={teacher.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                            {teacher.photoUrl ? (
                              <SecureImage
                                fileUrl={teacher.photoUrl}
                                alt={teacher.fullName ?? "Teacher"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                                {(teacher.fullName ?? "T").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{teacher.fullName ?? "Teacher"}</p>
                            <p className="text-xs text-slate-400">
                              {teacher.subjects?.length ? teacher.subjects.join(", ") : "Classroom"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!peopleTeachers.length && (
                      <p className="text-sm text-slate-500">No teachers found for this class.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Students</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(sectionDetail?.students ?? []).map((student: any) => (
                      <div key={student.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                            {student.photoUrl ? (
                              <SecureImage
                                fileUrl={student.photoUrl}
                                alt={student.fullName ?? "Student"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                                {(student.fullName ?? "S").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{student.fullName ?? "Student"}</p>
                            <p className="text-xs text-slate-400">Roll: {student.rollNumber ?? "Pending"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(sectionDetail?.students ?? []).length === 0 && (
                      <p className="text-sm text-slate-500">No students found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTeacherItem && activeTab === "stream" && (
          <button
            type="button"
            className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/40 transition active:scale-95 sm:hidden"
          >
            +
          </button>
        )}

        <Modal
          open={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          title="Create Assignment"
          size="lg"
        >
          {subjectOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No subject assignments found. Please ask the admin to map your subjects first.
            </p>
          ) : (
            <div className="grid gap-4">
              {assignmentError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                  {assignmentError}
                </p>
              )}
              <Select
                label="Subject"
                value={`${assignmentTarget.classId}|${assignmentTarget.subjectId}|${assignmentTarget.sectionId ?? ""}`}
                onChange={(event) => {
                  const [classId, subjectId, sectionId] = event.target.value.split("|");
                  setAssignmentTarget({
                    classId,
                    subjectId,
                    sectionId: sectionId ?? "",
                  });
                }}
              >
                {subjectOptions.map((item) => (
                  <option
                    key={`${item.classId}-${item.subjectId}-${item.sectionId ?? "all"}`}
                    value={`${item.classId}|${item.subjectId ?? ""}|${item.sectionId ?? ""}`}
                  >
                    {item.className ?? "Class"} - {item.subjectName ?? "Subject"}{" "}
                    {item.sectionName ? `• ${item.sectionName}` : ""}
                  </option>
                ))}
              </Select>
              <Input
                label="Title"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
              />
              <Textarea
                label="Description"
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                rows={3}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Deadline"
                  type="date"
                  value={assignmentForm.dueAt}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueAt: e.target.value })}
                />
                <Input
                  label="Max Marks"
                  type="number"
                  value={assignmentForm.maxMarks}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, maxMarks: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500">Attachment</label>
                <input
                  type="file"
                  className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setAssignmentFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateAssignment} disabled={assignmentSaving}>
                  {assignmentSaving ? "Saving..." : "Create Assignment"}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          title="Upload Notes"
        >
          {subjectOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No subject assignments found. Please ask the admin to map your subjects first.
            </p>
          ) : (
            <div className="grid gap-4">
              {noteError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                  {noteError}
                </p>
              )}
              <Select
                label="Subject"
                value={`${noteTarget.classId}|${noteTarget.subjectId}|${noteTarget.sectionId ?? ""}`}
                onChange={(event) => {
                  const [classId, subjectId, sectionId] = event.target.value.split("|");
                  setNoteTarget({
                    classId,
                    subjectId,
                    sectionId: sectionId ?? "",
                  });
                }}
              >
                {subjectOptions.map((item) => (
                  <option
                    key={`${item.classId}-${item.subjectId}-${item.sectionId ?? "all"}-note`}
                    value={`${item.classId}|${item.subjectId ?? ""}|${item.sectionId ?? ""}`}
                  >
                    {item.className ?? "Class"} - {item.subjectName ?? "Subject"}{" "}
                    {item.sectionName ? `• ${item.sectionName}` : ""}
                  </option>
                ))}
              </Select>
              <Input
                label="Title"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
              />
              <Textarea
                label="Description"
                value={noteForm.description}
                onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                rows={3}
              />
              <div>
                <label className="text-xs font-semibold text-ink-500">File</label>
                <input
                  type="file"
                  className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateNote} disabled={noteSaving}>
                  {noteSaving ? "Saving..." : "Upload Notes"}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={showAnnouncementModal}
          onClose={() => setShowAnnouncementModal(false)}
          title="Post Announcement"
        >
          <div className="grid gap-4">
            {announcementError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                {announcementError}
              </p>
            )}
            <Input
              label="Title"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
            />
            <Textarea
              label="Content"
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={handleCreateAnnouncement} disabled={announcementSaving}>
                {announcementSaving ? "Posting..." : "Post Announcement"}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showSubmissionsModal}
          onClose={() => setShowSubmissionsModal(false)}
          title={selectedAssignmentForReview?.title ? `Submissions • ${selectedAssignmentForReview.title}` : "Submissions"}
          size="lg"
        >
          {submissionsError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              {submissionsError}
            </p>
          )}
          {submissionsLoading ? (
            <p className="text-sm text-slate-500">Loading submissions...</p>
          ) : submissionsData.length ? (
            <div className="grid gap-3">
              {submissionsData.map((submission: any) => (
                <div key={submission.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.student?.fullName ?? "Student"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "—"}
                      </p>
                    </div>
                    {submission.isLate && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                        Late
                      </span>
                    )}
                  </div>
                  {submission.submissionUrl && (
                    <div className="mt-2">
                      <SecureLink
                        fileUrl={submission.submissionUrl}
                        fileName="submission"
                        className="text-xs font-semibold text-blue-600"
                      >
                        View Submission
                      </SecureLink>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No submissions yet.</p>
          )}
        </Modal>

        {groupChatModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Classroom" subtitle="Subjects, assignments, notes, and teacher updates" />

      {isParent && (
        <Card>
          <Select
            label="Select Child"
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          >
            <option value="">Select student</option>
            {(parentProfile?.students ?? []).map((student: any) => (
              <option key={student.id} value={student.id}>
                {student.fullName ?? "Student"}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {studentLoading ? (
        <Card>
          <p className="text-sm text-ink-500">Loading subjects...</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjectCards.map((subject) => (
            <button
              key={subject.classSubjectId}
              type="button"
              onClick={() => setSelectedSubject(subject)}
              className={`rounded-2xl border p-4 text-left shadow-lg transition ${selectedSubject?.classSubjectId === subject.classSubjectId
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-white hover:shadow-xl"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                  {subject.teacherPhotoUrl ? (
                    <SecureImage
                      fileUrl={subject.teacherPhotoUrl}
                      alt={subject.teacherName ?? "Teacher"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                      {(subject.teacherName ?? "T").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{subject.subjectName ?? "Subject"}</p>
                  <p className="text-xs text-slate-500">{subject.teacherName ?? "Teacher"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{subject.totalAssignments ?? 0} Assignments</span>
                {(subject.pendingAssignments ?? 0) > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                    {subject.pendingAssignments} Pending
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedSubject && subjectLoading && (
        <Card>
          <p className="text-sm text-ink-500">Loading subject details...</p>
        </Card>
      )}

      {selectedSubject && subjectError && (
        <Card>
          <p className="text-sm text-rose-600">{subjectError}</p>
        </Card>
      )}

      {selectedSubject && subjectDetail && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-40 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-600 p-6 text-white">
              <h2 className="text-2xl font-bold">{subjectDetail.subjectName ?? "Subject"}</h2>
              <p className="text-sm opacity-90">{subjectDetail.className ?? "Class"}</p>
              <div className="absolute bottom-4 left-6 text-xs font-semibold">
                {subjectDetail.teacher?.fullName ?? "Teacher"}
              </div>
              {subjectDetail.chatRoomId && (
                <div className="absolute bottom-4 right-6">
                  <Button variant="secondary" onClick={() => handleOpenGroupChat(subjectDetail.chatRoomId)}>
                    Open Group Chat
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="sticky top-20 z-10 rounded-2xl bg-slate-50/90 p-2 backdrop-blur">
            <div className="flex flex-wrap gap-2">
              {["stream", "assignments", "notes"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStudentActiveTab(tab)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${studentActiveTab === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {tab === "stream" ? "Stream" : tab === "assignments" ? "Assignments" : "Notes"}
                </button>
              ))}
            </div>
          </div>

          {studentActiveTab === "stream" && (
            <div className="flex flex-col gap-3">
              {studentStreamItems.length ? (
                studentStreamItems.map((item: any) => (
                  <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl shadow p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-100">
                        {subjectDetail.teacher?.photoUrl ? (
                          <SecureImage
                            fileUrl={subjectDetail.teacher.photoUrl}
                            alt={subjectDetail.teacher?.fullName ?? "Teacher"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                            {(subjectDetail.teacher?.fullName ?? "T").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {subjectDetail.teacher?.fullName ?? "Teacher"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.type === "assignment"
                          ? "Assignment"
                          : item.type === "note"
                            ? "Note"
                            : "Announcement"}: {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                      )}
                      {item.dueAt && (
                        <p className="mt-2 text-xs text-slate-400">
                          Due: {new Date(item.dueAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No updates yet.</p>
              )}
            </div>
          )}

          {studentActiveTab === "assignments" && (
            <div className="flex flex-col gap-3">
              {(subjectDetail.assignments ?? []).length ? (
                subjectDetail.assignments.map((assignment: any) => {
                  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : null;
                  const deadlineSoon =
                    dueAt && dueAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
                  const deadlineCrossed = dueAt ? Date.now() > dueAt.getTime() : false;
                  const status = assignment.submissionStatus ?? "PENDING";
                  return (
                    <div key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{assignment.title}</p>
                          <p className="text-xs text-slate-400">
                            Due: {dueAt ? dueAt.toLocaleString() : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {deadlineSoon && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                              Deadline soon
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {status}
                          </span>
                        </div>
                      </div>
                      {assignment.description && (
                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                          {assignment.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        {Array.isArray(assignment.attachments) && assignment.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {assignment.attachments.map((file: any, idx: number) => (
                              <SecureLink
                                key={`${file.fileUrl ?? file}-${idx}`}
                                fileUrl={file.fileUrl ?? file}
                                fileName={file.fileName ?? getFileName(file.fileUrl ?? file) ?? "Attachment"}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-600"
                              >
                                <span>{getFileIcon(file.fileUrl ?? file)}</span>
                                <span>{file.fileName ?? getFileName(file.fileUrl ?? file) ?? "Attachment"}</span>
                              </SecureLink>
                            ))}
                          </div>
                        )}
                        {status === "PENDING" && !deadlineCrossed && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedAssignmentForSubmit(assignment);
                              setShowSubmissionModal(true);
                            }}
                          >
                            Upload Assignment
                          </Button>
                        )}
                        {assignment.submission?.submissionUrl && (
                          <SecureLink
                            fileUrl={assignment.submission.submissionUrl}
                            fileName="submission"
                            className="text-xs font-semibold text-blue-600"
                          >
                            View Submission
                          </SecureLink>
                        )}
                        {deadlineCrossed && (
                          <span className="text-xs font-semibold text-rose-500">Deadline crossed</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No assignments yet.</p>
              )}
            </div>
          )}

          {studentActiveTab === "notes" && (
            <div className="flex flex-col gap-3">
              {(subjectDetail.notes ?? []).length ? (
                subjectDetail.notes.map((note: any) => (
                  <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{note.title}</p>
                    {note.description && (
                      <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{note.description}</p>
                    )}
                    {note.fileUrl && (
                      <div className="mt-3">
                        <SecureLink fileUrl={note.fileUrl} fileName={note.title ?? "note"} className="inline-flex">
                          <Button variant="secondary">Download</Button>
                        </SecureLink>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No notes yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={showSubmissionModal}
        onClose={() => setShowSubmissionModal(false)}
        title="Upload Assignment"
      >
        <div className="grid gap-4">
          {submissionError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              {submissionError}
            </p>
          )}
          <p className="text-sm text-slate-600">
            {selectedAssignmentForSubmit?.title ?? "Assignment"}
          </p>
          <div>
            <label className="text-xs font-semibold text-ink-500">File</label>
            <input
              type="file"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setSubmissionFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmitAssignment} disabled={submissionSaving}>
              {submissionSaving ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </Modal>

      {groupChatModal}
    </div>
  );
}
