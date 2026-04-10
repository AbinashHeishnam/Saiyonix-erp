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

type TeacherProfile = {
  id: string;
  fullName: string;
  employeeId?: string | null;
  designation?: string | null;
  department?: string | null;
  joiningDate?: string | null;
  status?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  qualification?: string | null;
  totalExperience?: number | null;
  academicExperience?: number | null;
  industryExperience?: number | null;
  researchInterest?: string | null;
  nationalPublications?: number | null;
  internationalPublications?: number | null;
  bookChapters?: number | null;
  projects?: number | null;
  teacherProfile?: {
    qualification?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    emergencyContactMobile?: string | null;
  } | null;
};

type ProfileResponse = {
  teacher: TeacherProfile;
  profileCompletion: number;
};

type FormState = {
  designation: string;
  qualification: string;
  totalExperience: string;
  academicExperience: string;
  industryExperience: string;
  researchInterest: string;
  nationalPublications: string;
  internationalPublications: string;
  bookChapters: string;
  projects: string;
};

const emptyForm: FormState = {
  designation: "",
  qualification: "",
  totalExperience: "",
  academicExperience: "",
  industryExperience: "",
  researchInterest: "",
  nationalPublications: "",
  internationalPublications: "",
  bookChapters: "",
  projects: "",
};

function getCompletionFromForm(form: FormState) {
  const fields = [
    form.designation,
    form.qualification,
    form.totalExperience,
    form.academicExperience,
    form.industryExperience,
    form.researchInterest,
    form.nationalPublications,
    form.internationalPublications,
    form.bookChapters,
    form.projects,
  ];
  const filled = fields.filter((value) => value.trim().length > 0).length;
  return Math.round((filled / 9) * 100);
}

function progressColor(completion: number) {
  if (completion <= 30) return "bg-sunrise-500";
  if (completion <= 70) return "bg-sunrise-300";
  return "bg-jade-500";
}

export default function TeacherProfilePage() {
  const params = useParams();
  const { role } = useAuth();
  const teacherId = params.id ?? null;
  const isAdminView = Boolean(teacherId);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { data, loading, error: loadError, refresh } = useAsync(async () => {
    const res = await api.get<ProfileResponse | { data: ProfileResponse }>("/teacher/profile", {
      params: isAdminView ? { teacherId } : undefined,
    });
    return "data" in res.data ? res.data.data : res.data;
  }, [teacherId, isAdminView]);

  useEffect(() => {
    if (!data?.teacher) return;
    const t = data.teacher;
    setForm({
      designation: t.designation ?? "",
      qualification: t.qualification ?? "",
      totalExperience: t.totalExperience != null ? String(t.totalExperience) : "",
      academicExperience: t.academicExperience != null ? String(t.academicExperience) : "",
      industryExperience: t.industryExperience != null ? String(t.industryExperience) : "",
      researchInterest: t.researchInterest ?? "",
      nationalPublications:
        t.nationalPublications != null ? String(t.nationalPublications) : "",
      internationalPublications:
        t.internationalPublications != null ? String(t.internationalPublications) : "",
      bookChapters: t.bookChapters != null ? String(t.bookChapters) : "",
      projects: t.projects != null ? String(t.projects) : "",
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
        ...(isAdminView ? { teacherId } : {}),
        designation: form.designation,
        qualification: form.qualification,
        totalExperience: form.totalExperience,
        academicExperience: form.academicExperience,
        industryExperience: form.industryExperience,
        researchInterest: form.researchInterest,
        nationalPublications: form.nationalPublications,
        internationalPublications: form.internationalPublications,
        bookChapters: form.bookChapters,
        projects: form.projects,
      };
      await api.patch("/teacher/profile", payload);
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

  const headerTitle = isAdminView ? "Teacher Profile" : "My Profile";
  const headerSubtitle = isAdminView
    ? "Update academic credentials, experience, and research interests."
    : "Complete your professional profile for better visibility.";

  const profilePhoto =
    data?.teacher?.photoUrl ?? data?.teacher?.teacherProfile?.photoUrl ?? null;

  const handlePhotoUpload = async (file?: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      if (isAdminView && teacherId) {
        await api.post(`/admin/teacher/${teacherId}/photo`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/teacher/profile/photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      refresh();
    } catch (err: unknown) {
      setPhotoError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to upload photo"
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader title={headerTitle} subtitle={headerSubtitle} />

      <Card title="Profile Photo">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
            {profilePhoto ? (
              <SecureImage
                fileUrl={profilePhoto}
                alt={data?.teacher?.fullName ?? "Teacher"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
                {(data?.teacher?.fullName ?? "T").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex items-center rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  disabled={photoUploading}
                />
                {photoUploading ? "Uploading..." : "Upload Photo"}
              </label>
              {photoError && <p className="text-xs text-sunrise-600">{photoError}</p>}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Basic Info">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Full Name</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.fullName ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Employee ID</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.employeeId ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Department</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.department ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Joining Date</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.joiningDate ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Status</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.status ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Gender</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.gender ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Contact & Address">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Phone</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.phone ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Email</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.email ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Address (Teacher)</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.address ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Address (Profile)</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.teacherProfile?.address ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Emergency Contact Mobile</p><p className="text-sm font-medium text-ink-800">{data?.teacher?.teacherProfile?.emergencyContactMobile ?? "—"}</p></div>
        </div>
      </Card>
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-700">
                Profile Completion
              </p>
              <p className="text-xs text-ink-500">
                {isAdminView && data?.teacher?.fullName
                  ? `Editing ${data.teacher.fullName}`
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
            label="Designation"
            value={form.designation}
            onChange={(e) => handleChange("designation")(e.target.value)}
            placeholder="e.g., Senior Mathematics Teacher"
          />
          <Input
            label="Qualification"
            value={form.qualification}
            onChange={(e) => handleChange("qualification")(e.target.value)}
            placeholder="e.g., M.Ed, Ph.D"
          />
          <Input
            label="Total Experience (Years)"
            type="number"
            min={0}
            value={form.totalExperience}
            onChange={(e) => handleChange("totalExperience")(e.target.value)}
          />
          <Input
            label="Academic Experience (Years)"
            type="number"
            min={0}
            value={form.academicExperience}
            onChange={(e) => handleChange("academicExperience")(e.target.value)}
          />
          <Input
            label="Industry Experience (Years)"
            type="number"
            min={0}
            value={form.industryExperience}
            onChange={(e) => handleChange("industryExperience")(e.target.value)}
          />
          <Input
            label="National Publications"
            type="number"
            min={0}
            value={form.nationalPublications}
            onChange={(e) => handleChange("nationalPublications")(e.target.value)}
          />
          <Input
            label="International Publications"
            type="number"
            min={0}
            value={form.internationalPublications}
            onChange={(e) => handleChange("internationalPublications")(e.target.value)}
          />
          <Input
            label="Book Chapters"
            type="number"
            min={0}
            value={form.bookChapters}
            onChange={(e) => handleChange("bookChapters")(e.target.value)}
          />
          <Input
            label="Projects"
            type="number"
            min={0}
            value={form.projects}
            onChange={(e) => handleChange("projects")(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Research Interest"
            value={form.researchInterest}
            onChange={(e) => handleChange("researchInterest")(e.target.value)}
            placeholder="Share your focus areas, papers, or ongoing research."
          />
        </div>
        {(error || loadError) && (
          <p className="mt-3 text-sm text-sunrise-600">
            {error ?? loadError ?? "Failed to load profile."}
          </p>
        )}
        {message && <p className="mt-3 text-sm text-jade-600">{message}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
          {role === "ADMIN" && (
            <p className="text-xs text-ink-400">
              Admin updates apply immediately to the selected teacher.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
