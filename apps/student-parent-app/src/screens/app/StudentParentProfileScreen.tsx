import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentProfile, getStudentMe, resolvePublicUrl, updateParentProfile } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, Input, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";

export default function StudentParentProfileScreen() {
  const { role, logout } = useAuth();
  const query = useQuery<any>({
    queryKey: ["profile", role],
    queryFn: role === "PARENT" ? getParentProfile : getStudentMe,
  });

  const data: any = query.data ?? {};
  const parent = data.parent ?? null;
  const students = Array.isArray(data.students) ? data.students : [];

  const [form, setForm] = useState({
    fullName: "",
    mobile: "",
    email: "",
    relationToStudent: "",
    address: "",
    emergencyContactName: "",
    emergencyContactMobile: "",
    previousSchool: "",
    medicalInfo: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "PARENT" || !parent) return;
    const studentProfile = students?.[0]?.profile ?? null;
    setForm({
      fullName: parent.fullName ?? "",
      mobile: parent.mobile ?? "",
      email: parent.email ?? "",
      relationToStudent: parent.relationToStudent ?? "",
      address: studentProfile?.address ?? "",
      emergencyContactName: studentProfile?.emergencyContactName ?? "",
      emergencyContactMobile: studentProfile?.emergencyContactMobile ?? "",
      previousSchool: studentProfile?.previousSchool ?? "",
      medicalInfo: typeof studentProfile?.medicalInfo === "string" ? studentProfile.medicalInfo : "",
    });
  }, [role, parent, students]);

  const completion = useMemo(() => {
    const fields = [form.fullName, form.mobile, form.email, form.relationToStudent, form.address, form.emergencyContactName, form.emergencyContactMobile];
    const filled = fields.filter((value) => value.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [form]);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await updateParentProfile({
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email,
        relationToStudent: form.relationToStudent,
        address: form.address,
        emergencyContactName: form.emergencyContactName,
        emergencyContactMobile: form.emergencyContactMobile,
        previousSchool: form.previousSchool,
        medicalInfo: form.medicalInfo,
      });
      setMessage("Profile saved successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title={role === "PARENT" ? "My Profile" : "Student Profile"}
        subtitle={role === "PARENT" ? "Keep parent and student details up to date." : "Student profile details"}
      />

      {query.isLoading ? <LoadingState /> : null}

      {role === "PARENT" ? (
        <>
          <Card title="Parent Details" subtitle={`Completion: ${completion}%`}>
            <Input label="Full Name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
            <Input label="Mobile" value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} keyboardType="phone-pad" />
            <Input label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" />
            <Input label="Relation to Student" value={form.relationToStudent} onChangeText={(v) => setForm({ ...form, relationToStudent: v })} />
            <Input label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
            <Input label="Emergency Contact Name" value={form.emergencyContactName} onChangeText={(v) => setForm({ ...form, emergencyContactName: v })} />
            <Input label="Emergency Contact Mobile" value={form.emergencyContactMobile} onChangeText={(v) => setForm({ ...form, emergencyContactMobile: v })} keyboardType="phone-pad" />
            <Input label="Previous School" value={form.previousSchool} onChangeText={(v) => setForm({ ...form, previousSchool: v })} />
            <Input label="Medical Info" value={form.medicalInfo} onChangeText={(v) => setForm({ ...form, medicalInfo: v })} />
            {message ? <Text style={styles.success}>{message}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title={saving ? "Saving..." : "Save Profile"} onPress={handleSave} loading={saving} />
          </Card>

          <Card title="Linked Students" subtitle="Children linked to your account">
            {students.length ? (
              <View style={styles.list}>
                {students.map((student: any) => (
                  <View key={student.id} style={styles.listItem}>
                    <View style={styles.studentRow}>
                      {student.profile?.profilePhotoUrl ? (
                        <Image
                          source={{ uri: resolvePublicUrl(student.profile.profilePhotoUrl) }}
                          style={styles.studentPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.studentPhotoPlaceholder} />
                      )}
                      <View style={styles.studentMeta}>
                        <Text style={styles.title}>{student.fullName ?? "Student"}</Text>
                        <Text style={styles.meta}>Reg. No: {student.registrationNumber ?? "—"}</Text>
                        <Text style={styles.meta}>Admission No: {student.admissionNumber ?? "—"}</Text>
                        <Text style={styles.meta}>Status: {student.status ?? "—"}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.meta}>No linked students.</Text>
            )}
          </Card>
        </>
      ) : (
        <Card title="Student Profile" subtitle="Student details">
          {data.profilePhotoUrl ? (
            <View style={styles.photoWrap}>
              <Image
                source={{ uri: resolvePublicUrl(data.profilePhotoUrl) }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          ) : null}
          <Text style={styles.meta}>Registration No: {data.registrationNumber ?? "—"}</Text>
          <Text style={styles.meta}>Admission No: {data.admissionNumber ?? "—"}</Text>
          <Text style={styles.meta}>Status: {data.status ?? "—"}</Text>
          <Text style={styles.meta}>Class: {data.className ?? "—"}</Text>
          <Text style={styles.meta}>Section: {data.sectionName ?? "—"}</Text>
        </Card>
      )}

      <Button title="Logout" onPress={() => logout()} />
    </ScrollView>
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
  list: {
    marginTop: 12,
    gap: 12,
  },
  listItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentMeta: {
    flex: 1,
    gap: 2,
  },
  studentPhoto: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  studentPhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  success: {
    fontSize: 12,
    color: colors.jade[600],
    fontFamily: typography.fontBody,
  },
  error: {
    fontSize: 12,
    color: colors.sunrise[600],
    fontFamily: typography.fontBody,
  },
  photoWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
});
