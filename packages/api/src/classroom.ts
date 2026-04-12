import api from "./client";

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

function normalizeTeacherPayload(payload: any): TeacherClassroomItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.subjects)) return payload.subjects;
  return [];
}

export async function getTeacherClassroom() {
  const res = await api.get("/classroom/teacher/me");
  const payload = res.data?.data ?? res.data;
  const baseItems = normalizeTeacherPayload(payload);

  if (Array.isArray(baseItems) && baseItems.length) {
    return baseItems.map((item) => ({ ...item, kind: "subject" as const }));
  }

  const profileRes = await api.get("/teacher/profile");
  const profilePayload = profileRes.data?.data ?? profileRes.data;
  const teacher = profilePayload?.teacher ?? profilePayload ?? null;
  if (!teacher?.id) return [];

  const sectionsRes = await api.get("/sections", { params: { limit: 200 } });
  const sectionsPayload =
    sectionsRes.data?.data ?? sectionsRes.data?.items ?? sectionsRes.data ?? [];
  const sections = Array.isArray(sectionsPayload) ? sectionsPayload : [];

  return sections
    .filter((section: any) => section.classTeacherId && section.classTeacherId === teacher.id)
    .map(
      (section: any): TeacherClassroomItem => ({
        kind: "classTeacher",
        classId: section.classId,
        className: section.class?.className ?? null,
        sectionId: section.id,
        sectionName: section.sectionName ?? null,
        subjectName: "Class Teacher",
        classSubjectId: null,
      })
    );
}

export async function getStudentClassroom(studentId?: string) {
  const res = await api.get("/classroom/student/me", {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function getSectionClassroom(sectionId: string) {
  const res = await api.get(`/classroom/section/${sectionId}`);
  return res.data?.data ?? res.data;
}

export async function getSubjectClassroom(classSubjectId: string, studentId?: string) {
  const res = await api.get(`/classroom/subject/${classSubjectId}` , {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function createClassroomAssignment(payload: {
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  title: string;
  description?: string | null;
  deadline: string | Date;
  maxMarks?: number | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileKey?: string | null;
}) {
  const res = await api.post("/classroom/assignment/create", payload);
  return res.data?.data ?? res.data;
}

export async function createClassroomNote(payload: {
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
}) {
  const res = await api.post("/classroom/notes/create", payload);
  return res.data?.data ?? res.data;
}

export async function createClassroomAnnouncement(payload: {
  classId: string;
  sectionId?: string | null;
  title: string;
  content: string;
}) {
  const res = await api.post("/classroom/announcement/create", payload);
  return res.data?.data ?? res.data;
}

export async function getClassroomChatRoomMessages(roomId: string, params?: { limit?: number; before?: string }) {
  const res = await api.get(`/classroom/chat/room/${roomId}`, { params });
  return res.data?.data ?? res.data;
}

export async function getAssignmentSubmissions(assignmentId: string, params?: { page?: number; limit?: number }) {
  const res = await api.get(`/assignments/${assignmentId}/submissions`, { params });
  return res.data?.data ?? res.data;
}
