import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { API_ORIGIN, getAuthTokens } from "@saiyonix/api";
import { Button, Card, PageHeader, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";

export default function StudentParentPaymentScreen() {
  const { activeStudentId } = useActiveStudent();
  const handleOpenPortal = () => {
    const { accessToken, refreshToken } = getAuthTokens();
    const params = new URLSearchParams();
    if (activeStudentId) params.set("studentId", activeStudentId);
    if (accessToken) params.set("token", accessToken);
    if (refreshToken) params.set("refreshToken", refreshToken);
    const url = `${API_ORIGIN}/fees/pay${params.toString() ? `?${params.toString()}` : ""}`;
    void Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Pay Fees" subtitle="Secure payment flow with instant receipts and eligibility updates." />

      <Card title="Payment" subtitle="Use the secure fee payment portal">
        <Text style={styles.meta}>
          Continue in the official SaiyoniX web payment flow. After payment, receipts and fee status updates will appear under Fees.
        </Text>
        <Button title="Pay Now" onPress={handleOpenPortal} />
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
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    marginBottom: 12,
  },
});
