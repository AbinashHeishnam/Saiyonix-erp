import React, { useEffect, useMemo, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@saiyonix/auth";

import BrandedLoadingScreen from "../screens/shared/BrandedLoadingScreen";
import RoleMismatchScreen from "../screens/shared/RoleMismatchScreen";
import TeacherAuthStack from "./TeacherAuthStack";
import TeacherTabs from "./TeacherTabs";

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  RoleMismatch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, role, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [bootstrapExpired, setBootstrapExpired] = useState(false);

  useEffect(() => {
    const splashTimer = setTimeout(() => setSplashDone(true), 3000);
    const bootstrapTimer = setTimeout(() => setBootstrapExpired(true), 9000);
    return () => {
      clearTimeout(splashTimer);
      clearTimeout(bootstrapTimer);
    };
  }, []);

  const showSplash = !splashDone || (isLoading && !bootstrapExpired);
  const resolvedUser = useMemo(() => {
    if (isLoading && bootstrapExpired) return null;
    return user;
  }, [bootstrapExpired, isLoading, user]);
  const resolvedRole = useMemo(() => {
    if (isLoading && bootstrapExpired) return null;
    return role;
  }, [bootstrapExpired, isLoading, role]);

  if (showSplash) {
    return <BrandedLoadingScreen phase={splashDone ? "bootstrap" : "startup"} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {!resolvedUser ? (
        <Stack.Screen name="Auth" component={TeacherAuthStack} />
      ) : resolvedRole !== "TEACHER" ? (
        <Stack.Screen name="RoleMismatch" component={RoleMismatchScreen} />
      ) : (
        <Stack.Screen name="App" component={TeacherTabs} />
      )}
    </Stack.Navigator>
  );
}
