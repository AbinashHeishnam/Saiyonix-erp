import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@saiyonix/auth";

import BrandedLoadingScreen from "../screens/shared/BrandedLoadingScreen";
import RoleMismatchScreen from "../screens/shared/RoleMismatchScreen";
import StudentParentAuthStack from "./StudentParentAuthStack";
import StudentParentTabs from "./StudentParentTabs";

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  RoleMismatch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <BrandedLoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={StudentParentAuthStack} />
      ) : role === "STUDENT" || role === "PARENT" ? (
        <Stack.Screen name="App" component={StudentParentTabs} />
      ) : (
        <Stack.Screen name="RoleMismatch" component={RoleMismatchScreen} />
      )}
    </Stack.Navigator>
  );
}
