import api from "./client";

export async function getTeacherClassroom() {
  const res = await api.get("/classroom/teacher/me");
  return res.data?.data ?? res.data;
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
  const res = await api.get(`/classroom/subject/${classSubjectId}`, {
    params: studentId ? { studentId } : undefined,
  });
  return res.data?.data ?? res.data;
}
