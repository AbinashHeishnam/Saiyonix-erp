import api from "./client";

export type TeacherIdCardData = {
  school: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  teacher: {
    id: string;
    fullName: string;
    employeeId: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
  };
};

export async function getAdminTeacherIdCards() {
  const res = await api.get("/admin/teachers/id-cards");
  return (res.data?.data ?? res.data) as TeacherIdCardData[];
}

export async function getTeacherIdCard() {
  const res = await api.get("/teacher/id-card");
  return (res.data?.data ?? res.data) as TeacherIdCardData;
}

export async function updateTeacherIdCardDetails(teacherId: string, payload: {
  fullName?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const res = await api.patch(`/admin/teachers/${teacherId}/id-card/details`, payload);
  return res.data?.data ?? res.data;
}

export async function updateTeacherIdCardPhoto(teacherId: string, file: File) {
  const form = new FormData();
  form.append("photo", file);
  const res = await api.post(`/admin/teachers/${teacherId}/id-card/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data ?? res.data;
}
