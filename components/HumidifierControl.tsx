/**
 * components/HumidifierControl.tsx
 *
 * Architecture :
 *   - L'Arduino est SEUL responsable de la logique d'hystérésis et du relais.
 *   - L'app publie uniquement la consigne (serre/mist/setpoint).
 *   - L'app affiche l'état réel retourné par l'Arduino (serre/mist/state).
 *
 * Topics MQTT :
 *   Publiés  : serre/mist/setpoint  (consigne humidité, ex: "75")
 *              serre/mist/cmd       (commande manuelle "ON" | "OFF")
 *   Reçus    : serre/capteurs/humidite  (humidité courante, ex: "73.4")
 *              serre/mist/state         (état réel du relais "ON" | "OFF")
 */

import { Slider } from '@/components/Slider';
import { Switch } from '@/components/Switch';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const HYSTERESIS     = 1;
const DEFAULT_TARGET = 75;

export function HumidifierControl() {
  const { publish, messages } = useMqtt();
  const { theme, isDark }     = useTheme();

  const [target,   setTarget]   = useState(DEFAULT_TARGET);
  const [autoMode, setAutoMode] = useState(true);
  const [mistOn,   setMistOn]   = useState(false);
  const [humidity, setHumidity] = useState<number | null>(null);

  const targetRef   = useRef(target);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  targetRef.current = target;

  /* ── Lecture MQTT ── */
  useEffect(() => {
    const humMsg = messages.find((m) => m.topic === TOPICS.HUMIDITE);
    if (humMsg) {
      const parsed = parseFloat(humMsg.payload);
      if (!isNaN(parsed)) setHumidity(parsed);
    }
    const mistMsg = messages.find((m) => m.topic === TOPICS.MIST_STATE);
    if (mistMsg) {
      setMistOn(mistMsg.payload.trim() === 'ON');
    }
  }, [messages]);

  /* ── Slider bougé → debounce 300ms ── */
  const handleSetpointChange = useCallback(
    (value: number) => {
      setTarget(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        publish(TOPICS.MIST_SETPOINT, String(value));
      }, 300);
    },
    [publish],
  );

  /* ── Slider relâché → publication immédiate ── */
  const handleSetpointRelease = useCallback(
    (value: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      publish(TOPICS.MIST_SETPOINT, String(value));
    },
    [publish],
  );

  /* ── Mode auto/manuel ── */
  const handleAutoToggle = useCallback(() => {
    const next = !autoMode;
    setAutoMode(next);
    if (!next) {
      publish(TOPICS.MIST_CMD, 'OFF');
    } else {
      publish(TOPICS.MIST_SETPOINT, String(targetRef.current));
    }
  }, [autoMode, publish]);

  /* ── Commande manuelle ── */
  const handleManualToggle = useCallback(() => {
    publish(TOPICS.MIST_CMD, mistOn ? 'OFF' : 'ON');
  }, [mistOn, publish]);

  /* ── Dérivés d'affichage ── */
  const humidityDisplay = humidity !== null ? `${humidity.toFixed(1)} %` : '— %';
  const thresholdLow    = target - HYSTERESIS;
  const thresholdHigh   = target + HYSTERESIS;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>

      {/* ── En-tête — même format que LumiereControl ── */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💧</Text>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Brumisation</Text>

        {/* Badge actif/inactif — même style que "Allumée/Éteinte" */}
        <View style={[styles.stateBadge, {
          backgroundColor: mistOn
            ? theme.surfaceActive
            : (isDark ? '#0f172a' : '#f1f5f9'),
          borderWidth: mistOn ? 1 : 0,
          borderColor: theme.accentBorder,
        }]}>
          <Text style={[styles.stateBadgeText, {
            color: mistOn ? theme.accentDark : theme.textMuted,
          }]}>
            {mistOn ? 'Actif' : 'Inactif'}
          </Text>
        </View>
      </View>

      {/* ── Humidité actuelle ── */}
      <View style={[styles.humidityRow, {
        backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
        borderRadius: 10,
        padding: 10,
      }]}>
        <Text style={[styles.humidityLabel, { color: theme.textSecondary }]}>
          Humidité actuelle
        </Text>
        <Text style={[styles.humidityValue, { color: theme.textPrimary }]}>
          {humidityDisplay}
        </Text>
      </View>

      {/* ── Mode auto/manuel ── */}
      <View style={styles.panel}>
        <View style={styles.manualRow}>
          <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
            {autoMode ? 'Mode automatique' : 'Mode manuel'}
          </Text>
          <Switch
            value={autoMode}
            onValueChange={handleAutoToggle}
          />
        </View>

        {/* ── Slider consigne (mode auto) ── */}
        {autoMode && (
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
                Consigne d'humidité
              </Text>
              <Text style={[styles.targetValue, { color: theme.accentDark ?? '#0284c7' }]}>
                {target} %
              </Text>
            </View>

            <Slider
              initialValue={target}
              onValueChange={handleSetpointChange}
              onRelease={handleSetpointRelease}
              fillColor="#38bdf8"
              thumbColor="#0284c7"
              trackColor={isDark ? '#1e293b' : '#e2e8f0'}
            />

            {/* Légende hystérésis */}
            <View style={styles.hysteresisRow}>
              <View style={[styles.hysteresisChip, {
                backgroundColor: isDark ? '#0c2235' : '#f0f9ff',
              }]}>
                <Text style={[styles.hysteresisText, { color: '#0284c7' }]}>
                  🟢 ON {'<'} {thresholdLow} %
                </Text>
              </View>
              <View style={[styles.hysteresisChip, {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              }]}>
                <Text style={[styles.hysteresisText, { color: theme.textMuted }]}>
                  {thresholdLow}–{thresholdHigh} %
                </Text>
              </View>
              <View style={[styles.hysteresisChip, {
                backgroundColor: isDark ? '#0c2235' : '#f0f9ff',
              }]}>
                <Text style={[styles.hysteresisText, { color: '#0284c7' }]}>
                  🔴 OFF {'>'} {thresholdHigh} %
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Switch brumisateur (mode manuel) ── */}
        {!autoMode && (
          <View style={styles.manualRow}>
            <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
              {mistOn ? 'En marche' : 'Arrêté'}
            </Text>
            <Switch
              value={mistOn}
              onValueChange={handleManualToggle}
            />
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

  // ── En-tête — identique à LumiereControl ──
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── Humidité ──
  humidityRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  humidityLabel: { fontSize: 13 },
  humidityValue: { fontSize: 16, fontWeight: '700' },

  // ── Panneau ──
  panel:      { gap: 12 },
  manualRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel: { fontSize: 13 },

  // ── Slider ──
  sliderSection: { gap: 10 },
  sliderHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetValue:   { fontSize: 20, fontWeight: '700' },

  // ── Hystérésis ──
  hysteresisRow: {
    flexDirection:  'row',
    gap:            6,
    justifyContent: 'space-between',
  },
  hysteresisChip: {
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 6,
    flex:              1,
    alignItems:        'center',
  },
  hysteresisText: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
});