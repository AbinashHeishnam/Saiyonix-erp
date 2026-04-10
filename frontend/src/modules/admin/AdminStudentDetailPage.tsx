import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Button from "../../components/Button";
import Card from "../../components/Card";
import ConfirmDialog from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import SecureImage from "../../components/SecureImage";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";

type StudentDetails = {
  student: {
    id: string;
    fullName: string;
    registrationNumber?: string | null;
    admissionNumber?: string | null;
    status?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
  };
  studentProfile?: {
    profilePhotoUrl?: string | null;
    address?: string | null;
    emergencyContactName?: string | null;
    emergencyContactMobile?: string | null;
    previousSchool?: string | null;
    medicalInfo?: unknown | null;
  } | null;
  parents: Array<{
    id: string;
    fullName: string;
    mobile: string;
    email?: string | null;
    relationToStudent?: string | null;
    isPrimary?: boolean;
  }>;
  class?: { id: string; className?: string | null } | null;
  section?: { id: string; sectionName?: string | null } | null;
  classTeacher?: {
    id: string;
    fullName: string;
    photoUrl?: string | null;
    designation?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  enrollment?: {
    rollNumber?: number | null;
    isDetained?: boolean | null;
    promotionStatus?: string | null;
  } | null;
};

export default function AdminStudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assigningRolls, setAssigningRolls] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await api.get(`/admin/student/${id}`);
    return res.data?.data ?? res.data;
  }, [id]);

  const details = data as StudentDetails | undefined;

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-ink-500">Loading student details...</p>
      </Card>
    );
  }

  if (error || !details) {
    return (
      <Card>
        <p className="text-sm text-sunrise-600">{error ?? "Student not found"}</p>
      </Card>
    );
  }

  const medicalInfo =
    details.studentProfile?.medicalInfo != null
      ? typeof details.studentProfile.medicalInfo === "string"
        ? details.studentProfile.medicalInfo
        : JSON.stringify(details.studentProfile.medicalInfo)
      : null;

  const handleAssignRolls = async () => {
    if (!details.section?.id) return;

    setAssigningRolls(true);
    try {
      await safeApiCall(
        () => api.post(`/admin/sections/${details.section!.id}/assign-rolls`),
        { loading: "Assigning roll numbers...", success: "Roll numbers assigned successfully" }
      );
      await refresh();
    } catch (err: unknown) {
      // Handled by toast
    } finally {
      setAssigningRolls(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <PageHeader
        title="Student Details"
        subtitle={details.student.fullName ?? "Student"}
      />

      <Card title="Profile Photo">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-40 w-40 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
            {details.studentProfile?.profilePhotoUrl ? (
              <SecureImage
                fileUrl={details.studentProfile.profilePhotoUrl}
                alt={details.student.fullName ?? "Student"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-ink-400">
                {(details.student.fullName ?? "S").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            {details.studentProfile?.profilePhotoUrl && (
              <SecureLink
                fileUrl={details.studentProfile.profilePhotoUrl}
                fileName={`${details.student.fullName ?? "Student"}-photo`}
                className="mt-2 inline-flex text-xs font-semibold text-ink-600 hover:text-ink-800"
              >
                View full image
              </SecureLink>
            )}
          </div>
        </div>
      </Card>

      <Card title="Personal Info">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-400">Status</p>
            <p className="text-sm font-medium text-ink-800">
              {details.student.status ?? "—"}
            </p>
          </div>
          <div><p className="text-xs text-ink-400">Registration No</p><p className="text-sm font-medium text-ink-800">{details.student.registrationNumber ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Admission No</p><p className="text-sm font-medium text-ink-800">{details.student.admissionNumber ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Gender</p><p className="text-sm font-medium text-ink-800">{details.student.gender ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Date of Birth</p><p className="text-sm font-medium text-ink-800">{details.student.dateOfBirth ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Blood Group</p><p className="text-sm font-medium text-ink-800">{details.student.bloodGroup ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Class Info">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Class</p><p className="text-sm font-medium text-ink-800">{details.class?.className ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Section</p><p className="text-sm font-medium text-ink-800">{details.section?.sectionName ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Roll Number</p><p className="text-sm font-medium text-ink-800">{details.enrollment?.rollNumber ?? "Pending"}</p></div>
          <div><p className="text-xs text-ink-400">Promotion Status</p><p className="text-sm font-medium text-ink-800">{details.enrollment?.promotionStatus ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Detained</p><p className="text-sm font-medium text-ink-800">{details.enrollment?.isDetained == null ? "—" : details.enrollment.isDetained ? "Yes" : "No"}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleAssignRolls}
            loading={assigningRolls}
            disabled={!details.section?.id}
          >
            Auto Assign Rolls
          </Button>
        </div>
      </Card>

      <Card title="Class Teacher">
        {details.classTeacher ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
              {details.classTeacher.photoUrl ? (
                <SecureImage
                  fileUrl={details.classTeacher.photoUrl}
                  alt={details.classTeacher.fullName ?? "Teacher"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
                  {(details.classTeacher.fullName ?? "T").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><p className="text-xs text-ink-400">Name</p><p className="text-sm font-medium text-ink-800">{details.classTeacher.fullName ?? "—"}</p></div>
              <div><p className="text-xs text-ink-400">Designation</p><p className="text-sm font-medium text-ink-800">{details.classTeacher.designation ?? "—"}</p></div>
              <div><p className="text-xs text-ink-400">Phone</p><p className="text-sm font-medium text-ink-800">{details.classTeacher.phone ?? "—"}</p></div>
              <div><p className="text-xs text-ink-400">Email</p><p className="text-sm font-medium text-ink-800">{details.classTeacher.email ?? "—"}</p></div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">No class teacher assigned.</p>
        )}
      </Card>

      <Card title="Parent Info">
        {details.parents.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.parents.map((parent) => (
              <div key={parent.id} className="rounded-xl border border-ink-100 p-3">
                <p className="text-sm font-semibold text-ink-800">
                  {parent.fullName} {parent.isPrimary ? "(Primary)" : ""}
                </p>
                <p className="text-xs text-ink-400">{parent.relationToStudent ?? "—"}</p>
                <p className="text-xs text-ink-400">{parent.mobile ?? "—"}</p>
                <p className="text-xs text-ink-400">{parent.email ?? "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No parents linked.</p>
        )}
      </Card>

      <Card title="Medical Info">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Emergency Contact</p><p className="text-sm font-medium text-ink-800">{details.studentProfile?.emergencyContactName ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Emergency Contact Mobile</p><p className="text-sm font-medium text-ink-800">{details.studentProfile?.emergencyContactMobile ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Address</p><p className="text-sm font-medium text-ink-800">{details.studentProfile?.address ?? "—"}</p></div>
          <div><p className="text-xs text-ink-400">Previous School</p><p className="text-sm font-medium text-ink-800">{details.studentProfile?.previousSchool ?? "—"}</p></div>
          <div className="sm:col-span-2"><p className="text-xs text-ink-400">Medical Info</p><p className="text-sm font-medium text-ink-800 whitespace-pre-wrap">{medicalInfo ?? "—"}</p></div>
        </div>
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
            {details.student.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-4 rounded-xl bg-red-50 border border-red-100 mt-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Delete Profile</h3>
            <p className="text-xs text-red-700 mt-0.5">Permanently remove this student. This action cannot be undone.</p>
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
          const newStatus = details.student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
          setStatusUpdating(true);
          try {
            await safeApiCall(
              () => api.patch(`/students/${id}`, { status: newStatus }),
              { loading: `Updating to ${newStatus}...`, success: `Student marked as ${newStatus}` }
            );
            await refresh();
          } catch {
            // Handled by toast
          } finally {
            setStatusUpdating(false);
          }
        }}
        title="Update Student Status"
        message={`Are you sure you want to mark this student as ${details.student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}?`}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await safeApiCall(
              () => api.delete(`/students/${id}`),
              { loading: "Deleting profile...", success: "Student deleted successfully" }
            );
            navigate("/admin/students");
          } catch {
            // Handled by toast
          } finally {
            setDeleting(false);
          }
        }}
        title="Delete Student"
        message="Are you sure you want to delete this student? This action cannot be undone."
        variant="danger"
        confirmText="Delete"
      />
    </div >
  );
}
