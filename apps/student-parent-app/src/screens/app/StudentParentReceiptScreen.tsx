import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getReceipt } from "@saiyonix/api";
import { Button, Card, ErrorState, LoadingState, PageHeader, colors, typography } from "@saiyonix/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StudentParentStackParamList } from "../../navigation/StudentParentTabs";
import { openFileUrl } from "../../utils/files";

export default function StudentParentReceiptScreen({ route }: NativeStackScreenProps<StudentParentStackParamList, "Receipt">) {
  const { paymentId } = route.params;
  const query = useQuery({
    queryKey: ["fees", "receipt", paymentId],
    queryFn: () => getReceipt(paymentId),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Receipt" subtitle="Payment receipt details" />

      {query.isLoading ? <LoadingState label="Loading receipt" /> : null}
      {query.error ? <ErrorState message="Unable to load receipt." /> : null}

      {query.data ? (
        <Card title={`Receipt #${query.data.paymentId ?? query.data.id}`}> 
          <View style={styles.block}>
            <Text style={styles.meta}>Status: {query.data.status ?? "—"}</Text>
            <Text style={styles.meta}>Amount: ₹{query.data.amount ?? query.data.paidAmount ?? "—"}</Text>
            <Text style={styles.meta}>Paid At: {query.data.paidAt ? new Date(query.data.paidAt).toLocaleString() : "—"}</Text>
            {query.data.receiptUrl || query.data.pdfUrl ? (
              <Button
                title="Open Receipt"
                onPress={() => openFileUrl(query.data.receiptUrl ?? query.data.pdfUrl)}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
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
  block: {
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
});
