import { useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import SecureLink from "../../components/SecureLink";
import { useAsync } from "../../hooks/useAsync";
import api from "../../services/api/client";

type StudentOption = {
  id: string;
  fullName: string;
  registrationNumber?: string | null;
  statusLabel?: string | null;
  status?: string | null;
};

type TcRequest = {
  id: string;
  type: string;
  status: string;
  reason?: string | null;
  createdAt: string;
  updatedAt?: string;
  fileUrl?: string | null;
  student: {
    id: string;
    fullName: string;
    admissionNumber?: string | null;
    registrationNumber?: string | null;
    className?: string | null;
    sectionName?: string | null;
  };
};

export default function TcGeneratorPage() {
  const [form, setForm] = useState({
    studentId: "",
    reason: "",
    date: "",
    expel: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const { data } = useAsync(async () => {
    const res = await api.get("/students", { params: { page: 1, limit: 200 } });
    const payload = res.data?.data ?? res.data;
    const students = payload?.students ?? payload?.items ?? [];
    return Array.isArray(students) ? students : [];
  }, []);

  const { data: tcData, loading: tcLoading, refresh: refreshTc } = useAsync(async () => {
    const res = await api.get("/admin/certificate/requests");
    return res.data?.data ?? res.data;
  }, []);

  const students = (data ?? []) as StudentOption[];
  const tcRequests = Array.isArray(tcData) ? (tcData as TcRequest[]) : [];
  const approvedTc = tcRequests.filter(
    (req) => req.type === "TC" && req.status === "APPROVED"
  );

  const handleGenerate = async () => {
    setError(null);
    setMessage(null);
    setFileUrl(null);
    if (!form.studentId || !form.reason.trim()) {
      setError("Student and reason are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/admin/tc/generate", {
        studentId: form.studentId,
        reason: form.reason,
        date: form.date || undefined,
        expel: form.expel,
      });
      const payload = res.data?.data ?? res.data;
      setFileUrl(payload?.fileUrl ?? null);
      setMessage("TC generated successfully.");
      setForm({ studentId: "", reason: "", date: "", expel: false });
      await refreshTc();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to generate TC.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="TC Generator" subtitle="Generate transfer certificates and expel students" />
      <Card>
        <div className="grid gap-4">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600">
              {message}
            </p>
          )}
          <Select
            label="Select Student"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName}{" "}
                {student.registrationNumber ? `(${student.registrationNumber})` : ""}
                {student.statusLabel ? ` • ${student.statusLabel}` : student.status ? ` • ${student.status}` : ""}
              </option>
            ))}
          </Select>
          <Input
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.expel}
              onChange={(e) => setForm({ ...form, expel: e.target.checked })}
            />
            Expel student (set status to EXPELLED and block login)
          </label>
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={submitting}>
              {submitting ? "Generating..." : "Generate TC"}
            </Button>
          </div>
          {fileUrl && (
            <div>
              <SecureLink fileUrl={fileUrl} fileName="tc-certificate" className="inline-flex">
                <Button variant="secondary">Download TC</Button>
              </SecureLink>
            </div>
          )}
        </div>
      </Card>

      <Card title="TC Given Students">
        {tcLoading ? (
          <p className="text-sm text-slate-500">Loading TC list...</p>
        ) : approvedTc.length ? (
          <div className="grid gap-3">
            {approvedTc.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {req.student.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {req.student.className ?? "—"}{" "}
                      {req.student.sectionName ? `• ${req.student.sectionName}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Adm: {req.student.admissionNumber ?? "—"} • Reg:{" "}
                      {req.student.registrationNumber ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      TC Date: {new Date(req.updatedAt ?? req.createdAt).toLocaleString()}
                    </p>
                    {req.reason && (
                      <p className="mt-1 text-xs text-slate-500">Reason: {req.reason}</p>
                    )}
                  </div>
                  {req.fileUrl ? (
                    <SecureLink fileUrl={req.fileUrl} fileName="tc-certificate" className="inline-flex">
                      <Button variant="secondary">Download TC</Button>
                    </SecureLink>
                  ) : (
                    <span className="text-xs text-slate-400">No file</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No TC records found.</p>
        )}
      </Card>
    </div>
  );
}
