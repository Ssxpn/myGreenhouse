/**
 * components/HumidifierControl.tsx
 *
 * Architecture :
 *   - L'Arduino publie serre/mist/mode (retained) à chaque reconnexion → l'app se synchronise.
 *   - L'app publie serre/mist/mode quand l'utilisateur change de mode → l'Arduino suit.
 *   - En mode auto  : l'Arduino gère l'hystérésis, l'app n'envoie que le setpoint.
 *   - En mode manuel: l'Arduino n'intervient pas, l'app envoie MIST_CMD ON/OFF.
 *   - Le Slider n'est monté qu'après la première réception MQTT du setpoint.
 *   - MIST_CMD est ignoré par l'Arduino si mistMode == MIST_AUTO → cohérence garantie.
 */

import { Slider } from '@/components/Slider';
import { Switch } from '@/components/Switch';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function HumidifierControl() {
  const { publish, messages } = useMqtt();
  const { theme, isDark }     = useTheme();

  const [target,   setTarget]   = useState<number>(75);
  const [autoMode, setAutoMode] = useState(true);   // reflète serre/mist/mode
  const [mistOn,   setMistOn]   = useState(false);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [loaded,   setLoaded]   = useState(false);

  const targetRef   = useRef<number>(75);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSliding   = useRef(false);
  const hasLoaded   = useRef(false);

  // ── Lecture MQTT ──────────────────────────────────────────────────────
  useEffect(() => {
    // Humidité mesurée
    const humMsg = messages.find((m) => m.topic === TOPICS.HUMIDITE);
    if (humMsg) {
      const parsed = parseFloat(humMsg.payload);
      if (!isNaN(parsed)) setHumidity(parsed);
    }

    // État brumisateur
    const mistMsg = messages.find((m) => m.topic === TOPICS.MIST_STATE);
    if (mistMsg) setMistOn(mistMsg.payload.trim() === 'ON');

    // Mode brumisateur (retained par l'Arduino) — source de vérité
    const modeMsg = messages.find((m) => m.topic === TOPICS.MIST_MODE);
    if (modeMsg) {
      setAutoMode(modeMsg.payload.trim() === 'auto');
    }

    // Setpoint (retained par l'Arduino)
    const setpointMsg = messages.find((m) => m.topic === TOPICS.MIST_SETPOINT);
    if (setpointMsg) {
      const sp = parseFloat(setpointMsg.payload);
      if (!isNaN(sp) && sp >= 0 && sp <= 100) {
        const rounded = Math.round(sp);
        targetRef.current = rounded;
        if (!isSliding.current) {
          setTarget(rounded);
          if (!hasLoaded.current) {
            hasLoaded.current = true;
            setLoaded(true);
          }
        }
      }
    }
  }, [messages]);

  // ── Slider bougé → debounce 300ms ────────────────────────────────────
  const handleSetpointChange = useCallback(
    (value: number) => {
      isSliding.current = true;
      targetRef.current = value;
      setTarget(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        publish(TOPICS.MIST_SETPOINT, String(value));
      }, 300);
    },
    [publish],
  );

  // ── Slider relâché → publication immédiate ────────────────────────────
  const handleSetpointRelease = useCallback(
    (value: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      targetRef.current = value;
      publish(TOPICS.MIST_SETPOINT, String(value));
      setTimeout(() => { isSliding.current = false; }, 1000);
    },
    [publish],
  );

  // ── Bascule auto / manuel ─────────────────────────────────────────────
  const handleAutoToggle = useCallback(() => {
    const next = !autoMode;
    // On publie d'abord le nouveau mode vers l'Arduino.
    // L'Arduino met à jour mistMode et répondra en retained → notre useEffect
    // mettra autoMode à jour. On le fait aussi localement pour l'UX immédiate.
    publish(TOPICS.MIST_MODE, next ? 'auto' : 'manuel');
    setAutoMode(next);
    // Si on repasse en auto, on renvoie le setpoint pour que l'Arduino
    // réévalue immédiatement l'hystérésis avec la valeur courante.
    if (next) {
      publish(TOPICS.MIST_SETPOINT, String(targetRef.current));
    }
    // Si on passe en manuel on ne touche pas à l'état du brumisateur :
    // l'utilisateur choisit ensuite via le switch dédié.
  }, [autoMode, publish]);

  // ── Commande manuelle ON/OFF ──────────────────────────────────────────
  const handleManualToggle = useCallback(() => {
    publish(TOPICS.MIST_CMD, mistOn ? 'OFF' : 'ON');
  }, [mistOn, publish]);

  // ── Dérivés d'affichage ───────────────────────────────────────────────
  const humidityDisplay = humidity !== null ? `${humidity.toFixed(1)} %` : '— %';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>

      {/* ── En-tête ── */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💧</Text>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Brumisation</Text>
        <View style={[styles.stateBadge, {
          backgroundColor: mistOn ? theme.surfaceActive : (isDark ? '#0f172a' : '#f1f5f9'),
          borderWidth: mistOn ? 1 : 0,
          borderColor: theme.accentBorder,
        }]}>
          <Text style={[styles.stateBadgeText, { color: mistOn ? theme.accentDark : theme.textMuted }]}>
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
        <Text style={[styles.humidityLabel, { color: theme.textSecondary }]}>Humidité actuelle</Text>
        <Text style={[styles.humidityValue, { color: theme.textPrimary }]}>{humidityDisplay}</Text>
      </View>

      {/* ── Mode auto/manuel ── */}
      <View style={styles.panel}>
        <View style={styles.manualRow}>
          <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
            {autoMode ? 'Mode automatique' : 'Mode manuel'}
          </Text>
          <Switch value={autoMode} onValueChange={handleAutoToggle} />
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

            {!loaded ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator size="small" color="#0284c7" />
                <Text style={[styles.loaderText, { color: theme.textMuted }]}>
                  Chargement depuis la serre…
                </Text>
              </View>
            ) : (
              <Slider
                initialValue={target}
                onValueChange={handleSetpointChange}
                onRelease={handleSetpointRelease}
                fillColor="#38bdf8"
                thumbColor="#0284c7"
                trackColor={isDark ? '#1e293b' : '#e2e8f0'}
              />
            )}
          </View>
        )}

        {/* ── Switch brumisateur (mode manuel) ── */}
        {!autoMode && (
          <View style={styles.manualRow}>
            <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
              {mistOn ? 'En marche' : 'Arrêté'}
            </Text>
            <Switch value={mistOn} onValueChange={handleManualToggle} />
          </View>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card:           { borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },
  humidityRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  humidityLabel:  { fontSize: 13 },
  humidityValue:  { fontSize: 16, fontWeight: '700' },
  panel:          { gap: 12 },
  manualRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel:     { fontSize: 13 },
  sliderSection:  { gap: 10 },
  sliderHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetValue:    { fontSize: 20, fontWeight: '700' },
  loaderRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  loaderText:     { fontSize: 12, fontStyle: 'italic' },
});