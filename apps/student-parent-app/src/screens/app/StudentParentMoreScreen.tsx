import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Card, PageHeader, SectionHeader, Button, colors } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";

export default function StudentParentMoreScreen() {
  const navigation = useNavigation();
  const { role } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="More" subtitle={role === "PARENT" ? "Parent modules" : "Student modules"} />

      <Card>
        <SectionHeader title="Core" subtitle="Primary modules" accent="sky" />
        <View style={styles.actions}>
          <Button title="Dashboard" variant="secondary" onPress={() => navigation.navigate("Dashboard" as never)} />
          <Button title={role === "PARENT" ? "Child Timetable" : "My Timetable"} variant="secondary" onPress={() => navigation.navigate("Timetable" as never)} />
          <Button title="Attendance" variant="secondary" onPress={() => navigation.navigate("Attendance" as never)} />
          <Button title="Notices" variant="secondary" onPress={() => navigation.navigate("Notices" as never)} />
          <Button title="Messages" variant="secondary" onPress={() => navigation.navigate("Messages" as never)} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Student Services" subtitle="Academics and finance" accent="emerald" />
        <View style={styles.actions}>
          <Button title="Fees & Payments" variant="secondary" onPress={() => navigation.navigate("Fees" as never)} />
          <Button title="Results" variant="secondary" onPress={() => navigation.navigate("Results" as never)} />
          <Button title="Leaves" variant="secondary" onPress={() => navigation.navigate("Leaves" as never)} />
          <Button title="Exam Routine" variant="secondary" onPress={() => navigation.navigate("Exams" as never)} />
          <Button title="Certificates" variant="secondary" onPress={() => navigation.navigate("Certificates" as never)} />
          <Button title="ID Card" variant="secondary" onPress={() => navigation.navigate("IdCard" as never)} />
          <Button title="Profile" variant="secondary" onPress={() => navigation.navigate("Profile" as never)} />
        </View>
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
  actions: {
    marginTop: 12,
    gap: 10,
  },
});
