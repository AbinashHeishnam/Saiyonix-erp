import api from "./client";

export type ClassTeacherInfo = {
  teacherId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  photoUrl: string | null;
};

export async function getClassTeacher(studentId?: string) {
  const res = await api.get("/students/class-teacher", {
    params: studentId ? { studentId } : undefined,
  });
  const payload = res.data?.data ?? res.data;
  return payload?.teacher as ClassTeacherInfo;
}
