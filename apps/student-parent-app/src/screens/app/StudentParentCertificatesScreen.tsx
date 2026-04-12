import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listCertificateRequests } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { formatDate } from "@saiyonix/utils";
import { useActiveStudent } from "../../hooks/useActiveStudent";

export default function StudentParentCertificatesScreen() {
  const { role } = useAuth();
  const { activeStudent } = useActiveStudent();
  const query = useQuery({
    queryKey: ["certificates", activeStudent?.id, role],
    queryFn: () => listCertificateRequests(role === "PARENT" ? { studentId: activeStudent?.id } : undefined),
  });

  const items = Array.isArray(query.data) ? query.data : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Certificates" subtitle="Request and download certificates." />

      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message="Unable to load certificates." /> : null}

      <Card title="Certificates" subtitle="Requests & downloads">
        {items.length ? (
          <View style={styles.list}>
            {items.map((item: any) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listHeader}>
                  <Text style={styles.title}>{item.type ?? "Certificate"}</Text>
                  <StatusBadge
                    variant={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}
                    label={item.status ?? "PENDING"}
                    dot={false}
                  />
                </View>
                <Text style={styles.meta}>Requested: {formatDate(item.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No certificate requests" subtitle="Requests will appear here." />
        )}
      </Card>
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
    gap: 6,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
});
