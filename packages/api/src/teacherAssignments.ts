import api from "./client";

export async function getTeacherSubjectClasses(params: {
  teacherId: string;
  academicYearId?: string;
  page?: number;
  limit?: number;
}) {
  const res = await api.get("/teacher-subject-classes", {
    params: {
      teacherId: params.teacherId,
      academicYearId: params.academicYearId,
      page: params.page ?? 1,
      limit: params.limit ?? 200,
    },
  });
  return res.data?.data ?? res.data;
}
