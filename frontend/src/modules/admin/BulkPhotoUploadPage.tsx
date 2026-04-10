import { useState } from "react";

import Button from "../../components/Button";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import api from "../../services/api/client";

export default function BulkPhotoUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a ZIP file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/bulk/photos/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data?.message ?? "Upload queued successfully.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bulk Photo Upload"
        subtitle="Upload a ZIP file containing student photos named by registration number."
      />
      <Card title="Upload ZIP">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept=".zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading..." : "Upload"}
          </Button>
          {message ? <p className="text-sm text-jade-600">{message}</p> : null}
          {error ? <p className="text-sm text-sunrise-600">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
