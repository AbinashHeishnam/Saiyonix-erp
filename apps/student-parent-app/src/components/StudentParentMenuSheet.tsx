import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigationState } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@saiyonix/auth";
import { colors, typography } from "@saiyonix/ui";
import useSchoolBranding from "../hooks/useSchoolBranding";
import { PARENT_WEB_MENU_GROUPS, STUDENT_WEB_MENU_GROUPS, type StudentParentRoute, type WebParityMenuGroup } from "../config/webParity";

const GROUP_ICONS: Record<WebParityMenuGroup["title"], keyof typeof Feather.glyphMap> = {
  CORE: "grid",
  ACADEMIC: "book-open",
  "ADMIN CONTROL": "shield",
  FINANCE: "dollar-sign",
  SYSTEM: "settings",
};

function findActiveRoute(state: any): string | null {
  if (!state?.routes?.length) return null;
  const route = state.routes[state.index ?? 0];
  if (route?.state) return findActiveRoute(route.state);
  if (route?.params?.screen) return String(route.params.screen);
  return route?.name ? String(route.name) : null;
}

export default function StudentParentMenuSheet({
  visible,
  onClose,
  onNavigate,
  unreadCount = 0,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: StudentParentRoute) => void;
  unreadCount?: number;
}) {
  const AnimatedPressable = useMemo(() => Animated.createAnimatedComponent(Pressable), []);
  const slide = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const navState = useNavigationState((state) => state);
  const activeRoute = findActiveRoute(navState);
  const { schoolName, logoUrl } = useSchoolBranding();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = role === "PARENT" ? PARENT_WEB_MENU_GROUPS : STUDENT_WEB_MENU_GROUPS;
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, search]);

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
    opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    transform: [
      {
        translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }),
      },
    ],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <AnimatedPressable
          onPress={() => {}}
          style={[
            styles.sheet,
            sheetStyle,
            { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 14 },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoWrap}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.logoText}>{schoolName.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandTitle}>{schoolName}</Text>
                <Text style={styles.brandSub}>School Platform</Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={18} color={colors.ink[400]} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Feather name="search" size={14} color={colors.ink[400]} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search menu..."
              placeholderTextColor={colors.ink[400]}
              style={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {filteredGroups.map((group) => (
              <View key={group.title} style={styles.group}>
                <Pressable
                  style={styles.groupHeader}
                  onPress={() => setCollapsed((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                >
                  <Feather name={GROUP_ICONS[group.title]} size={14} color={colors.ink[300]} />
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Feather
                    name={collapsed[group.title] ? "chevron-right" : "chevron-down"}
                    size={14}
                    color={colors.ink[300]}
                    style={styles.groupChevron}
                  />
                </Pressable>

                {!collapsed[group.title] ? (
                  <View style={styles.groupItems}>
                    {group.items.map((item) => {
                      const isActive = activeRoute === item.route;
                      return (
                        <Pressable
                          key={item.key}
                          style={[styles.item, isActive && styles.itemActive]}
                          onPress={() => {
                            onNavigate(item.route);
                            onClose();
                          }}
                        >
                          {isActive ? <View style={styles.itemIndicator} /> : null}
                          <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{item.label}</Text>
                          {item.badge === "notifications" && unreadCount > 0 ? (
                            <View style={styles.itemBadge}>
                              <Text style={styles.itemBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>{schoolName}</Text>
            <Text style={styles.footerSub}>v1.0 • Pro</Text>
          </View>
        </AnimatedPressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheet: {
    width: "80%",
    maxWidth: 300,
    height: "100%",
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.85)",
    backgroundColor: colors.white,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink[500],
    fontFamily: typography.fontDisplay,
  },
  brandText: {
    flex: 1,
    gap: 2,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  brandSub: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink[400],
    textTransform: "uppercase",
    fontFamily: typography.fontBody,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.85)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  content: {
    gap: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  searchWrap: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    backgroundColor: colors.ink[50],
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 12,
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  group: {
    gap: 10,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  groupChevron: {
    marginLeft: "auto",
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.ink[400],
    letterSpacing: 1.8,
    fontFamily: typography.fontBody,
  },
  groupItems: {
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(226,232,240,0.7)",
    paddingLeft: 10,
    gap: 4,
  },
  item: {
    minHeight: 40,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: colors.sky[50],
  },
  itemIndicator: {
    position: "absolute",
    left: 0,
    width: 4,
    height: 18,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: colors.sky[500],
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink[600],
    fontFamily: typography.fontBody,
  },
  itemLabelActive: {
    color: colors.sky[700],
  },
  itemBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: colors.rose[500],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  itemBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: typography.fontBody,
  },
  footerCard: {
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.7)",
    paddingTop: 14,
    paddingBottom: 6,
  },
  footerTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink[700],
    fontFamily: typography.fontBody,
  },
  footerSub: {
    marginTop: 2,
    fontSize: 10,
    color: colors.ink[400],
    fontFamily: typography.fontBody,
  },
});
