/**
 * components/Slider.tsx
 */
import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

const THUMB_R = 14;
const TRACK_H = 6;

type SliderProps = {
  initialValue?:  number;
  onValueChange?: (v: number) => void;
  onRelease?:     (v: number) => void;
  disabled?:      boolean;
  trackColor?:    string;
  fillColor?:     string;
  thumbColor?:    string;
};

export function Slider({
  initialValue  = 50,
  onValueChange,
  onRelease,
  disabled   = false,
  trackColor = '#e2e8f0',
  fillColor  = '#38bdf8',
  thumbColor = '#0284c7',
}: SliderProps) {
  const [value, setValue] = useState(initialValue);
  const valueRef        = useRef(initialValue);
  const barRef          = useRef<View>(null);
  const barLeft         = useRef(0);
  const barWidth        = useRef(0);

  // ✅ Toutes les props volatiles en ref → toujours à jour dans le PanResponder
  const disabledRef      = useRef(disabled);
  const onValueChangeRef = useRef(onValueChange);
  const onReleaseRef     = useRef(onRelease);
  disabledRef.current      = disabled;
  onValueChangeRef.current = onValueChange;
  onReleaseRef.current     = onRelease;

  const toValue = (pageX: number) => {
    const pct = (pageX - barLeft.current) / barWidth.current * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };

  const applyValue = (pageX: number) => {
    const v = toValue(pageX);
    valueRef.current = v;
    setValue(v);
    onValueChangeRef.current?.(v);
  };

  const handleRelease = () => {
    onReleaseRef.current?.(valueRef.current);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:     () => !disabledRef.current,
      onMoveShouldSetPanResponder:      () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const pageX = evt.nativeEvent.pageX;
        // ✅ Mesure fraîche au touch, puis calcul dans le callback
        barRef.current?.measureInWindow((x, _y, w) => {
          barLeft.current  = x;
          barWidth.current = w;
          applyValue(pageX);
        });
      },

      onPanResponderMove: (evt) => {
        // ✅ Si barWidth est 0 (mesure pas encore reçue), on re-mesure
        if (barWidth.current === 0) {
          const pageX = evt.nativeEvent.pageX;
          barRef.current?.measureInWindow((x, _y, w) => {
            barLeft.current  = x;
            barWidth.current = w;
            applyValue(pageX);
          });
          return;
        }
        applyValue(evt.nativeEvent.pageX);
      },

      onPanResponderRelease:   handleRelease,
      onPanResponderTerminate: handleRelease,
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View
        ref={barRef}
        style={[styles.hitZone, disabled && { opacity: 0.4 }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: trackColor }]} />
        <View style={[styles.fill, { width: `${value}%` as any, backgroundColor: fillColor }]} />
        <View
          style={[styles.thumb, { left: `${value}%` as any, backgroundColor: thumbColor }]}
          pointerEvents="none"
        />
      </View>
      <Text style={styles.label}>{value} %</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:  { gap: 8 },
  hitZone: {
    width:          '100%',
    height:         THUMB_R * 2,
    justifyContent: 'center',
  },
  track: {
    position:     'absolute',
    left:         0,
    right:        0,
    height:       TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  fill: {
    position:     'absolute',
    left:         0,
    height:       TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position:     'absolute',
    width:        THUMB_R * 2,
    height:       THUMB_R * 2,
    borderRadius: THUMB_R,
    marginLeft:   -THUMB_R,
    top:          0,
    shadowColor:    '#000',
    shadowOpacity:  0.2,
    shadowRadius:   4,
    shadowOffset:   { width: 0, height: 2 },
    elevation:      4,
  },
  label: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#0284c7',
    textAlign:  'center',
  },
});