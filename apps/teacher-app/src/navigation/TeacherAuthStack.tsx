import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import TeacherLoginScreen from "../screens/auth/TeacherLoginScreen";
import TeacherAccessScreen from "../screens/auth/TeacherAccessScreen";

export type TeacherAuthStackParamList = {
  TeacherLogin: undefined;
  TeacherAccess: { mode: "activate" | "forgot" };
};

const Stack = createNativeStackNavigator<TeacherAuthStackParamList>();

export default function TeacherAuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="TeacherLogin" component={TeacherLoginScreen} />
      <Stack.Screen name="TeacherAccess" component={TeacherAccessScreen} />
    </Stack.Navigator>
  );
}
