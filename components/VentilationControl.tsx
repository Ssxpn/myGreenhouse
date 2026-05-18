/**
 * components/VentilationControl.tsx
 *
 * Mode auto : le ventilateur s'allume automatiquement quand le brumisateur
 *             est actif (serre/mist/state = "ON") et s'arrête sinon.
 * Mode manuel : contrôle direct ON/OFF uniquement (relais simple).
 *
 * L'appli publie sur serre/fan/cmd   → commande envoyée à l'Arduino
 * L'appli lit    sur serre/fan/state → état réel confirmé par l'Arduino
 */

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
  const [autoMode, setAutoMode] = useState(false);

  const isOnRef = useRef(isOn);
  useEffect(() => { isOnRef.current = isOn; }, [isOn]);

  /* ── Lecture MQTT : état réel confirmé par l'Arduino ── */
  useEffect(() => {
    const fanMsg = messages.find((m) => m.topic === TOPICS.FAN_STATE);
    if (!fanMsg) return;
    setIsOn(fanMsg.payload.trim() === 'ON');
  }, [messages]);

  /* ── Mode auto : suit l'état du brumisateur ── */
  useEffect(() => {
    if (!autoMode) return;
    const mistMsg = messages.find((m) => m.topic === TOPICS.MIST_STATE);
    if (!mistMsg) return;
    const mistOn = mistMsg.payload.trim() === 'ON';
    if (mistOn !== isOnRef.current) {
      publish(TOPICS.FAN_CMD, mistOn ? 'ON' : 'OFF');
    }
  }, [messages, autoMode, publish]);

  /* ── Basculement mode auto/manuel ── */
  const handleAutoToggle = useCallback(() => {
    const next = !autoMode;
    setAutoMode(next);
    if (!next) {
      publish(TOPICS.FAN_CMD, 'OFF');
    }
  }, [autoMode, publish]);

  /* ── Toggle ON/OFF manuel ── */
  const handleToggle = useCallback(() => {
  publish(TOPICS.FAN_CMD, !isOnRef.current ? 'ON' : 'OFF');
}, [publish]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>

      {/* ── En-tête ── */}
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

      {/* ── Panneau ── */}
      <View style={styles.panel}>

        {/* ── Mode auto/manuel ── */}
        <View style={styles.row}>
          <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
            {autoMode ? 'Mode automatique' : 'Mode manuel'}
          </Text>
          <Switch value={autoMode} onValueChange={handleAutoToggle} />
        </View>

        {autoMode && (
          <Text style={[styles.autoNote, { color: theme.textMuted }]}>
            💧 La ventilation suit l'état du brumisateur
          </Text>
        )}

        {!autoMode && (
          <View style={styles.row}>
            <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
              {isOn ? 'En marche' : 'Arrêtée'}
            </Text>
            <Switch value={isOn} onValueChange={handleToggle} />
          </View>
        )}

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
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },
  panel:          { gap: 12 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel:     { fontSize: 13 },
  autoNote:       { fontSize: 12, fontStyle: 'italic' },
});