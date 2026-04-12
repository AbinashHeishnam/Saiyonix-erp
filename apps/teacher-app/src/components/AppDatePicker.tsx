import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Button, colors, typography } from "@saiyonix/ui";

type AppDatePickerProps = {
  visible: boolean;
  title: string;
  value?: string | null;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
};

function resolveDate(value?: string | null) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function AppDatePicker({
  visible,
  title,
  value,
  onConfirm,
  onCancel,
}: AppDatePickerProps) {
  const initialDate = useMemo(() => resolveDate(value), [value]);
  const [draftDate, setDraftDate] = useState(initialDate);

  useEffect(() => {
    if (!visible) return;
    setDraftDate(resolveDate(value));
  }, [value, visible]);

  const handleAndroidChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "set" && selectedDate) {
      onConfirm(selectedDate);
      return;
    }
    onCancel();
  };

  if (!visible) return null;

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={draftDate}
        mode="date"
        display="default"
        onChange={handleAndroidChange}
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <DateTimePicker
            value={draftDate}
            mode="date"
            display="spinner"
            onChange={(_, selectedDate) => {
              if (selectedDate) setDraftDate(selectedDate);
            }}
          />
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} />
            <Button title="OK" onPress={() => onConfirm(draftDate)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: colors.white,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 16,
    color: colors.ink[900],
    fontFamily: typography.fontDisplay,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
