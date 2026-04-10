import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "../../components/PageHeader";
import Card from "../../components/Card";
import Input from "../../components/Input";
import Button from "../../components/Button";
import LoadingState from "../../components/LoadingState";
import { listAppConfigs } from "../../services/api/adminConfig";
import api from "../../services/api/client";
import { Link } from "react-router-dom";
import { toastUtils } from "../../utils/toast";

const CONFIG_FIELDS = [
  {
    section: "payment",
    key: "RAZORPAY_KEY_ID",
    label: "Razorpay Key ID",
    secret: false,
  },
  {
    section: "payment",
    key: "RAZORPAY_KEY_SECRET",
    label: "Razorpay Secret",
    secret: true,
  },
  {
    section: "sms",
    key: "SMS_API_KEY",
    label: "SMS API Key",
    secret: true,
  },
  {
    section: "sms",
    key: "SMS_SENDER_ID",
    label: "Sender ID",
    secret: false,
  },
  {
    section: "sms",
    key: "OTP_PROVIDER",
    label: "OTP Provider",
    secret: false,
  },
  {
    section: "sms",
    key: "OTP_API_KEY",
    label: "OTP Key",
    secret: true,
  },
] as const;

type ConfigKey = (typeof CONFIG_FIELDS)[number]["key"];

const SECTIONS = [
  {
    key: "payment",
    title: "Payment Gateway",
    subtitle: "Razorpay credentials used for fee collections.",
  },
  {
    key: "sms",
    title: "SMS / OTP",
    subtitle: "Messaging keys for OTP and notification delivery.",
  },
] as const;

function maskValue(value: string) {
  if (!value) return "";
  return "******";
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<ConfigKey, string>>({
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    SMS_API_KEY: "",
    SMS_SENDER_ID: "",
    OTP_PROVIDER: "",
    OTP_API_KEY: "",
  });
  const [initialValues, setInitialValues] = useState<Record<ConfigKey, string>>(values);
  const [editing, setEditing] = useState<Record<ConfigKey, boolean>>({
    RAZORPAY_KEY_ID: false,
    RAZORPAY_KEY_SECRET: false,
    SMS_API_KEY: false,
    SMS_SENDER_ID: false,
    OTP_PROVIDER: false,
    OTP_API_KEY: false,
  });
  const [errors, setErrors] = useState<Partial<Record<ConfigKey, string>>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["admin-config"],
    queryFn: listAppConfigs,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    const next = { ...values } as Record<ConfigKey, string>;
    for (const field of CONFIG_FIELDS) {
      const record = configQuery.data.find((item) => item.key === field.key);
      next[field.key] = record?.value ?? "";
    }
    setValues(next);
    setInitialValues(next);
    setErrors({});
  }, [configQuery.data]);

  const mutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return api.post("/admin/config", data);
    },
  });

  const grouped = useMemo(() => {
    const group: Record<string, (typeof CONFIG_FIELDS)[number][]> = {};
    for (const field of CONFIG_FIELDS) {
      if (!group[field.section]) group[field.section] = [];
      group[field.section].push(field);
    }
    return group;
  }, []);

  const isDirty = (key: ConfigKey) => (values[key] ?? "") !== (initialValues[key] ?? "");

  const toggleEdit = (key: ConfigKey) => {
    setEditing((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onChange = (key: ConfigKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const saveSection = async (section: string) => {
    if (savingSection) return;
    setSaveError(null);
    setSavingSection(section);
    const fields = CONFIG_FIELDS.filter((f) => f.section === section);
    const dirtyFields = fields.filter((field) => isDirty(field.key));

    if (dirtyFields.length === 0) {
      setSavingSection(null);
      toastUtils.success("No changes to save");
      return;
    }

    let saved = 0;
    for (const field of dirtyFields) {
      const value = values[field.key];
      const payload = { key: field.key, value: value };

      try {
        await mutation.mutateAsync(payload);
        queryClient.invalidateQueries({ queryKey: ["admin-config"] });
        saved += 1;
      } catch (err) {
        const message =
          (err as any)?.response?.data?.message ?? (err as any)?.message ?? "Unable to save settings";
        setSaveError(message);
        toastUtils.error(message);
      }
    }

    if (saved > 0) {
      toastUtils.success("Settings saved");
    }
    setSavingSection(null);
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader title="Settings" subtitle="System-wide configuration and integrations" />
        <LoadingState label="Loading settings" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="System-wide configuration and integrations" />

      <Card title="School Overview" subtitle="Branding and identity used across the platform.">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-500">
            Update school name, address, contact, and logo for documents and headers.
          </p>
          <Link to="/admin/settings/school-overview">
            <Button variant="secondary">Manage</Button>
          </Link>
        </div>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.key} title={section.title} subtitle={section.subtitle}>
          {saveError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {saveError}
            </div>
          )}
          <div className="grid gap-5">
            {(grouped[section.key] ?? []).map((field) => {
              const isEditing = editing[field.key];
              const displayValue = field.secret
                ? isEditing
                  ? values[field.key]
                  : maskValue(values[field.key])
                : values[field.key];

              return (
                <div key={field.key} className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Input
                      label={field.label}
                      value={displayValue}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      disabled={!isEditing}
                      error={errors[field.key]}
                      placeholder={field.secret ? "••••••" : "Enter value"}
                    />
                  </div>
                  <div className="md:pb-1">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => toggleEdit(field.key)}
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              loading={savingSection === section.key}
              onClick={() => saveSection(section.key)}
            >
              Save
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
