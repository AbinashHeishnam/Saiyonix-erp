import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { resolvePublicUrl } from "@saiyonix/api";
import { colors, radius, typography } from "../theme";

type TeacherIdCardData = {
  teacher: {
    fullName?: string | null;
    employeeId?: string | null;
    designation?: string | null;
    department?: string | null;
    joiningDate?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    photoUrl?: string | null;
  };
  school: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
  };
};

export default function TeacherIdCard({ data }: { data: TeacherIdCardData }) {
  const joiningDate = data.teacher.joiningDate
    ? new Date(data.teacher.joiningDate).toLocaleDateString("en-IN")
    : "—";
  const photoUrl = data.teacher.photoUrl ? resolvePublicUrl(data.teacher.photoUrl) : null;
  const logoUrl = data.school.logoUrl ? resolvePublicUrl(data.school.logoUrl) : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerBackground} />
      <View style={styles.headerRow}>
        <View style={styles.logoWrap}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.logoFallback}>LOGO</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.schoolName}>{data.school.name ?? "School"}</Text>
          <Text style={styles.headerSub}>Teacher Identity Card</Text>
        </View>
      </View>

      <View style={styles.photoSection}>
        <View style={styles.photoGlow} />
        <View style={styles.photoWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoFallbackText}>No Photo</Text>
            </View>
          )}
        </View>
        <Text style={styles.teacherName}>{data.teacher.fullName ?? "Teacher"}</Text>
        <Text style={styles.facultyLabel}>Faculty</Text>
      </View>

      <View style={styles.details}>
        <DetailRow label="Emp ID" value={data.teacher.employeeId ?? "—"} />
        <DetailRow label="Dept" value={data.teacher.department ?? "—"} />
        <DetailRow label="Role" value={data.teacher.designation ?? "—"} />
        <DetailRow label="Join" value={joiningDate} />
        <DetailRow label="Phone" value={data.teacher.phone ?? "—"} />
        <DetailRow label="Email" value={data.teacher.email ?? "—"} />
        {data.teacher.address ? (
          <View style={styles.address}>
            <Text style={styles.addressText}>{data.teacher.address}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={styles.footerLine}>{data.school.address ?? "Kanchipur"}</Text>
          <Text style={styles.footerLine}>
            {data.school.phone ? `Phone: ${data.school.phone}` : ""}
          </Text>
        </View>
        <View style={styles.qrPlaceholder}>
          <Text style={styles.qrText}>QR</Text>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundColor: colors.ink[900],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoFallback: {
    fontSize: 10,
    color: colors.white,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  headerText: {
    flex: 1,
  },
  schoolName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.white,
    fontFamily: typography.fontDisplay,
    textTransform: "uppercase",
  },
  headerSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.9)",
    fontFamily: typography.fontBody,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  photoSection: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
  },
  photoGlow: {
    position: "absolute",
    top: 6,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  photoWrap: {
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.white,
    overflow: "hidden",
    backgroundColor: colors.ink[50],
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackText: {
    fontSize: 10,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  teacherName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink[800],
    fontFamily: typography.fontDisplay,
    textAlign: "center",
  },
  facultyLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  details: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 11,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "600",
    textAlign: "right",
  },
  address: {
    marginTop: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addressText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.8)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerText: {
    flex: 1,
  },
  footerLine: {
    fontSize: 9,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
  qrPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  qrText: {
    fontSize: 9,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
