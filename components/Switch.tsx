/**
 * components/Switch.tsx
 */
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

const TRACK_WIDTH  = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE   = 24;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - 4;

type SwitchProps = {
  value?:          boolean;
  onValueChange?:  (v: boolean) => void;
  isThemeToggle?:  boolean;
};

export function Switch({ value = false, onValueChange, isThemeToggle = false }: SwitchProps) {
  const { isDark, toggleTheme } = useTheme();

  const active = isThemeToggle ? isDark : value;
  const anim   = useRef(new Animated.Value(active ? 1 : 0)).current;

  // Sync propre via useEffect
  useEffect(() => {
    Animated.spring(anim, {
      toValue:         active ? 1 : 0,
      useNativeDriver: true,
      damping:         15,
      stiffness:       200,
    }).start();
  }, [active]);

  const handlePress = () => {
    if (isThemeToggle) {
      toggleTheme();
    } else {
      onValueChange?.(!value);
    }
  };

  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [2, THUMB_TRAVEL + 2],
  });

  const trackColor = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['#cbd5e1', '#22c55e'],
  });

  return (
    <Pressable onPress={handlePress} style={styles.wrapper}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems:     'center',
  },
  track: {
    width:          TRACK_WIDTH,
    height:         TRACK_HEIGHT,
    borderRadius:   TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  thumb: {
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       3,
  },
});