import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RazorpayCheckout from "react-native-razorpay";
import Constants from "expo-constants";
import { createPaymentOrder, getRazorpayKey, getStudentFeeStatus, verifyPayment } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusBadge, colors, typography } from "@saiyonix/ui";
import { useActiveStudent } from "../../hooks/useActiveStudent";

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function StudentParentPaymentScreen() {
  const { activeStudentId } = useActiveStudent();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isExpoGo = Constants.appOwnership === "expo";
  const [customAmount, setCustomAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const feeQuery = useQuery({
    queryKey: ["fee-status", activeStudentId],
    queryFn: () => getStudentFeeStatus(activeStudentId ?? ""),
    enabled: Boolean(activeStudentId),
  });

  const razorpayKeyQuery = useQuery({
    queryKey: ["razorpay-key"],
    queryFn: getRazorpayKey,
  });

  const status = (feeQuery.data as any)?.status ?? "NOT_PUBLISHED";
  const total = (feeQuery.data as any)?.finalAmount ?? (feeQuery.data as any)?.totalAmount ?? null;
  const paid = (feeQuery.data as any)?.paidAmount ?? 0;
  const remaining = total === null ? null : Math.max(Number(total) - Number(paid), 0);
  const canPay = remaining !== null && remaining > 0 && status !== "NOT_PUBLISHED";

  const statusVariant = useMemo(() => {
    if (status === "PAID") return "success";
    if (status === "PARTIAL") return "warning";
    if (status === "NOT_PUBLISHED") return "neutral";
    return "danger";
  }, [status]);

  const handlePayNow = async () => {
    console.log("CLICK:", "fees_pay_now");
    if (isPaying) return;
    const amountToPay =
      customAmount.trim().length > 0
        ? Number(customAmount)
        : typeof remaining === "number"
          ? remaining
          : Number(customAmount);
    const paymentAmount = amountToPay;
    if (!activeStudentId) return;
    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount to pay.");
      return;
    }
    if (typeof remaining === "number" && paymentAmount > remaining) {
      Alert.alert("Invalid amount", "Amount cannot exceed remaining due.");
      return;
    }

    if (isExpoGo) {
      Alert.alert("Unsupported", "Payment is not supported in Expo Go. Please install the app build.");
      return;
    }

    if (!RazorpayCheckout || typeof (RazorpayCheckout as any).open !== "function") {
      console.log("[PAYMENT] Razorpay not available");
      Alert.alert("Payment not supported in this build");
      return;
    }

    const razorpayKey = (razorpayKeyQuery.data as any)?.keyId ?? null;
    if (!razorpayKey) return;

    setPaymentError(null);
    setIsPaying(true);
    try {
      const order: any = await createPaymentOrder({
        amount: paymentAmount, // rupees
        requestedAmount: paymentAmount,
        currency: "INR",
        studentId: activeStudentId,
        metadata: { purpose: "fee" },
      });

      const orderId = order?.id ?? order?.orderId ?? null;
      const orderAmount = order?.amount ?? null;
      const key = razorpayKey;

      console.log("[PAYMENT INIT]", {
        key,
        orderId,
        orderAmount,
      });

      if (!orderId || !orderAmount || !Number.isFinite(Number(orderAmount))) {
        throw new Error("Invalid payment order. Please try again.");
      }

      const options: any = {
        key,
        amount: Number(orderAmount), // paise from backend
        currency: "INR",
        order_id: orderId,
        name: "Saiyonix",
        description: "Fee payment",
        prefill: {
          name: (user?.email ?? "").split("@")[0] ?? "",
          email: user?.email ?? "",
        },
      };

      if (!options.key || !options.amount || !options.currency || !options.order_id) {
        throw new Error("Payment initialization failed. Please try again.");
      }

      let result: any;
      try {
        result = await (RazorpayCheckout as any).open(options);
      } catch (err: any) {
        console.log("PAYMENT ERROR", err);
        throw err;
      }

      await verifyPayment({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });

      queryClient.invalidateQueries({ queryKey: ["fee-status", activeStudentId] });
      queryClient.invalidateQueries({ queryKey: ["fees", "receipts", activeStudentId] });
      navigation.navigate("Fees" as never);
    } catch (err: any) {
      const errorDescription =
        err?.description ??
        err?.error?.description ??
        err?.message ??
        "Payment cancelled";
      console.log("[PAYMENT FAILED]", err);
      setPaymentError(errorDescription);
      try {
        if (err?.error?.metadata?.order_id) {
          await verifyPayment({
            razorpayOrderId: err.error.metadata.order_id,
            razorpayPaymentId: err.error.metadata.payment_id ?? "failed",
            razorpaySignature: "failed",
            errorMessage: errorDescription,
          });
        }
      } catch {
        // ignore logging failures
      }
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Pay Fees" subtitle="Secure payment flow with instant receipts and eligibility updates." />

      {!activeStudentId ? (
        <ErrorState message="Select a student to pay fees." />
      ) : feeQuery.isLoading ? (
        <LoadingState label="Loading fee details" />
      ) : feeQuery.error ? (
        <ErrorState message="Unable to load fee details." />
      ) : (
        <Card title="Payment" subtitle="Enter the amount you want to pay">
          <View style={styles.feeMetaRow}>
            <Text style={styles.metaStrong}>Fee Status</Text>
            <StatusBadge variant={statusVariant} label={status} />
            <Text style={styles.meta}>Remaining: {formatCurrency(remaining)}</Text>
          </View>

          {status === "NOT_PUBLISHED" ? (
            <Text style={styles.warning}>Fee not available yet.</Text>
          ) : null}
          {paymentError ? (
            <Text style={styles.paymentError}>{paymentError}</Text>
          ) : null}

          <Text style={styles.metaStrong}>Amount to Pay</Text>
          <TextInput
            style={[styles.input, !canPay && styles.inputDisabled]}
            editable={canPay && !isPaying}
            keyboardType="numeric"
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder={remaining ? String(remaining) : "0"}
          />
          <Text style={styles.meta}>Partial payments are allowed.</Text>

          <View style={styles.actions}>
            <Button
              title={isPaying ? "Processing..." : "Pay Now"}
              onPress={handlePayNow}
              loading={isPaying}
              disabled={!canPay || isPaying}
            />
            <Button
              title="Pay Remaining"
              variant="secondary"
              onPress={() => setCustomAmount(remaining ? String(remaining) : "")}
              disabled={!canPay || isPaying}
            />
          </View>
        </Card>
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
  meta: {
    fontSize: 12,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    marginBottom: 12,
  },
  metaStrong: {
    fontSize: 12,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  warning: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  paymentError: {
    fontSize: 12,
    color: colors.rose[600],
    fontFamily: typography.fontBody,
    marginTop: 8,
  },
  feeMetaRow: {
    gap: 8,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink[800],
    fontFamily: typography.fontBody,
    backgroundColor: colors.white,
    marginTop: 8,
    marginBottom: 8,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
});
