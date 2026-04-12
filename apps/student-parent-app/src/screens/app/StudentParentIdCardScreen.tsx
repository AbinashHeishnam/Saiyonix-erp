import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getParentChildIdCard, getStudentIdCard } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";

export default function StudentParentIdCardScreen() {
  const { role } = useAuth();
  const query = useQuery({
    queryKey: ["id-card", role],
    queryFn: role === "PARENT" ? getParentChildIdCard : getStudentIdCard,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="ID Card" subtitle="View and print your digital ID card." />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load ID card." /> : null}

      {query.data ? (
        <Card title="Student ID" subtitle={query.data.school?.name ?? "School"}>
          <View style={styles.list}>
            <Text style={styles.title}>{query.data.student?.fullName ?? "Student"}</Text>
            <Text style={styles.meta}>Admission No: {query.data.student?.admissionNumber ?? "—"}</Text>
            <Text style={styles.meta}>Class: {query.data.className ?? "—"}</Text>
            <Text style={styles.meta}>Section: {query.data.sectionName ?? "—"}</Text>
            <Text style={styles.meta}>Roll: {query.data.rollNumber ?? "—"}</Text>
            <Text style={styles.meta}>Parent: {query.data.parentName ?? "—"}</Text>
            <Text style={styles.meta}>Contact: {query.data.parentPhone ?? "—"}</Text>
          </View>
        </Card>
      ) : (
        <EmptyState title="No ID card available" subtitle="Please contact admin." />
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
  list: {
    marginTop: 12,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 13,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
