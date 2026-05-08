/**
 * components/VentilationControl.tsx
 *
 * Mode auto : le ventilateur s'allume automatiquement quand le brumisateur
 *             est actif (serre/mist/state = "ON") et s'arrête sinon.
 * Mode manuel : contrôle direct ON/OFF + slider de puissance.
 */

import { Slider } from '@/components/Slider';
import { Switch } from '@/components/Switch';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function VentilationControl({
  scrollRef,
}: {
  scrollRef?: React.RefObject<ScrollView>;
}) {
  const { messages, publish } = useMqtt();
  const { theme, isDark }     = useTheme();

  const [isOn,     setIsOn]     = useState(false);
  const [speed,    setSpeed]    = useState(50);
  const [autoMode, setAutoMode] = useState(false); // false = manuel par défaut

  const speedRef = useRef(speed);
  speedRef.current = speed;

  /* ── Lecture MQTT : état ventilateur ── */
  useEffect(() => {
    const pwmMsg = messages.find((m) => m.topic === TOPICS.FAN_PWM);
    if (!pwmMsg) return;
    const pwm = parseInt(pwmMsg.payload, 10);
    if (isNaN(pwm)) return;
    setIsOn(pwm > 0);
    if (pwm > 0) setSpeed(Math.round((pwm / 255) * 100));
  }, [messages]);

  /* ── Mode auto : suit l'état du brumisateur ── */
  useEffect(() => {
    if (!autoMode) return;
    const mistMsg = messages.find((m) => m.topic === TOPICS.MIST_STATE);
    if (!mistMsg) return;
    const mistOn = mistMsg.payload.trim() === 'ON';
    if (mistOn !== isOn) {
      publish(TOPICS.FAN_STATE, mistOn ? 'ON' : 'OFF');
      if (mistOn) publish(TOPICS.FAN_SPEED, String(speedRef.current));
    }
  }, [messages, autoMode, isOn, publish]);

  /* ── Basculement mode auto/manuel ── */
  const handleAutoToggle = useCallback(() => {
    const next = !autoMode;
    setAutoMode(next);
    if (!next) {
      // Passage en manuel → on coupe le ventilateur par sécurité
      publish(TOPICS.FAN_STATE, 'OFF');
    }
  }, [autoMode, publish]);

  /* ── Toggle ON/OFF manuel ── */
  const handleToggle = useCallback(() => {
    const next = !isOn;
    setIsOn(next);
    publish(TOPICS.FAN_STATE, next ? 'ON' : 'OFF');
    if (next) publish(TOPICS.FAN_SPEED, String(speedRef.current));
  }, [isOn, publish]);

  /* ── Slider relâché ── */
  const handleRelease = useCallback((finalValue: number) => {
    setSpeed(finalValue);
    if (isOn) publish(TOPICS.FAN_SPEED, String(finalValue));
  }, [isOn, publish]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>

      {/* ── En-tête — même format que LumiereControl ── */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>🌀</Text>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Ventilation</Text>
        <View style={[styles.stateBadge, {
          backgroundColor: isOn
            ? theme.surfaceActive
            : (isDark ? '#0f172a' : '#f1f5f9'),
          borderWidth: isOn ? 1 : 0,
          borderColor: theme.accentBorder,
        }]}>
          <Text style={[styles.stateBadgeText, {
            color: isOn ? theme.accentDark : theme.textMuted,
          }]}>
            {isOn ? 'En marche' : 'Arrêtée'}
          </Text>
        </View>
      </View>

      {/* ── Mode auto/manuel ── */}
      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
            {autoMode ? 'Mode automatique' : 'Mode manuel'}
          </Text>
          <Switch value={autoMode} onValueChange={handleAutoToggle} />
        </View>

        {/* ── Note mode auto ── */}
        {autoMode && (
          <Text style={[styles.autoNote, { color: theme.textMuted }]}>
            💧 La ventilation suit l'état du brumisateur
          </Text>
        )}

        {/* ── Contrôle manuel : toggle ON/OFF ── */}
        {!autoMode && (
          <View style={styles.row}>
            <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
              {isOn ? 'En marche' : 'Arrêtée'}
            </Text>
            <Switch value={isOn} onValueChange={handleToggle} />
          </View>
        )}

        {/* ── Slider puissance (toujours visible) ── */}
        <View style={styles.powerSection}>
          <Text style={[styles.powerLabel, { color: theme.textSecondary }]}>
            ⚡ Puissance
          </Text>
          <Slider
            initialValue={speed}
            onValueChange={setSpeed}
            onRelease={handleRelease}
            disabled={!isOn}
            scrollRef={scrollRef}
          />
          {!isOn && (
            <Text style={[styles.powerNote, { color: theme.textMuted }]}>
              {autoMode
                ? 'Le ventilateur s\'allumera avec le brumisateur'
                : 'Activez la ventilation pour régler'}
            </Text>
          )}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:  14,
    padding:       16,
    marginBottom:  10,
    shadowColor:   '#000',
    shadowOpacity: 0.06,
    shadowRadius:  6,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     2,
  },

  // ── En-tête — identique à LumiereControl ──
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── Panneau ──
  panel:        { gap: 12 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel:   { fontSize: 13 },
  autoNote:     { fontSize: 12, fontStyle: 'italic' },

  // ── Slider puissance ──
  powerSection: { gap: 8 },
  powerLabel:   { fontSize: 13, fontWeight: '600' },
  powerNote:    { fontSize: 11, fontStyle: 'italic', textAlign: 'center' },
});