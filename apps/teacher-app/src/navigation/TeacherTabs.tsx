import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "@saiyonix/api";
import { LoadingState, colors, typography } from "@saiyonix/ui";
import { View } from "react-native";

import TeacherDashboardScreen from "../screens/app/TeacherDashboardScreen";
import TeacherClassroomScreen from "../screens/app/TeacherClassroomScreen";
import TeacherTimetableScreen from "../screens/app/TeacherTimetableScreen";
import TeacherAttendanceScreen from "../screens/app/TeacherAttendanceScreen";
import TeacherNotificationsScreen from "../screens/app/TeacherNotificationsScreen";
import TeacherNoticesScreen from "../screens/app/TeacherNoticesScreen";
import TeacherMessagesScreen from "../screens/app/TeacherMessagesScreen";
import TeacherProfileScreen from "../screens/app/TeacherProfileScreen";
import TeacherLeaveScreen from "../screens/app/TeacherLeaveScreen";
import TeacherHistoryScreen from "../screens/app/TeacherHistoryScreen";
import TeacherOperationalHistoryScreen from "../screens/app/TeacherOperationalHistoryScreen";
import TeacherIdCardScreen from "../screens/app/TeacherIdCardScreen";
import TeacherPromotionScreen from "../screens/app/TeacherPromotionScreen";
import TeacherMarksScreen from "../screens/app/TeacherMarksScreen";
import TeacherAnalyticsScreen from "../screens/app/TeacherAnalyticsScreen";
import TeacherRankScreen from "../screens/app/TeacherRankScreen";
import TeacherTopbar from "../components/TeacherTopbar";

export type TeacherTabParamList = {
  Dashboard: undefined;
  Classroom: undefined;
  Timetable: undefined;
  Attendance: undefined;
  Alerts: undefined;
};

export type TeacherStackParamList = {
  Tabs: undefined;
  TeacherLeave: undefined;
  TeacherHistory: undefined;
  TeacherOperationalHistory: undefined;
  TeacherIdCard: undefined;
  TeacherPromotion: undefined;
  TeacherMessages: undefined;
  TeacherNotices: undefined;
  TeacherProfile: undefined;
  TeacherMarks: undefined;
  TeacherAnalytics: undefined;
  TeacherRank: undefined;
};

const Tab = createBottomTabNavigator<TeacherTabParamList>();
const Stack = createNativeStackNavigator<TeacherStackParamList>();

function Tabs() {
  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: getUnreadCount,
  });
  const unreadCount = typeof unreadQuery.data?.count === "number" ? unreadQuery.data.count : 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
          Dashboard: "grid",
          Classroom: "book-open",
          Timetable: "calendar",
          Attendance: "check-circle",
          Alerts: "bell",
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
      <Tab.Screen name="Dashboard" component={TeacherDashboardScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Classroom" component={TeacherClassroomScreen} />
      <Tab.Screen name="Timetable" component={TeacherTimetableScreen} />
      <Tab.Screen name="Attendance" component={TeacherAttendanceScreen} />
      <Tab.Screen
        name="Alerts"
        component={TeacherNotificationsScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

export default function TeacherTabs() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <TeacherTopbar />,
        headerShadowVisible: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: true }} />
      <Stack.Screen name="TeacherLeave" component={TeacherLeaveScreen} options={{ title: "My Leaves" }} />
      <Stack.Screen name="TeacherHistory" component={TeacherHistoryScreen} options={{ title: "Teaching History" }} />
      <Stack.Screen name="TeacherOperationalHistory" component={TeacherOperationalHistoryScreen} options={{ title: "Operational History" }} />
      <Stack.Screen name="TeacherIdCard" component={TeacherIdCardScreen} options={{ title: "ID Card" }} />
      <Stack.Screen name="TeacherPromotion" component={TeacherPromotionScreen} options={{ title: "Promotions" }} />
      <Stack.Screen name="TeacherMessages" component={TeacherMessagesScreen} options={{ title: "Messages" }} />
      <Stack.Screen name="TeacherNotices" component={TeacherNoticesScreen} options={{ title: "Notices" }} />
      <Stack.Screen name="TeacherProfile" component={TeacherProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="TeacherMarks" component={TeacherMarksScreen} options={{ title: "Marks" }} />
      <Stack.Screen name="TeacherAnalytics" component={TeacherAnalyticsScreen} options={{ title: "Student Analytics" }} />
      <Stack.Screen name="TeacherRank" component={TeacherRankScreen} options={{ title: "Student Rank" }} />
    </Stack.Navigator>
  );
}
