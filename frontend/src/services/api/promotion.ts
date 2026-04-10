import api from "./client";

export type PromotionStatus =
  | "ELIGIBLE"
  | "FAILED"
  | "UNDER_CONSIDERATION"
  | "PROMOTED"
  | "NOT_PROMOTED";

export type PromotionPreviewRecord = {
  id: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  percentage?: number | null;
  rank?: number | null;
  attendancePercent?: number | null;
  failedSubjects?: number | null;
  passedSubjects?: number | null;
  totalSubjects?: number | null;
  status?: PromotionStatus;
  isManuallyPromoted?: boolean;
  student?: { id?: string; fullName?: string };
  class?: { id?: string; className?: string };
  section?: { id?: string; sectionName?: string };
};

export async function getPromotionPreview(
  params?: {
    fromAcademicYearId?: string;
    toAcademicYearId?: string;
    promoteBy?: "RANK" | "PERCENTAGE";
  }
) {
  const res = await api.get("/promotion/preview", {
    params: params && Object.values(params).some((v) => v) ? params : undefined,
  });
  return res.data?.data ?? res.data;
}

export async function generatePromotion(payload: {
  academicYearId: string;
  examId: string;
}) {
  const res = await api.post("/promotion/generate", payload);
  return res.data?.data ?? res.data;
}

export async function publishPromotion(
  params?: {
    fromAcademicYearId?: string;
    toAcademicYearId?: string;
    promoteBy?: "RANK" | "PERCENTAGE";
  }
) {
  const res = await api.post("/promotion/publish", params ?? undefined);
  return res.data?.data ?? res.data;
}

export async function applyFinalPromotion(
  params?: {
    fromAcademicYearId?: string;
    toAcademicYearId?: string;
    promoteBy?: "RANK" | "PERCENTAGE";
  }
) {
  const res = await api.post("/promotion/apply-final", params ?? undefined);
  return res.data?.data ?? res.data;
}

export async function getRollNumberAssignmentStatus(academicYearId: string) {
  const res = await api.get("/promotion/assign-roll-numbers/status", {
    params: { academicYearId },
  });
  return res.data?.data ?? res.data;
}

export async function assignRollNumbers(academicYearId: string) {
  const res = await api.post("/promotion/assign-roll-numbers", { academicYearId });
  return res.data?.data ?? res.data;
}

export async function updateManualPromotion(payload: {
  promotionRecordId: string;
  isManuallyPromoted: boolean;
}) {
  if (!payload.isManuallyPromoted) {
    return null;
  }
  const res = await api.post("/promotion/override", {
    promotionRecordId: payload.promotionRecordId,
  });
  return res.data?.data ?? res.data;
}

export async function updateManualPromotions(
  payload:
    | {
        updates: Array<{
          promotionRecordId?: string;
          studentId?: string;
          isManuallyPromoted: boolean;
        }>;
      }
    | Array<{
        promotionRecordId?: string;
        studentId?: string;
        isManuallyPromoted: boolean;
      }>
) {
  const updates = Array.isArray(payload) ? payload : payload.updates;
  const tasks = updates
    .filter((u) => u.promotionRecordId && u.isManuallyPromoted)
    .map((u) => api.post("/promotion/override", { promotionRecordId: u.promotionRecordId }));
  const res = await Promise.all(tasks);
  return res.map((r) => r.data?.data ?? r.data);
}

export async function getTeacherPromotionList() {
  const res = await api.get("/promotion/teacher");
  return res.data?.data ?? res.data;
}

export async function getStudentPromotionStatus() {
  const res = await api.get("/promotion/student");
  return res.data?.data ?? res.data;
}

export async function getParentPromotionView() {
  const res = await api.get("/promotion/parent");
  return res.data?.data ?? res.data;
}
