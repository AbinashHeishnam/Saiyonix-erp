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

  const payment = (query.data as any)?.payment ?? null;
  const receipt = (query.data as any)?.receipt ?? null;
  const fee = (query.data as any)?.fee ?? null;
  const student = (query.data as any)?.student ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Receipt" subtitle="Payment receipt details" />

      {query.isLoading ? <LoadingState label="Loading receipt" /> : null}
      {query.error ? <ErrorState message="Unable to load receipt." /> : null}

      {query.data ? (
        <Card title={`Receipt #${receipt?.number ?? payment?.id ?? paymentId}`}>
          <View style={styles.block}>
            <Text style={styles.meta}>Payment ID: {payment?.id ?? "—"}</Text>
            <Text style={styles.meta}>Transaction: {payment?.transactionId ?? "—"}</Text>
            <Text style={styles.meta}>Student: {student?.fullName ?? "Student"}</Text>
            {student?.registrationNumber ? (
              <Text style={styles.meta}>Reg No: {student.registrationNumber}</Text>
            ) : null}
            <Text style={styles.meta}>Status: {payment?.status ?? "—"}</Text>
            <Text style={styles.meta}>Amount: ₹{payment?.amount ?? "—"}</Text>
            <Text style={styles.meta}>
              Paid At: {payment?.createdAt ? new Date(payment.createdAt).toLocaleString() : "—"}
            </Text>
            <Text style={styles.meta}>Fee Status: {fee?.status ?? "—"}</Text>
            <Text style={styles.meta}>Total Paid: ₹{fee?.paidAmount ?? "—"}</Text>

            {receipt?.pdfUrl ? (
              <Button
                title="Open Receipt"
                onPress={() => openFileUrl(receipt.pdfUrl)}
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
