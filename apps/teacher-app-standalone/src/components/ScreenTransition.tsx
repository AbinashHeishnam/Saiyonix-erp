import React, { useCallback, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

export default function ScreenTransition({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  const run = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  useFocusEffect(
    useCallback(() => {
      run();
      return () => {};
    }, [run])
  );

  return (
    <Animated.View style={[styles.container, style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
