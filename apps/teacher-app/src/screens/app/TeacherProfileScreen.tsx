import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery } from "@tanstack/react-query";
import { getTeacherProfile, resolvePublicUrl, updateTeacherProfile, uploadTeacherProfilePhoto } from "@saiyonix/api";
import { Button, Card, Input, PageHeader, colors, typography } from "@saiyonix/ui";
import { toUploadFile } from "../../utils/files";
import PageShell from "../../components/PageShell";

export default function TeacherProfileScreen() {
  const query = useQuery({
    queryKey: ["teacher", "profile"],
    queryFn: getTeacherProfile,
  });

  const teacher: any = query.data?.teacher ?? null;
  const profileCompletion = query.data?.profileCompletion ?? null;
  const profilePhoto = teacher?.profilePhotoUrl ?? teacher?.photoUrl ?? null;

  const [form, setForm] = useState({
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
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacher) return;
    setForm({
      designation: teacher.designation ?? "",
      qualification: teacher.qualification ?? "",
      totalExperience: teacher.totalExperience != null ? String(teacher.totalExperience) : "",
      academicExperience: teacher.academicExperience != null ? String(teacher.academicExperience) : "",
      industryExperience: teacher.industryExperience != null ? String(teacher.industryExperience) : "",
      researchInterest: teacher.researchInterest ?? "",
      nationalPublications: teacher.nationalPublications != null ? String(teacher.nationalPublications) : "",
      internationalPublications: teacher.internationalPublications != null ? String(teacher.internationalPublications) : "",
      bookChapters: teacher.bookChapters != null ? String(teacher.bookChapters) : "",
      projects: teacher.projects != null ? String(teacher.projects) : "",
    });
  }, [teacher]);

  const completion = useMemo(() => {
    if (typeof profileCompletion === "number") return profileCompletion;
    const fields = Object.values(form);
    const filled = fields.filter((v) => String(v).trim().length > 0).length;
    return Math.round((filled / 9) * 100);
  }, [form, profileCompletion]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateTeacherProfile({
        designation: form.designation,
        qualification: form.qualification,
        totalExperience: form.totalExperience ? Number(form.totalExperience) : undefined,
        academicExperience: form.academicExperience ? Number(form.academicExperience) : undefined,
        industryExperience: form.industryExperience ? Number(form.industryExperience) : undefined,
        researchInterest: form.researchInterest,
        nationalPublications: form.nationalPublications ? Number(form.nationalPublications) : undefined,
        internationalPublications: form.internationalPublications ? Number(form.internationalPublications) : undefined,
        bookChapters: form.bookChapters ? Number(form.bookChapters) : undefined,
        projects: form.projects ? Number(form.projects) : undefined,
      });
      setMessage("Profile saved successfully.");
      await query.refetch();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async () => {
    setPhotoError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setPhotoUploading(true);
    try {
      await uploadTeacherProfilePhoto(toUploadFile(asset));
      await query.refetch();
    } catch (err: any) {
      setPhotoError(err?.response?.data?.message ?? "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <PageShell loading={query.isLoading} loadingLabel="Loading profile">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="My Profile" subtitle="Complete your professional profile for better visibility." />

      <Card title="Profile Photo">
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            {profilePhoto ? (
              <Image source={{ uri: resolvePublicUrl(profilePhoto) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{(teacher?.fullName ?? "T").slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.avatarMeta}>
            <Text style={styles.listTitle}>{teacher?.fullName ?? "Teacher"}</Text>
            <Text style={styles.meta}>{teacher?.designation ?? "Designation"}</Text>
            <Text style={styles.meta}>Employee ID: {teacher?.employeeId ?? "—"}</Text>
          </View>
        </View>
        <View style={styles.photoActions}>
          <Button title={photoUploading ? "Uploading..." : "Upload Photo"} onPress={handlePhotoUpload} loading={photoUploading} />
          {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
        </View>
      </Card>

      <Card title="Basic Info">
        <View style={styles.infoGrid}>
          <View><Text style={styles.infoLabel}>Full Name</Text><Text style={styles.infoValue}>{teacher?.fullName ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Employee ID</Text><Text style={styles.infoValue}>{teacher?.employeeId ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Department</Text><Text style={styles.infoValue}>{teacher?.department ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Joining Date</Text><Text style={styles.infoValue}>{teacher?.joiningDate ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Status</Text><Text style={styles.infoValue}>{teacher?.status ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Gender</Text><Text style={styles.infoValue}>{teacher?.gender ?? "—"}</Text></View>
        </View>
      </Card>

      <Card title="Contact & Address">
        <View style={styles.infoGrid}>
          <View><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{teacher?.phone ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{teacher?.email ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Address (Teacher)</Text><Text style={styles.infoValue}>{teacher?.address ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Address (Profile)</Text><Text style={styles.infoValue}>{teacher?.teacherProfile?.address ?? "—"}</Text></View>
          <View><Text style={styles.infoLabel}>Emergency Contact Mobile</Text><Text style={styles.infoValue}>{teacher?.teacherProfile?.emergencyContactMobile ?? "—"}</Text></View>
        </View>
      </Card>

      <Card>
        <View style={styles.progressRow}>
          <View>
            <Text style={styles.progressTitle}>Profile Completion</Text>
            <Text style={styles.progressSubtitle}>Keep your profile up to date.</Text>
          </View>
          <Text style={styles.progressValue}>{completion}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completion}%` }]} />
        </View>
      </Card>

      <Card>
        <View style={styles.formGrid}>
          <Input label="Designation" value={form.designation} onChangeText={(v) => setForm({ ...form, designation: v })} />
          <Input label="Qualification" value={form.qualification} onChangeText={(v) => setForm({ ...form, qualification: v })} />
          <Input label="Total Experience (Years)" value={form.totalExperience} onChangeText={(v) => setForm({ ...form, totalExperience: v })} keyboardType="numeric" />
          <Input label="Academic Experience (Years)" value={form.academicExperience} onChangeText={(v) => setForm({ ...form, academicExperience: v })} keyboardType="numeric" />
          <Input label="Industry Experience (Years)" value={form.industryExperience} onChangeText={(v) => setForm({ ...form, industryExperience: v })} keyboardType="numeric" />
          <Input label="National Publications" value={form.nationalPublications} onChangeText={(v) => setForm({ ...form, nationalPublications: v })} keyboardType="numeric" />
          <Input label="International Publications" value={form.internationalPublications} onChangeText={(v) => setForm({ ...form, internationalPublications: v })} keyboardType="numeric" />
          <Input label="Book Chapters" value={form.bookChapters} onChangeText={(v) => setForm({ ...form, bookChapters: v })} keyboardType="numeric" />
          <Input label="Projects" value={form.projects} onChangeText={(v) => setForm({ ...form, projects: v })} keyboardType="numeric" />
          <View style={styles.fullWidthField}>
            <Text style={styles.textLabel}>Research Interest</Text>
            <TextInput
              style={styles.textarea}
              value={form.researchInterest}
              onChangeText={(v) => setForm({ ...form, researchInterest: v })}
              placeholder="Share your focus areas, papers, or ongoing research."
              multiline
            />
          </View>
        </View>
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={saving ? "Saving..." : "Save Profile"} onPress={handleSave} loading={saving} />
      </Card>
    </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink[50],
  },
  content: {
    padding: 20,
    gap: 16,
  },
  avatarRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.ink[100],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink[500],
    fontFamily: typography.fontDisplay,
  },
  avatarMeta: {
    gap: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  photoActions: {
    marginTop: 12,
    gap: 6,
  },
  infoGrid: {
    gap: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  infoValue: {
    fontSize: 13,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  progressSubtitle: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.jade[500],
  },
  formGrid: {
    gap: 12,
  },
  fullWidthField: {
    gap: 6,
  },
  textLabel: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontBody,
    color: colors.ink[800],
    backgroundColor: colors.white,
    minHeight: 90,
    textAlignVertical: "top",
  },
  success: {
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  error: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
});
