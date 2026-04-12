import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getNotificationsUnreadCount } from "@saiyonix/api";
import { useAuth } from "@saiyonix/auth";
import { colors, typography } from "@saiyonix/ui";
import StudentParentMenuSheet from "./StudentParentMenuSheet";
import { TAB_ROUTES } from "../config/webParity";

export default function StudentParentTopbar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isRestricted = Boolean(user?.restricted);
  const { data: unreadData } = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: getNotificationsUnreadCount,
    enabled: Boolean(user) && !isRestricted,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, err: any) => {
      if (err?.response?.status === 429) return false;
      return count < 1;
    },
  });

  const unreadCount =
    typeof unreadData === "number"
      ? unreadData
      : typeof (unreadData as any)?.count === "number"
        ? (unreadData as any).count
        : 0;

  const initials = useMemo(() => {
    const source = user?.email?.split("@")[0]?.trim();
    return (source?.[0] ?? "U").toUpperCase();
  }, [user?.email]);

  const navigateTo = (route: string) => {
    if (TAB_ROUTES.has(route as any)) {
      (navigation as any).navigate("Tabs", { screen: route });
      return;
    }
    (navigation as any).navigate(route);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.iconButton}>
            <Feather name="menu" size={18} color={colors.ink[500]} />
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.center}>
          <Text style={styles.erpLabel}>ERP</Text>
        </View>

        <View style={styles.right}>
          {!isRestricted ? (
            <Pressable onPress={() => navigateTo("Alerts")} style={styles.iconButton}>
              <Feather name="bell" size={17} color={colors.ink[500]} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.userChip}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Pressable onPress={() => void logout()} style={styles.logoutButton}>
              <Feather name="log-out" size={14} color={colors.ink[400]} />
            </Pressable>
          </View>
        </View>
      </View>

      <StudentParentMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigateTo}
        unreadCount={unreadCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.85)",
    paddingHorizontal: 12,
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
    width: 48,
  },
  center: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    bottom: 0,
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
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  erpLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    letterSpacing: -0.4,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.rose[500],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: colors.white,
    paddingLeft: 2,
    paddingRight: 4,
    paddingVertical: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.ink[900],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  logoutButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
