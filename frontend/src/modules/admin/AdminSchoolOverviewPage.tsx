import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "../../components/PageHeader";
import Card from "../../components/Card";
import Input from "../../components/Input";
import Button from "../../components/Button";
import LoadingState from "../../components/LoadingState";
import SecureImage from "../../components/SecureImage";
import { getSchoolOverview, updateSchoolOverview, uploadSchoolLogo } from "../../services/api/schoolOverview";

type FormState = {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  officialEmail: string;
  logoUrl: string;
};

export default function AdminSchoolOverviewPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>({
    schoolName: "",
    schoolAddress: "",
    schoolPhone: "",
    officialEmail: "",
    logoUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["school-overview"],
    queryFn: getSchoolOverview,
  });

  useEffect(() => {
    if (!overviewQuery.data) return;
    setForm({
      schoolName: overviewQuery.data.schoolName ?? "",
      schoolAddress: overviewQuery.data.schoolAddress ?? "",
      schoolPhone: overviewQuery.data.schoolPhone ?? "",
      officialEmail: overviewQuery.data.officialEmail ?? "",
      logoUrl: overviewQuery.data.logoUrl ?? "",
    });
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [overviewQuery.data]);

  const mutation = useMutation({
    mutationFn: updateSchoolOverview,
    onSuccess: () => {
      setSuccess("School overview updated.");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["school-overview"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Unable to update school overview.";
      setError(message);
      setSuccess(null);
    },
  });

  const onChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    setLogoError(null);
    setSuccess(null);
    setError(null);

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setLogoError("Only PNG, JPG, JPEG, or SVG files are allowed.");
      setUploadingLogo(false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be 2MB or smaller.");
      setUploadingLogo(false);
      return;
    }

    const preview = URL.createObjectURL(file);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });

    try {
      const res = await uploadSchoolLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: res.logoUrl ?? "" }));
      setSuccess("Logo uploaded. Save changes to apply.");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Unable to upload logo.";
      setLogoError(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = () => {
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setSuccess("Logo removed. Save changes to apply.");
    setLogoError(null);
    setError(null);
  };

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const handleSave = async () => {
    if (!form.schoolName || !form.schoolAddress || !form.schoolPhone || !form.officialEmail) {
      setError("All required fields must be filled.");
      return;
    }
    await mutation.mutateAsync({
      schoolName: form.schoolName.trim(),
      schoolAddress: form.schoolAddress.trim(),
      schoolPhone: form.schoolPhone.trim(),
      officialEmail: form.officialEmail.trim(),
      logoUrl: form.logoUrl.trim() || null,
    });
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader title="School Overview" subtitle="Manage school branding and identity" />
        <LoadingState label="Loading school overview" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="School Overview" subtitle="Manage school branding and identity" />

      <Card title="Branding Details" subtitle="These values appear across the website and documents.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="School Name"
            value={form.schoolName}
            onChange={(e) => onChange("schoolName", e.target.value)}
            required
          />
          <Input
            label="Official Email"
            value={form.officialEmail}
            onChange={(e) => onChange("officialEmail", e.target.value)}
            required
          />
          <Input
            label="School Phone"
            value={form.schoolPhone}
            onChange={(e) => onChange("schoolPhone", e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-500">School Logo</label>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo preview" className="h-full w-full object-contain" />
                  ) : form.logoUrl ? (
                    <SecureImage fileUrl={form.logoUrl} alt="School logo" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink-400">
                      No logo
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-ink-400">Recommended size: 200×200 or wider rectangle.</p>
                  {logoError && <p className="mt-1 text-xs text-sunrise-600">{logoError}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                    event.currentTarget.value = "";
                  }}
                />
                <Button loading={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                  {uploadingLogo ? "Uploading..." : "Upload Logo"}
                </Button>
                <Button variant="secondary" onClick={handleLogoRemove} disabled={!form.logoUrl && !logoPreviewUrl}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="School Address"
              value={form.schoolAddress}
              onChange={(e) => onChange("schoolAddress", e.target.value)}
              required
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-600">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 text-sm text-jade-600">{success}</p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
