import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentChildIdCard, getStudentIdCard, resolvePublicUrl } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

export default function StudentParentIdCardScreen() {
  const { role } = useAuth();
  const query = useQuery({
    queryKey: ["id-card", role],
    queryFn: () => (role === "PARENT" ? getParentChildIdCard() : getStudentIdCard()),
  });

  const data: any = query.data;
  const photoUrl = data?.student?.photoUrl ? resolvePublicUrl(data.student.photoUrl) : null;
  const logoUrl = data?.school?.logoUrl ? resolvePublicUrl(data.school.logoUrl) : null;
  const classLabel = [data?.className, data?.sectionName].filter(Boolean).join(" ");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Digital ID Card" subtitle="Official school identity card" />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load ID card." /> : null}

      {data ? (
        <Card>
          <View style={styles.cardShell}>
            <View style={styles.heroBand} />
            <View style={styles.heroGlowRight} />
            <View style={styles.heroGlowLeft} />

            <View style={styles.headerRow}>
              <View style={styles.logoWrap}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.logoFallback}>LOGO</Text>
                )}
              </View>
              <View style={styles.headerText}>
                <Text style={styles.schoolName}>{data.school?.name ?? "School"}</Text>
                <Text style={styles.schoolSub}>Student Identity Card</Text>
              </View>
            </View>

            <View style={styles.studentRow}>
              <View style={styles.photoOuter}>
                <View style={styles.photoWrap}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.photoImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoFallback}>
                      <Text style={styles.photoFallbackText}>No Photo</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.studentMeta}>
                <Text style={styles.studentName}>{data.student?.fullName ?? "Student"}</Text>
                <Text style={styles.studentRole}>Student</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              {[
                ["Class", classLabel || "—"],
                ["Adm No", data.student?.admissionNumber ?? "—"],
                ["Roll No", data.rollNumber ?? "Pending"],
                ["DOB", formatDate(data.student?.dateOfBirth)],
                ["Parent", data.parentName ?? "—"],
                ["Phone", data.parentPhone ?? "—"],
                ["Blood", data.student?.bloodGroup ?? "—"],
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </React.Fragment>
              ))}
            </View>

            {data.student?.address ? (
              <View style={styles.addressBox}>
                <Text style={styles.addressText}>{data.student.address}</Text>
              </View>
            ) : null}

            <View style={styles.footerRow}>
              <View style={styles.footerText}>
                <Text style={styles.footerLine}>{data.school?.address ?? "Kanchipur"}</Text>
                <Text style={styles.footerLine}>{data.school?.phone ? `Phone: ${data.school.phone}` : ""}</Text>
              </View>
              <View style={styles.qrStub}>
                <Text style={styles.qrText}>QR CODE</Text>
              </View>
            </View>
          </View>
        </Card>
      ) : (
        <EmptyState title="ID card unavailable" subtitle="Please contact the administration." />
      )}
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
  cardShell: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    backgroundColor: colors.white,
    minHeight: 500,
  },
  heroBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "#2563eb",
  },
  heroGlowRight: {
    position: "absolute",
    top: 38,
    right: 24,
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroGlowLeft: {
    position: "absolute",
    top: 28,
    left: 20,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  headerText: {
    flex: 1,
  },
  schoolName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: typography.fontDisplay,
    textTransform: "uppercase",
  },
  schoolSub: {
    marginTop: 2,
    color: "#dbeafe",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: typography.fontBody,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  studentRow: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  photoOuter: {
    shadowColor: "#4338ca",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  photoWrap: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.white,
    overflow: "hidden",
    backgroundColor: colors.ink[100],
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink[100],
  },
  photoFallbackText: {
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  studentMeta: {
    alignItems: "center",
    marginTop: 10,
  },
  studentName: {
    fontSize: 20,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "800",
    textAlign: "center",
  },
  studentRole: {
    marginTop: 2,
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  detailGrid: {
    marginTop: 18,
    paddingHorizontal: 24,
    rowGap: 8,
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailLabel: {
    width: 72,
    fontSize: 11,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  detailValue: {
    width: "70%",
    fontSize: 11,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  addressBox: {
    marginTop: 14,
    marginHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressText: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  footerRow: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.8)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerText: {
    flex: 1,
  },
  footerLine: {
    fontSize: 10,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  qrStub: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ink[300],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  qrText: {
    fontSize: 8,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
});
