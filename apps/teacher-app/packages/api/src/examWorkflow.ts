import api from "./client";

export async function getTeacherAssignedExams() {
  const res = await api.get("/teacher/exam/assigned");
  return res.data?.data ?? res.data;
}

export async function getMarksEntryMatrix(params: {
  examId: string;
  classId: string;
  sectionId: string;
}) {
  const res = await api.get("/teacher/exam/marks-entry/all", { params });
  return res.data?.data ?? res.data;
}

export async function submitExamMarksBulk(payload: {
  examId: string;
  classId: string;
  sectionId: string;
  subjects: Array<{
    subjectId: string;
    totalMarks: number;
    passMarks: number;
    items: Array<{ studentId: string; marksObtained: number; isAbsent?: boolean }>;
  }>;
}) {
  const res = await api.post("/teacher/exam/submit-marks-bulk", payload);
  return res.data?.data ?? res.data;
}

export async function getTeacherMyClassAnalytics(params: {
  examId: string;
  marksThreshold?: number;
  attendanceThreshold?: number;
  teacherId?: string;
}) {
  const res = await api.get("/teacher/analytics/my-class", { params });
  return res.data?.data ?? res.data;
}
