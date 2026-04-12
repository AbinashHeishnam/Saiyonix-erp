import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "@saiyonix/ui";
import useSchoolBranding from "../hooks/useSchoolBranding";

type MenuItem = {
  label: string;
  route: string;
  icon: keyof typeof Feather.glyphMap;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "CORE",
    items: [
      { label: "Dashboard", route: "Dashboard", icon: "grid" },
      { label: "Classroom", route: "Classroom", icon: "book-open" },
      { label: "My Profile", route: "TeacherProfile", icon: "user" },
      { label: "Promotions", route: "TeacherPromotion", icon: "trending-up" },
      { label: "My Leaves", route: "TeacherLeave", icon: "calendar" },
      { label: "Teaching History", route: "TeacherHistory", icon: "clock" },
      { label: "ID Card", route: "TeacherIdCard", icon: "credit-card" },
    ],
  },
  {
    title: "ACADEMIC",
    items: [
      { label: "Attendance", route: "Attendance", icon: "check-circle" },
      { label: "Marks", route: "TeacherMarks", icon: "clipboard" },
      { label: "Student Analytics", route: "TeacherAnalytics", icon: "bar-chart-2" },
      { label: "Student Rank", route: "TeacherRank", icon: "award" },
    ],
  },
  {
    title: "ADMIN CONTROL",
    items: [{ label: "Notices", route: "TeacherNotices", icon: "clipboard" }],
  },
  {
    title: "SYSTEM",
    items: [{ label: "Notifications", route: "Alerts", icon: "bell" }],
  },
];

export default function TeacherMenuSheet({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const AnimatedPressable = useMemo(() => Animated.createAnimatedComponent(Pressable), []);
  const slide = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const width = Math.min(320, Dimensions.get("window").width * 0.8);
  const { schoolName, logoUrl } = useSchoolBranding();

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  const sheetStyle = {
    opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
    transform: [
      {
        translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
      },
    ],
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <AnimatedPressable
          style={[styles.sheet, { paddingTop: insets.top + 16, width }, sheetStyle]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.logoStub}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.logoText}>{schoolName.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandTitle}>{schoolName}</Text>
                <Text style={styles.brandSubtitle}>Teacher Workspace</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={18} color={colors.ink[500]} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {MENU_GROUPS.map((group) => (
              <View key={group.title} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Feather
                    name={
                      group.title === "ACADEMIC"
                        ? "book-open"
                        : group.title === "ADMIN CONTROL"
                          ? "shield"
                          : group.title === "SYSTEM"
                            ? "settings"
                            : "grid"
                    }
                    size={14}
                    color={colors.ink[300]}
                  />
                  <Text style={styles.groupTitle}>{group.title}</Text>
                </View>
                <View style={styles.groupItems}>
                  {group.items.map((item) => (
                    <Pressable
                      key={item.route}
                      style={styles.item}
                      onPress={() => {
                        onNavigate(item.route);
                        onClose();
                      }}
                    >
                      <View style={styles.iconWrap}>
                        <Feather name={item.icon} size={16} color={colors.ink[600]} />
                      </View>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-start",
  },
  sheet: {
    backgroundColor: colors.white,
    height: "100%",
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    paddingTop: 16,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoStub: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[500],
    fontFamily: typography.fontDisplay,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  brandText: {
    gap: 2,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  brandSubtitle: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ink[100],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  group: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  groupTitle: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
    fontWeight: "700",
  },
  groupItems: {
    marginLeft: 12,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(226,232,240,0.7)",
    gap: 4,
    marginTop: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink[50],
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
});
