import api from "./client";

export type StudentIdCardData = {
  school: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  student: {
    id: string;
    fullName: string;
    admissionNumber: string | null;
    dateOfBirth: string;
    bloodGroup: string | null;
    photoUrl: string | null;
    address: string | null;
  };
  className: string | null;
  sectionName: string | null;
  classId: string | null;
  sectionId: string | null;
  parentName: string | null;
  parentPhone: string | null;
  rollNumber: number | null;
  idCardLocks?: { nameLocked: boolean; photoLocked: boolean };
};

export async function updateStudentIdCardName(studentId: string, fullName: string) {
  const res = await api.patch(`/admin/students/${studentId}/id-card`, { fullName });
  return res.data?.data ?? res.data;
}

export async function updateStudentIdCardPhoto(studentId: string, file: File) {
  const form = new FormData();
  form.append("photo", file);
  const res = await api.post(`/admin/students/${studentId}/id-card/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data ?? res.data;
}

export async function updateStudentIdCardDetails(studentId: string, payload: {
  fullName?: string;
  admissionNumber?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  classId?: string;
  sectionId?: string;
  rollNumber?: number;
}) {
  const res = await api.patch(`/admin/students/${studentId}/id-card/details`, payload);
  return res.data?.data ?? res.data;
}

export async function getAdminStudentIdCards(params?: { academicYearId?: string }) {
  const res = await api.get("/admin/students/id-cards", { params });
  return (res.data?.data ?? res.data) as StudentIdCardData[];
}

export async function getStudentIdCard() {
  const res = await api.get("/student/id-card");
  return (res.data?.data ?? res.data) as StudentIdCardData;
}

export async function getParentChildIdCard() {
  const res = await api.get("/parent/child/id-card");
  return (res.data?.data ?? res.data) as StudentIdCardData;
}
