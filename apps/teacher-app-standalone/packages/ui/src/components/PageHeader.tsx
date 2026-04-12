import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.ink[500],
    fontFamily: typography.fontBody,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
