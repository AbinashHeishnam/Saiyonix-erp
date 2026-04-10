import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import Textarea from "../../components/Textarea";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api, { safeApiCall } from "../../services/api/client";
import { useAuth } from "../../contexts/AuthContext";

type CertificateRequest = {
  id: string;
  type: "TC" | "CHARACTER" | "REGISTRATION";
  reason?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectedReason?: string | null;
  fileUrl?: string | null;
  createdAt: string;
};

type ParentStudent = {
  id: string;
  fullName: string | null;
  status?: string | null;
  admissionNumber?: string | null;
  registrationNumber?: string | null;
};

type AcademicYear = {
  id: string;
  startDate: string;
  endDate: string;
};

function isWithinAcademicYear(dateValue: string, academicYear: AcademicYear | null) {
  if (!academicYear) return false;
  const date = new Date(dateValue);
  const start = new Date(academicYear.startDate);
  const end = new Date(academicYear.endDate);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

export default function CertificatesPage() {
  const { role, user } = useAuth();
  const isParent = role === "PARENT";
  const isRestricted = Boolean(user?.restricted);
  const [form, setForm] = useState({ type: "TC", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const { data: studentProfile } = useAsync(async () => {
    if (isParent || isRestricted) return null;
    const res = await api.get("/students/me");
    return res.data?.data ?? res.data;
  }, [isParent, isRestricted]);

  const { data: parentProfile } = useAsync(async () => {
    if (!isParent || isRestricted) return null;
    const res = await api.get<any>("/parent/profile");
    return res.data?.data ?? res.data;
  }, [isParent, isRestricted]);

  const parentStudents = useMemo(
    () => (isRestricted ? [] : (parentProfile?.students ?? []) as ParentStudent[]),
    [isRestricted, parentProfile]
  );

  useEffect(() => {
    if (isRestricted) return;
    if (!isParent) return;
    if (!selectedStudentId && parentStudents.length) {
      setSelectedStudentId(parentStudents[0].id);
    }
  }, [isParent, isRestricted, parentStudents, selectedStudentId]);

  const { data, loading, refresh } = useAsync(async () => {
    const params =
      isParent && selectedStudentId ? { studentId: selectedStudentId } : undefined;
    const res = await api.get("/certificate/requests", { params });
    return res.data?.data ?? res.data;
  }, [isParent, selectedStudentId]);

  const { data: activeYear } = useAsync(async () => {
    if (isRestricted) return null;
    const res = await api.get("/academic-years/active");
    return (res.data?.data ?? res.data) as AcademicYear;
  }, [isRestricted]);

  const requests = Array.isArray(data) ? (data as CertificateRequest[]) : [];
  const selectedStudent = isParent
    ? parentStudents.find((student) => student.id === selectedStudentId)
    : null;
  const isExpelled = isRestricted
    ? false
    : isParent
      ? selectedStudent?.status === "EXPELLED"
      : studentProfile?.status === "EXPELLED";

  const hasRequestedThisYear = useMemo(() => {
    if (!form.type) return false;
    const relevant = requests.filter((req) => req.type === form.type);
    return relevant.some((req) => isWithinAcademicYear(req.createdAt, activeYear ?? null));
  }, [requests, form.type, activeYear]);

  const handleSubmit = async () => {
    if (isParent && !selectedStudentId) {
      setError("Select a student.");
      return;
    }
    if (!form.type) {
      setError("Select a certificate type.");
      return;
    }
    if (hasRequestedThisYear) {
      setError("You have already requested this certificate for the current academic year.");
      return;
    }

    setSubmitting(true);
    try {
      await safeApiCall(
        () => api.post("/certificate/request", {
          type: form.type,
          reason: form.reason || undefined,
          studentId: isParent ? selectedStudentId : undefined,
        }),
        {
          loading: "Submitting request...",
          success: "Certificate requested successfully"
        }
      );
      setForm({ type: "TC", reason: "" });
      setError(null);
      await refresh();
    } catch (err: any) {
      // safeApiCall handles toast, but we can set local error if we want it in the card
      const message = err.response?.data?.message || err.message || "Failed to submit request";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Certificates" subtitle="Request and track certificates" />

      {isRestricted && (
        <div className="bg-yellow-100 p-3 rounded">
          Access limited. You can only view/download certificates.
        </div>
      )}

      {isExpelled && (
        <Card>
          <p className="text-sm font-semibold text-rose-600">
            You are no longer enrolled in this institution.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            You can still download your approved transfer certificate.
          </p>
        </Card>
      )}

      {!isExpelled && !isRestricted && (
        <Card title="Request Certificate">
          <div className="grid gap-4">
            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                {error}
              </p>
            )}
            {isParent && (
              <Select
                label="Student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {parentStudents.length ? (
                  parentStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName ?? "Student"}{" "}
                      {student.admissionNumber ? `• ${student.admissionNumber}` : ""}
                    </option>
                  ))
                ) : (
                  <option value="">No linked students</option>
                )}
              </Select>
            )}
            <Select
              label="Certificate Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="TC">Transfer Certificate (TC)</option>
              <option value="CHARACTER">Character Certificate</option>
              <option value="REGISTRATION">Registration Certificate</option>
            </Select>
            {hasRequestedThisYear && (
              <p className="text-xs font-semibold text-amber-600">
                This certificate has already been requested for the current academic year.
              </p>
            )}
            <Textarea
              label="Reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
            />
            <div className="flex justify-end">
              <Button onClick={handleSubmit} loading={submitting} disabled={hasRequestedThisYear}>
                Request Certificate
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="My Requests">
        {loading ? (
          <p className="text-sm text-slate-500">Loading requests...</p>
        ) : requests.length ? (
          <div className="grid gap-3">
            {requests.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{req.type}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {req.status}
                  </span>
                </div>
                {req.reason && (
                  <p className="mt-2 text-xs text-slate-500">Reason: {req.reason}</p>
                )}
                {req.status === "REJECTED" && req.rejectedReason && (
                  <p className="mt-2 text-xs text-rose-600">Rejected: {req.rejectedReason}</p>
                )}
                {req.status === "APPROVED" && req.fileUrl && (
                  <div className="mt-3">
                    <SecureLink fileUrl={req.fileUrl} fileName="certificate" className="inline-flex">
                      <Button variant="secondary">Download Certificate</Button>
                    </SecureLink>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No certificate requests yet.</p>
        )}
      </Card>
    </div>
  );
}
