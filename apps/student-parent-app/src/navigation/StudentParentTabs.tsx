import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getNotificationsUnreadCount } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { LoadingState, colors, typography } from "@saiyonix/ui";

import StudentParentDashboardScreen from "../screens/app/StudentParentDashboardScreen";
import StudentParentClassroomScreen from "../screens/app/StudentParentClassroomScreen";
import StudentParentTimetableScreen from "../screens/app/StudentParentTimetableScreen";
import StudentParentAttendanceScreen from "../screens/app/StudentParentAttendanceScreen";
import StudentParentNoticesScreen from "../screens/app/StudentParentNoticesScreen";
import StudentParentMoreScreen from "../screens/app/StudentParentMoreScreen";
import StudentParentMessagesScreen from "../screens/app/StudentParentMessagesScreen";
import StudentParentFeesScreen from "../screens/app/StudentParentFeesScreen";
import StudentParentResultsScreen from "../screens/app/StudentParentResultsScreen";
import StudentParentLeaveScreen from "../screens/app/StudentParentLeaveScreen";
import StudentParentProfileScreen from "../screens/app/StudentParentProfileScreen";
import StudentParentIdCardScreen from "../screens/app/StudentParentIdCardScreen";
import StudentParentCertificatesScreen from "../screens/app/StudentParentCertificatesScreen";
import StudentParentExamScreen from "../screens/app/StudentParentExamScreen";
import StudentParentNotificationsScreen from "../screens/app/StudentParentNotificationsScreen";
import StudentParentReportCardsScreen from "../screens/app/StudentParentReportCardsScreen";
import StudentParentAdmitCardsScreen from "../screens/app/StudentParentAdmitCardsScreen";
import StudentParentExamRegistrationScreen from "../screens/app/StudentParentExamRegistrationScreen";
import StudentParentPromotionScreen from "../screens/app/StudentParentPromotionScreen";
import StudentParentHistoryScreen from "../screens/app/StudentParentHistoryScreen";
import StudentParentRankScreen from "../screens/app/StudentParentRankScreen";
import StudentParentClassTeacherScreen from "../screens/app/StudentParentClassTeacherScreen";
import StudentParentPaymentScreen from "../screens/app/StudentParentPaymentScreen";
import StudentParentReceiptScreen from "../screens/app/StudentParentReceiptScreen";
import StudentParentTopbar from "../components/StudentParentTopbar";

export type StudentParentTabParamList = {
  Dashboard: undefined;
  Classroom: undefined;
  Timetable: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type StudentParentStackParamList = {
  Tabs: undefined;
  Messages: undefined;
  Fees: undefined;
  Results: undefined;
  Leaves: undefined;
  Profile: undefined;
  IdCard: undefined;
  Certificates: undefined;
  Exams: undefined;
  Notices: undefined;
  Attendance: undefined;
  More: undefined;
  ReportCards: undefined;
  AdmitCards: undefined;
  ExamRegistration: undefined;
  Promotion: undefined;
  History: undefined;
  Rank: undefined;
  ClassTeacher: undefined;
  Payment: undefined;
  Receipt: { paymentId: string };
};

const Tab = createBottomTabNavigator<StudentParentTabParamList>();
const Stack = createNativeStackNavigator<StudentParentStackParamList>();

function Tabs() {
  const { user, isLoading } = useAuth();
  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: getNotificationsUnreadCount,
    enabled: Boolean(user) && !isLoading,
  });
  const unreadPayload: any = unreadQuery.data;
  const unreadCount =
    typeof unreadPayload === "number"
      ? unreadPayload
      : typeof unreadPayload?.count === "number"
        ? unreadPayload.count
        : 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
          Dashboard: "grid",
          Classroom: "book-open",
          Timetable: "calendar",
          Alerts: "bell",
          Profile: "user",
        };
        return {
          headerShown: false,
          lazy: true,
          lazyPlaceholder: () => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink[50] }}>
              <LoadingState label="Loading workspace" />
            </View>
          ),
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconMap[route.name] ?? "circle"} size={size} color={color} />
          ),
          tabBarActiveTintColor: colors.sky[600],
          tabBarInactiveTintColor: colors.ink[400],
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: typography.fontBody,
            fontWeight: "600",
            marginTop: -2,
          },
          tabBarStyle: {
            height: 66,
            paddingTop: 6,
            paddingBottom: 8,
            borderTopColor: colors.ink[100],
            backgroundColor: "rgba(255,255,255,0.98)",
          },
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={StudentParentDashboardScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Classroom" component={StudentParentClassroomScreen} />
      <Tab.Screen name="Timetable" component={StudentParentTimetableScreen} />
      <Tab.Screen
        name="Alerts"
        component={StudentParentNotificationsScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={StudentParentProfileScreen} />
    </Tab.Navigator>
  );
}

export default function StudentParentTabs() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <StudentParentTopbar />,
        headerShadowVisible: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: true }} />
      <Stack.Screen name="Messages" component={StudentParentMessagesScreen} />
      <Stack.Screen name="Fees" component={StudentParentFeesScreen} />
      <Stack.Screen name="Results" component={StudentParentResultsScreen} />
      <Stack.Screen name="Leaves" component={StudentParentLeaveScreen} />
      <Stack.Screen name="Profile" component={StudentParentProfileScreen} />
      <Stack.Screen name="IdCard" component={StudentParentIdCardScreen} />
      <Stack.Screen name="Certificates" component={StudentParentCertificatesScreen} />
      <Stack.Screen name="Exams" component={StudentParentExamScreen} />
      <Stack.Screen name="Notices" component={StudentParentNoticesScreen} />
      <Stack.Screen name="Attendance" component={StudentParentAttendanceScreen} />
      <Stack.Screen name="More" component={StudentParentMoreScreen} />
      <Stack.Screen name="ReportCards" component={StudentParentReportCardsScreen} />
      <Stack.Screen name="AdmitCards" component={StudentParentAdmitCardsScreen} />
      <Stack.Screen name="ExamRegistration" component={StudentParentExamRegistrationScreen} />
      <Stack.Screen name="Promotion" component={StudentParentPromotionScreen} />
      <Stack.Screen name="History" component={StudentParentHistoryScreen} />
      <Stack.Screen name="Rank" component={StudentParentRankScreen} />
      <Stack.Screen name="ClassTeacher" component={StudentParentClassTeacherScreen} />
      <Stack.Screen name="Payment" component={StudentParentPaymentScreen} />
      <Stack.Screen name="Receipt" component={StudentParentReceiptScreen} />
    </Stack.Navigator>
  );
}
