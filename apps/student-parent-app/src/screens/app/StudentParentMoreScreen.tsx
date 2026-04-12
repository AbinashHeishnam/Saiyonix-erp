import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Card, PageHeader, SectionHeader, Button, colors } from "@saiyonix/ui";
import { useAuth } from "@saiyonix/auth";

export default function StudentParentMoreScreen() {
  const navigation = useNavigation();
  const { role } = useAuth();

  const navigateTo = (route: string) => {
    const tabRoutes = new Set(["Dashboard", "Classroom", "Timetable", "Alerts", "Profile"]);
    if (tabRoutes.has(route)) {
      navigation.navigate("Tabs" as never, { screen: route } as never);
      return;
    }
    navigation.navigate(route as never);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="More" subtitle={role === "PARENT" ? "Parent modules" : "Student modules"} />

      <Card>
        <SectionHeader title="Core" subtitle="Primary modules" accent="sky" />
        <View style={styles.actions}>
          <Button title="Home" variant="secondary" onPress={() => navigateTo("Dashboard")} />
          <Button title="Classroom" variant="secondary" onPress={() => navigateTo("Classroom")} />
          <Button title={role === "PARENT" ? "Child Timetable" : "My Timetable"} variant="secondary" onPress={() => navigateTo("Timetable")} />
          <Button title="Attendance" variant="secondary" onPress={() => navigateTo("Attendance")} />
          <Button title="Notices" variant="secondary" onPress={() => navigateTo("Notices")} />
          <Button title="Alerts" variant="secondary" onPress={() => navigateTo("Alerts")} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Student Services" subtitle="Academics and finance" accent="emerald" />
        <View style={styles.actions}>
          <Button title="Fees & Payments" variant="secondary" onPress={() => navigateTo("Fees")} />
          <Button title="Pay Now" variant="secondary" onPress={() => navigateTo("Payment")} />
          <Button title="Results" variant="secondary" onPress={() => navigateTo("Results")} />
          <Button title="Report Cards" variant="secondary" onPress={() => navigateTo("ReportCards")} />
          <Button title="Admit Cards" variant="secondary" onPress={() => navigateTo("AdmitCards")} />
          <Button title="Exam Registration" variant="secondary" onPress={() => navigateTo("ExamRegistration")} />
          <Button title="Exam Routine" variant="secondary" onPress={() => navigateTo("Exams")} />
          <Button title="Leaves" variant="secondary" onPress={() => navigateTo("Leaves")} />
          <Button title="Promotion" variant="secondary" onPress={() => navigateTo("Promotion")} />
          <Button title="Academic History" variant="secondary" onPress={() => navigateTo("History")} />
          <Button title="Rank" variant="secondary" onPress={() => navigateTo("Rank")} />
          <Button title="Certificates" variant="secondary" onPress={() => navigateTo("Certificates")} />
          <Button title="ID Card" variant="secondary" onPress={() => navigateTo("IdCard")} />
          <Button title="Class Teacher" variant="secondary" onPress={() => navigateTo("ClassTeacher")} />
          <Button title="Messages" variant="secondary" onPress={() => navigateTo("Messages")} />
          <Button title="Profile" variant="secondary" onPress={() => navigateTo("Profile")} />
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
