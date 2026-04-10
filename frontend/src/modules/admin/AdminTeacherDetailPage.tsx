import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Button from "../../components/Button";
import Card from "../../components/Card";
import ConfirmDialog from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";

type TeacherDetails = {
  teacher: {
    id: string;
    fullName: string;
    employeeId?: string;
    designation?: string | null;
    department?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    status?: string | null;
    gender?: string | null;
    joiningDate?: string | null;
    photoUrl?: string | null;
  };
  user?: {
    id: string;
    email?: string | null;
    mobile?: string | null;
    role?: { roleType?: string | null; name?: string | null } | null;
    isActive?: boolean;
  } | null;
  profile?: Record<string, unknown>;
  teacherProfile?: {
    qualification?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    emergencyContactMobile?: string | null;
  } | null;
  assignedClasses: Array<{
    sectionId: string;
    sectionName: string;
    classId: string;
    className?: string | null;
  }>;
  subjects: Array<{
    id: string;
    className?: string | null;
    sectionName?: string | null;
    subjectName?: string | null;
  }>;
};

export default function AdminTeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, loading, error, setData, refresh } = useAsync(async () => {
    const res = await api.get(`/admin/teacher/${id}`);
    return res.data?.data ?? res.data;
  }, [id]);

  const details = data as TeacherDetails | undefined;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    setPhotoUrl(details?.teacher.photoUrl ?? details?.teacherProfile?.photoUrl ?? null);
  }, [details?.teacher.photoUrl, details?.teacherProfile?.photoUrl]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-ink-500">Loading teacher details...</p>
      </Card>
    );
  }

  if (error || !details) {
    return (
      <Card>
        <p className="text-sm text-sunrise-600">{error ?? "Teacher not found"}</p>
      </Card>
    );
  }

  const profile = (details.profile ?? {}) as {
    qualification?: string | null;
    totalExperience?: number | null;
    academicExperience?: number | null;
    industryExperience?: number | null;
    researchInterest?: string | null;
    nationalPublications?: number | null;
    internationalPublications?: number | null;
    bookChapters?: number | null;
    projects?: number | null;
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res: any = await safeApiCall(
        () => api.post(`/admin/teacher/${id}/photo`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }),
        { loading: "Uploading photo...", success: "Photo uploaded successfully" }
      );

      const updatedPhotoUrl = res.data?.data?.photoUrl ?? res.data?.photoUrl ?? null;
      setPhotoUrl(updatedPhotoUrl);
      setData({
        ...details,
        teacher: { ...details.teacher, photoUrl: updatedPhotoUrl },
      } as TeacherDetails);
      await refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Unable to upload photo";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Teacher Details"
        subtitle={details.teacher.fullName ?? "Teacher"}
      />

      <Card title="Profile Photo">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-40 w-40 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
              {photoUrl ? (
                <SecureImage fileUrl={photoUrl} alt={details.teacher.fullName ?? "Teacher"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-ink-400">
                  {(details.teacher.fullName ?? "T").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              {photoUrl && (
                <SecureLink
                  fileUrl={photoUrl}
                  fileName={`${details.teacher.fullName ?? "Teacher"}-photo`}
                  className="mt-2 inline-flex text-xs font-semibold text-ink-600 hover:text-ink-800"
                >
                  View full image
                </SecureLink>
              )}
              {uploadError && <p className="text-xs text-sunrise-600 mt-1">{uploadError}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.currentTarget.value = "";
              }}
            />
            <Button
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Photo
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Basic Info">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Employee ID</p><p className="text-sm font-medium text-ink-800">{details.teacher.employeeId ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Designation</p><p className="text-sm font-medium text-ink-800">{details.teacher.designation ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Department</p><p className="text-sm font-medium text-ink-800">{details.teacher.department ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Status</p><p className="text-sm font-medium text-ink-800">{details.teacher.status ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Gender</p><p className="text-sm font-medium text-ink-800">{details.teacher.gender ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Joining Date</p><p className="text-sm font-medium text-ink-800">{details.teacher.joiningDate ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Phone</p><p className="text-sm font-medium text-ink-800">{details.teacher.phone ?? details.user?.mobile ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Email</p><p className="text-sm font-medium text-ink-800">{details.teacher.email ?? details.user?.email ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Address (Teacher)</p><p className="text-sm font-medium text-ink-800">{details.teacher.address ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Address (Profile)</p><p className="text-sm font-medium text-ink-800">{details.teacherProfile?.address ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Emergency Contact Mobile</p><p className="text-sm font-medium text-ink-800">{details.teacherProfile?.emergencyContactMobile ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Professional Profile">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Qualification (Teacher)</p><p className="text-sm font-medium text-ink-800">{profile.qualification ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Qualification (Profile)</p><p className="text-sm font-medium text-ink-800">{details.teacherProfile?.qualification ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Total Experience</p><p className="text-sm font-medium text-ink-800">{profile.totalExperience ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Academic Experience</p><p className="text-sm font-medium text-ink-800">{profile.academicExperience ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Industry Experience</p><p className="text-sm font-medium text-ink-800">{profile.industryExperience ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">National Publications</p><p className="text-sm font-medium text-ink-800">{profile.nationalPublications ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">International Publications</p><p className="text-sm font-medium text-ink-800">{profile.internationalPublications ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Book Chapters</p><p className="text-sm font-medium text-ink-800">{profile.bookChapters ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Projects</p><p className="text-sm font-medium text-ink-800">{profile.projects ?? "—"}</p></div>
          <div className="sm:col-span-2"><p className="text-xs text-ink-400">Research Interest</p><p className="text-sm font-medium text-ink-800 whitespace-pre-wrap">{profile.researchInterest ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Assigned Classes">
        {details.assignedClasses.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.assignedClasses.map((item) => (
              <div key={item.sectionId} className="rounded-xl border border-ink-100 p-3">
                <p className="text-sm font-semibold text-ink-800">
                  {item.className ?? "Class"} - {item.sectionName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No assigned class sections.</p>
        )}
      </Card>

      <Card title="Subjects">
        {details.subjects.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.subjects.map((item) => (
              <div key={item.id} className="rounded-xl border border-ink-100 p-3">
                <p className="text-sm font-semibold text-ink-800">{item.subjectName ?? "Subject"}</p>
                <p className="text-xs text-ink-400">
                  {item.className ?? "Class"} {item.sectionName ? `• ${item.sectionName}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No subjects assigned.</p>
        )}
      </Card>

      <Card title="Danger Zone">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-4 rounded-xl bg-red-50 border border-red-100">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Deactivate Profile</h3>
            <p className="text-xs text-red-700 mt-0.5">Temporarily restrict access. The profile can be activated later.</p>
          </div>
          <Button
            variant="danger"
            loading={statusUpdating}
            onClick={() => setShowStatusConfirm(true)}
            className="whitespace-nowrap"
          >
            {details.teacher.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-4 rounded-xl bg-red-50 border border-red-100 mt-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Delete Profile</h3>
            <p className="text-xs text-red-700 mt-0.5">Permanently remove this teacher. This action cannot be undone.</p>
          </div>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => setShowDeleteConfirm(true)}
            className="whitespace-nowrap"
          >
            Delete
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={showStatusConfirm}
        onClose={() => setShowStatusConfirm(false)}
        onConfirm={async () => {
          const newStatus = details.teacher.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
          setStatusUpdating(true);
          try {
            await safeApiCall(
              () => api.patch(`/teachers/${id}/status`, { status: newStatus }),
              { loading: `Updating to ${newStatus}...`, success: `Teacher marked as ${newStatus}` }
            );
            await refresh();
          } catch {
            // Handled by toast
          } finally {
            setStatusUpdating(false);
          }
        }}
        title="Update Teacher Status"
        message={`Are you sure you want to mark this teacher as ${details.teacher.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}?`}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await safeApiCall(
              () => api.delete(`/teachers/${id}`),
              { loading: "Deleting profile...", success: "Teacher deleted successfully" }
            );
            navigate("/admin/teachers");
          } catch {
            // Handled by toast
          } finally {
            setDeleting(false);
          }
        }}
        title="Delete Teacher"
        message="Are you sure you want to delete this teacher? This action cannot be undone."
        variant="danger"
        confirmText="Delete"
      />
    </div >
  );
}
