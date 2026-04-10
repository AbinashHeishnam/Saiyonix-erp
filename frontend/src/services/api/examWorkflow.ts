import api from "./client";

export async function getTeacherAssignedExams() {
  const res = await api.get("/teacher/exam/assigned");
  return res.data?.data ?? res.data;
}

export async function getMarksEntryContext(params: {
  examId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
}) {
  const res = await api.get("/teacher/exam/marks-entry", { params });
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

export async function submitExamMarks(payload: {
  examId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  totalMarks: number;
  passMarks: number;
  items: Array<{ studentId: string; marksObtained: number; isAbsent?: boolean }>;
}) {
  const res = await api.post("/teacher/exam/submit-marks", payload);
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

export async function getExamResultStatus(examId: string) {
  const res = await api.get(`/admin/exam/${examId}/result-status`);
  return res.data?.data ?? res.data;
}

export async function publishExamResult(examId: string) {
  const res = await api.patch(`/admin/exam/publish-result/${examId}`);
  return res.data?.data ?? res.data;
}

export async function getExamResultMe(examId: string) {
  const res = await api.get("/exam/result/me", { params: { examId } });
  return res.data?.data ?? res.data;
}

export async function requestResultRecheck(payload: {
  examId: string;
  subjectId: string;
  reason: string;
  studentId?: string;
}) {
  const res = await api.post("/student/result/recheck", payload);
  return res.data?.data ?? res.data;
}

export async function listResultRecheckComplaints(category = "RESULT_RECHECK") {
  const res = await api.get("/admin/complaints", { params: { category } });
  return res.data?.data ?? res.data;
}

export async function getTeacherExamAnalytics(params: {
  examId: string;
  sectionId: string;
  marksThreshold?: number;
  attendanceThreshold?: number;
}) {
  const res = await api.get("/teacher/exam/analytics", { params });
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
