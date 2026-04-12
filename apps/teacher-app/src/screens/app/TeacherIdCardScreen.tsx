import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getTeacherIdCard } from "@saiyonix/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, TeacherIdCard, colors, typography } from "@saiyonix/ui";

export default function TeacherIdCardScreen() {
  const query = useQuery({
    queryKey: ["teacher", "id-card"],
    queryFn: getTeacherIdCard,
  });

  if (query.isLoading) return <LoadingState label="Loading ID card" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="Teacher ID Card" subtitle="Official faculty identity card" />
      {query.error ? <ErrorState message="Unable to load ID card." /> : null}

      <Card>
        {query.data ? (
          <View style={styles.cardWrap}>
            <TeacherIdCard data={query.data} />
            <View style={styles.actions}>
              <Button title="Download PDF" disabled />
              <Button title="Print" variant="secondary" disabled />
            </View>
          </View>
        ) : (
          <EmptyState title="ID card unavailable" subtitle="Please contact the administration." />
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
  cardWrap: {
    alignItems: "center",
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
});
