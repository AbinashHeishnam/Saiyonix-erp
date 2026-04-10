import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Textarea from "../../components/Textarea";
import SecureImage from "../../components/SecureImage";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";
import { useAuth } from "../../contexts/AuthContext";

type ParentProfile = {
  id: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  relationToStudent?: string | null;
};

type StudentProfile = {
  profilePhotoUrl?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactMobile?: string | null;
  previousSchool?: string | null;
  medicalInfo?: unknown | null;
};

type LinkedStudent = {
  id: string;
  fullName: string | null;
  registrationNumber?: string | null;
  admissionNumber?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  status?: string | null;
  profile?: StudentProfile | null;
};

type ProfileResponse = {
  parent: ParentProfile;
  students: LinkedStudent[];
  completionPercentage: number;
};

type FormState = {
  fullName: string;
  mobile: string;
  email: string;
  relationToStudent: string;
  address: string;
  emergencyContactName: string;
  emergencyContactMobile: string;
  previousSchool: string;
  medicalInfo: string;
};

const emptyForm: FormState = {
  fullName: "",
  mobile: "",
  email: "",
  relationToStudent: "",
  address: "",
  emergencyContactName: "",
  emergencyContactMobile: "",
  previousSchool: "",
  medicalInfo: "",
};

function getCompletionFromForm(form: FormState) {
  const fields = [
    form.fullName,
    form.mobile,
    form.email,
    form.relationToStudent,
    form.address,
    form.emergencyContactName,
    form.emergencyContactMobile,
  ];
  const filled = fields.filter((value) => value.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

function progressColor(completion: number) {
  if (completion <= 30) return "bg-sunrise-500";
  if (completion <= 70) return "bg-sunrise-300";
  return "bg-jade-500";
}

export default function ParentProfilePage() {
  const params = useParams();
  const { role } = useAuth();
  const parentId = params.id ?? null;
  const isAdminView = Boolean(parentId) && role !== "PARENT";

  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const { data, loading, error: loadError, refresh } = useAsync(async () => {
    if (isAdminView && parentId) {
      const res = await api.get<ProfileResponse | { data: ProfileResponse }>(`/admin/parent/${parentId}`);
      return "data" in res.data ? res.data.data : res.data;
    }
    const res = await api.get<ProfileResponse | { data: ProfileResponse }>("/parent/profile");
    return "data" in res.data ? res.data.data : res.data;
  }, [parentId, isAdminView]);

  useEffect(() => {
    if (!data?.parent) return;
    const parent = data.parent;
    const studentProfile = data.students?.[0]?.profile ?? null;
    setForm({
      fullName: parent.fullName ?? "",
      mobile: parent.mobile ?? "",
      email: parent.email ?? "",
      relationToStudent: parent.relationToStudent ?? "",
      address: studentProfile?.address ?? "",
      emergencyContactName: studentProfile?.emergencyContactName ?? "",
      emergencyContactMobile: studentProfile?.emergencyContactMobile ?? "",
      previousSchool: studentProfile?.previousSchool ?? "",
      medicalInfo:
        typeof studentProfile?.medicalInfo === "string"
          ? studentProfile?.medicalInfo
          : studentProfile?.medicalInfo
          ? JSON.stringify(studentProfile.medicalInfo)
          : "",
    });
  }, [data]);

  const completion = useMemo(() => getCompletionFromForm(form), [form]);

  const handleChange = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email,
        relationToStudent: form.relationToStudent,
        address: form.address,
        emergencyContactName: form.emergencyContactName,
        emergencyContactMobile: form.emergencyContactMobile,
        previousSchool: form.previousSchool,
        medicalInfo: form.medicalInfo,
      };

      if (isAdminView && parentId) {
        await api.put(`/admin/parent/${parentId}`, payload);
      } else {
        await api.put("/parent/profile", payload);
      }
      setMessage("Profile saved successfully.");
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = isAdminView ? "Parent Profile" : "My Profile";
  const headerSubtitle = isAdminView
    ? "Update parent and student profile information."
    : "Keep parent and student details up to date.";
  const canUploadStudentPhoto = !isAdminView && role === "PARENT";

  const handleStudentPhotoUpload = async (studentId: string, file?: File | null) => {
    if (!file) return;
    setUploadingStudentId(studentId);
    setUploadErrors((prev) => ({ ...prev, [studentId]: "" }));
    try {
      const formData = new FormData();
      formData.append("photo", file);
      await api.post(`/parent/student/${studentId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to upload photo";
      setUploadErrors((prev) => ({ ...prev, [studentId]: message }));
    } finally {
      setUploadingStudentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={headerTitle} subtitle={headerSubtitle} />
        <Card>
          <p className="text-sm text-ink-500">Loading profile...</p>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <p className="text-sm text-sunrise-600">{loadError}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title={headerTitle} subtitle={headerSubtitle} />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-700">Profile Completion</p>
              <p className="text-xs text-ink-500">
                {isAdminView && data?.parent?.fullName
                  ? `Editing ${data.parent.fullName}`
                  : "Keep your profile up to date."}
              </p>
            </div>
            <div className="text-sm font-semibold text-ink-700">{completion}%</div>
          </div>
          <div className="h-2 w-full rounded-full bg-ink-100">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${progressColor(
                completion
              )}`}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Input
            label="Parent Name"
            value={form.fullName}
            onChange={(e) => handleChange("fullName")(e.target.value)}
            placeholder="e.g., Ramesh Devi"
          />
          <Input
            label="Mobile"
            value={form.mobile}
            onChange={(e) => handleChange("mobile")(e.target.value)}
            placeholder="e.g., 9876543210"
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => handleChange("email")(e.target.value)}
            placeholder="e.g., parent@example.com"
          />
          <Input
            label="Relation to Student"
            value={form.relationToStudent}
            onChange={(e) => handleChange("relationToStudent")(e.target.value)}
            placeholder="e.g., Father"
          />
        </div>
      </Card>

      <Card title="Linked Students">
        {data?.students?.length ? (
          <div className="grid grid-cols-1 gap-4">
            {data.students.map((student) => (
              <div key={student.id} className="rounded-2xl border border-ink-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
                    {student.profile?.profilePhotoUrl ? (
                      <SecureImage
                        fileUrl={student.profile.profilePhotoUrl}
                        alt={student.fullName ?? "Student"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-ink-400">
                        {(student.fullName ?? "S").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-800">
                      {student.fullName ?? "Student"}
                    </p>
                    <p className="text-xs text-ink-400">
                      Reg. No: {student.registrationNumber ?? "—"} • Admission No:{" "}
                      {student.admissionNumber ?? "—"}
                    </p>
                    {canUploadStudentPhoto && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="inline-flex items-center rounded-lg bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-white cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleStudentPhotoUpload(student.id, e.target.files?.[0])}
                            disabled={uploadingStudentId === student.id}
                          />
                          {uploadingStudentId === student.id ? "Uploading..." : "Upload Photo"}
                        </label>
                        {uploadErrors[student.id] && (
                          <span className="text-xs text-sunrise-600">{uploadErrors[student.id]}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><p className="text-xs text-ink-400">Status</p><p className="text-sm font-medium text-ink-800">{student.status ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Gender</p><p className="text-sm font-medium text-ink-800">{student.gender ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Date of Birth</p><p className="text-sm font-medium text-ink-800">{student.dateOfBirth ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Blood Group</p><p className="text-sm font-medium text-ink-800">{student.bloodGroup ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Address</p><p className="text-sm font-medium text-ink-800">{student.profile?.address ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Emergency Contact</p><p className="text-sm font-medium text-ink-800">{student.profile?.emergencyContactName ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Emergency Contact Mobile</p><p className="text-sm font-medium text-ink-800">{student.profile?.emergencyContactMobile ?? "—"}</p></div>
                  <div><p className="text-xs text-ink-400">Previous School</p><p className="text-sm font-medium text-ink-800">{student.profile?.previousSchool ?? "—"}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-ink-400">Medical Info</p><p className="text-sm font-medium text-ink-800 whitespace-pre-wrap">
                    {student.profile?.medicalInfo == null
                      ? "—"
                      : typeof student.profile.medicalInfo === "string"
                      ? student.profile.medicalInfo
                      : JSON.stringify(student.profile.medicalInfo)}
                  </p></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No linked students found.</p>
        )}
      </Card>

      <Card title="Student Profile (Shared)">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => handleChange("address")(e.target.value)}
            placeholder="Enter current address"
          />
          <Input
            label="Emergency Contact Name"
            value={form.emergencyContactName}
            onChange={(e) => handleChange("emergencyContactName")(e.target.value)}
            placeholder="e.g., Neha Singh"
          />
          <Input
            label="Emergency Contact Mobile"
            value={form.emergencyContactMobile}
            onChange={(e) => handleChange("emergencyContactMobile")(e.target.value)}
            placeholder="e.g., 9876543210"
          />
          <Input
            label="Previous School"
            value={form.previousSchool}
            onChange={(e) => handleChange("previousSchool")(e.target.value)}
            placeholder="Optional"
          />
          <div className="lg:col-span-2">
            <Textarea
              label="Medical Information"
              value={form.medicalInfo}
              onChange={(e) => handleChange("medicalInfo")(e.target.value)}
              placeholder="Allergies, conditions, or notes"
              rows={4}
            />
          </div>
        </div>
      </Card>

      {(message || error) && (
        <Card>
          {message && <p className="text-sm text-jade-600">{message}</p>}
          {error && <p className="text-sm text-sunrise-600">{error}</p>}
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
