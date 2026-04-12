import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import StudentParentDashboardScreen from "../screens/app/StudentParentDashboardScreen";
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

export type StudentParentTabParamList = {
  Dashboard: undefined;
  Timetable: undefined;
  Attendance: undefined;
  Notices: undefined;
  More: undefined;
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
};

const Tab = createBottomTabNavigator<StudentParentTabParamList>();
const Stack = createNativeStackNavigator<StudentParentStackParamList>();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={StudentParentDashboardScreen} />
      <Tab.Screen name="Timetable" component={StudentParentTimetableScreen} />
      <Tab.Screen name="Attendance" component={StudentParentAttendanceScreen} />
      <Tab.Screen name="Notices" component={StudentParentNoticesScreen} />
      <Tab.Screen name="More" component={StudentParentMoreScreen} />
    </Tab.Navigator>
  );
}

export default function StudentParentTabs() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Messages" component={StudentParentMessagesScreen} />
      <Stack.Screen name="Fees" component={StudentParentFeesScreen} />
      <Stack.Screen name="Results" component={StudentParentResultsScreen} />
      <Stack.Screen name="Leaves" component={StudentParentLeaveScreen} />
      <Stack.Screen name="Profile" component={StudentParentProfileScreen} />
      <Stack.Screen name="IdCard" component={StudentParentIdCardScreen} />
      <Stack.Screen name="Certificates" component={StudentParentCertificatesScreen} />
      <Stack.Screen name="Exams" component={StudentParentExamScreen} />
    </Stack.Navigator>
  );
}
