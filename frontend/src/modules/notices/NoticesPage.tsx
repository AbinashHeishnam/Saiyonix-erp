import { useEffect, useMemo, useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Input from "../../components/Input";
import Textarea from "../../components/Textarea";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import SecureLink from "../../components/SecureLink";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { createNotice, deleteNotice, listNotices, updateNotice } from "../../services/api/notices";
import api from "../../services/api/client";
import { isAdminRole } from "../../utils/role";

const TARGET_TYPES = ["ALL", "CLASS", "SECTION", "TEACHER_ONLY"] as const;
type TargetType = (typeof TARGET_TYPES)[number] | "ROLE";

type ClassItem = { id: string; className: string };
type SectionItem = { id: string; sectionName: string; class?: { id: string; className?: string | null } };

function getFileName(url?: string | null) {
  if (!url) return null;
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const name = clean.split("/").pop() ?? "";
  return decodeURIComponent(name) || null;
}

function getFileIcon(url?: string | null) {
  if (!url) return null;
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📄";
  if (["jpg", "jpeg", "png"].includes(ext)) return "🖼";
  return "📎";
}

function isRecent(date?: string | null) {
  if (!date) return false;
  const published = new Date(date);
  if (Number.isNaN(published.getTime())) return false;
  const diffMs = Date.now() - published.getTime();
  return diffMs <= 1000 * 60 * 60 * 24 * 3;
}

export default function NoticesPage() {
  const { role } = useAuth();
  const isAdmin = isAdminRole(role) || role === "ACADEMIC_SUB_ADMIN";
  const navigate = useNavigate();
  const [academicYearId, setAcademicYearId] = useState("");

  const { data, loading, error, refresh } = useAsync(async () => {
    const res = await listNotices({ page: 1, limit: 50, ...(isAdmin ? {} : { active: true }) });
    return res?.data ?? res ?? [];
  }, [isAdmin]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const [form, setForm] = useState<{
    title: string;
    content: string;
    noticeType: string;
    targetType: TargetType;
    targetRole: string;
    targetClassId: string;
    targetSectionId: string;
  }>({
    title: "",
    content: "",
    noticeType: "GENERAL",
    targetType: "ALL" as TargetType,
    targetRole: "",
    targetClassId: "",
    targetSectionId: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: classes } = useAsync(async () => {
    if (!isAdmin) return [];
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    const res = await api.get("/classes", { params });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [isAdmin, academicYearId]);

  const { data: sections } = useAsync(async () => {
    if (!isAdmin) return [];
    const params: Record<string, string | number> = { page: 1, limit: 200 };
    if (academicYearId) params.academicYearId = academicYearId;
    if (form.targetClassId) params.classId = form.targetClassId;
    const res = await api.get("/sections", { params });
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }, [isAdmin, academicYearId, form.targetClassId]);

  const classOptions = useMemo(
    () => (Array.isArray(classes) ? (classes as ClassItem[]) : []),
    [classes]
  );

  const sectionOptions = useMemo(
    () => (Array.isArray(sections) ? (sections as SectionItem[]) : []),
    [sections]
  );

  useEffect(() => {
    if (!form.targetClassId) return;
    const exists = classOptions.some((cls) => cls.id === form.targetClassId);
    if (!exists) {
      setForm((prev) => ({ ...prev, targetClassId: "", targetSectionId: "" }));
    }
  }, [academicYearId, classOptions, form.targetClassId]);

  useEffect(() => {
    if (!form.targetSectionId) return;
    const exists = sectionOptions.some((sec) => sec.id === form.targetSectionId);
    if (!exists) {
      setForm((prev) => ({ ...prev, targetSectionId: "" }));
    }
  }, [academicYearId, sectionOptions, form.targetSectionId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    setMessage(null);
    try {
      setUploading(files.length > 0);
      const attachmentUrls =
        files.length > 0
          ? await Promise.all(
              files.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("userType", "common");
                formData.append("userId", "shared");
                formData.append("module", "notice");
                const res = await api.post("/upload", formData, {
                  headers: { "Content-Type": "multipart/form-data" },
                });
                return res.data?.data?.fileUrl ?? res.data?.fileUrl ?? null;
              })
            )
          : [];
      const cleanAttachments = attachmentUrls.filter(Boolean) as string[];
      const payload = {
        title: form.title,
        content: form.content,
        noticeType: form.noticeType,
        targetType:
          form.targetType === "TEACHER_ONLY" ? "ROLE" : form.targetType,
        targetRole:
          form.targetType === "TEACHER_ONLY"
            ? "TEACHER"
            : form.targetType === "ROLE"
              ? form.targetRole
              : undefined,
        targetClassId: form.targetType === "CLASS" ? form.targetClassId : undefined,
        targetSectionId: form.targetType === "SECTION" ? form.targetSectionId : undefined,
        attachments: cleanAttachments.length > 0 ? cleanAttachments : undefined,
      };
      if (editingId) {
        await updateNotice(editingId, payload);
        setMessage("Notice updated.");
      } else {
        await createNotice(payload);
        setMessage("Notice created.");
      }
      setForm({
        title: "",
        content: "",
        noticeType: "GENERAL",
        targetType: "ALL",
        targetRole: "",
        targetClassId: "",
        targetSectionId: "",
      });
      setFiles([]);
      setEditingId(null);
      refresh();
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save notice");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleEdit = (notice: { id: string; title: string; content?: string | null; noticeType?: string | null; targetType?: string | null; targetRole?: string | null; targetClassId?: string | null; targetSectionId?: string | null }) => {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      content: notice.content ?? "",
      noticeType: notice.noticeType ?? "GENERAL",
      targetType:
        notice.targetType === "ROLE" && notice.targetRole === "TEACHER"
          ? "TEACHER_ONLY"
          : ((notice.targetType ?? "ALL") as TargetType),
      targetRole: notice.targetRole ?? "",
      targetClassId: notice.targetClassId ?? "",
      targetSectionId: notice.targetSectionId ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    await deleteNotice(id);
    refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notice Board" subtitle="Create and manage school notices" />
      {isAdmin && (
        <Card title={editingId ? "Edit Notice" : "Create Notice"}>
          <div className="grid gap-3 md:grid-cols-2">
            <AcademicYearFilter
              value={academicYearId}
              onChange={setAcademicYearId}
              syncQueryKey="academicYearId"
            />
            <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <Input label="Notice Type" value={form.noticeType} onChange={(event) => setForm({ ...form, noticeType: event.target.value })} />
            <div className="md:col-span-2">
              <Textarea
                label="Content"
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
              />
            </div>
            <Select label="Target Type" value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as TargetType })}>
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "TEACHER_ONLY" ? "Teacher Only" : type}
                </option>
              ))}
            </Select>
            {form.targetType === "ROLE" && (
              <Select
                label="Target Role"
                value={form.targetRole}
                onChange={(event) => setForm({ ...form, targetRole: event.target.value })}
              >
                <option value="">Select role</option>
                {[
                  "ADMIN",
                  "ACADEMIC_SUB_ADMIN",
                  "FINANCE_SUB_ADMIN",
                  "TEACHER",
                  "STUDENT",
                  "PARENT",
                ].map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {roleType}
                  </option>
                ))}
              </Select>
            )}
            {form.targetType === "CLASS" && (
              <Select
                label="Target Class"
                value={form.targetClassId}
                onChange={(event) => setForm({ ...form, targetClassId: event.target.value })}
              >
                <option value="">Select class</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.className}
                  </option>
                ))}
              </Select>
            )}
            {form.targetType === "SECTION" && (
              <Select
                label="Target Section"
                value={form.targetSectionId}
                onChange={(event) => setForm({ ...form, targetSectionId: event.target.value })}
              >
                <option value="">Select section</option>
                {sectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.class?.className ? `${item.class.className} - ${item.sectionName}` : item.sectionName}
                  </option>
                ))}
              </Select>
            )}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-ink-500">Attachments (optional)</label>
              <input
                type="file"
                className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []);
                  setFiles(nextFiles);
                }}
              />
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-600">
                  {files.map((file, idx) => (
                    <span key={`${file.name}-${idx}`} className="rounded-full bg-ink-50 px-3 py-1">
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-sunrise-600">{formError}</p>}
          {message && <p className="mt-3 text-sm text-jade-600">{message}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting || uploading ? "Saving..." : "Save Notice"}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}
      <Card title="Notices">
        {loading ? (
          <LoadingState label="Loading notices" />
        ) : error ? (
          <p className="text-sm text-sunrise-600">{error}</p>
        ) : data?.length ? (
          <div className="grid gap-4">
            {data.map((notice: { id: string; title: string; content?: string; noticeType?: string; targetType?: string; targetRole?: string; publishedAt?: string; attachments?: string[] | null; targetClassId?: string | null; targetSectionId?: string | null }) => (
              <div key={notice.id} className="rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">{notice.title}</h3>
                      {isRecent(notice.publishedAt) && (
                        <span className="rounded-full bg-jade-50 px-2 py-0.5 text-[10px] font-semibold text-jade-600">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {notice.noticeType ?? "GENERAL"} • {notice.publishedAt ? new Date(notice.publishedAt).toLocaleString() : "Draft"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/notices/${notice.id}`)}>
                      View
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="secondary" onClick={() => handleEdit(notice)}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => handleDelete(notice.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {notice.content && (
                  <p className="mt-3 text-sm text-ink-700 whitespace-pre-wrap">{notice.content}</p>
                )}
                {notice.attachments && notice.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-600">
                    {notice.attachments.map((file, idx) => (
                      <SecureLink
                        key={`${file}-${idx}`}
                        fileUrl={file}
                        fileName={getFileName(file) ?? "Attachment"}
                        className="inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1 font-semibold text-ink-700"
                      >
                        <span>{getFileIcon(file)}</span>
                        <span>{getFileName(file) ?? "Attachment"}</span>
                        <span>View</span>
                      </SecureLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No notices" description="No notices have been published yet." />
        )}
      </Card>
    </div>
  );
}
