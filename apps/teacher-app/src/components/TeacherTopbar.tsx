import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUnreadCount } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { colors, typography } from "@saiyonix/ui";
import TeacherMenuSheet from "./TeacherMenuSheet";

export default function TeacherTopbar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isRestricted = Boolean(user?.restricted);
  const { data: unreadData } = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: getUnreadCount,
    enabled: Boolean(user) && !isRestricted,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, err: any) => {
      if (err?.response?.status === 429) return false;
      return count < 1;
    },
  });
  const unreadCount = typeof unreadData?.count === "number" ? unreadData.count : 0;

  const initials = useMemo(() => {
    if (!user?.email) return "T";
    return user.email.slice(0, 1).toUpperCase();
  }, [user?.email]);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
    []
  );

  const roleLabel = useMemo(() => {
    if (!role) return "Teacher";
    if (role === "SUPER_ADMIN") return "Super Admin";
    if (role === "ACADEMIC_SUB_ADMIN") return "Academic Admin";
    if (role === "FINANCE_SUB_ADMIN") return "Finance Admin";
    return role.charAt(0) + role.slice(1).toLowerCase();
  }, [role]);

  const navigateTo = (route: string) => {
    const tabRoutes = new Set(["Dashboard", "Classroom", "Timetable", "Attendance", "Alerts"]);
    if (tabRoutes.has(route)) {
      navigation.navigate("Tabs" as never, { screen: route } as never);
      return;
    }
    navigation.navigate(route as never);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.iconButton}>
            <Feather name="menu" size={18} color={colors.ink[600]} />
          </Pressable>
          <View>
            <Text style={styles.title}>Teacher Workspace</Text>
            <Text style={styles.subtitle}>{today}</Text>
          </View>
        </View>
        <View style={styles.right}>
          {!isRestricted ? (
            <Pressable
              onPress={() => navigateTo("Alerts")}
              style={styles.iconButton}
            >
              <Feather name="bell" size={18} color={colors.ink[600]} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigateTo("TeacherProfile")}
            style={styles.userChip}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </Pressable>
          <Pressable onPress={() => void logout()} style={styles.iconButton}>
            <Feather name="log-out" size={18} color={colors.ink[500]} />
          </Pressable>
        </View>
      </View>
      <TeacherMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigateTo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.7)",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink[100],
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.rose[500],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    color: colors.white,
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 11,
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.ink[900],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  roleText: {
    fontSize: 10,
    color: colors.ink[600],
    fontFamily: typography.fontBody,
    fontWeight: "600",
  },
});
