import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import OtpLoginScreen from "../screens/auth/OtpLoginScreen";

export type StudentParentAuthStackParamList = {
  OtpLogin: undefined;
};

const Stack = createNativeStackNavigator<StudentParentAuthStackParamList>();

export default function StudentParentAuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="OtpLogin" component={OtpLoginScreen} />
    </Stack.Navigator>
  );
}
