/**
 * components/LumiereControl.tsx
 */
import { Switch } from '@/components/Switch';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'manuel' | 'programmateur' | 'solaire';

type LedStatus = {
  mode: Mode;
  ledOn: boolean;
  nextEvent: string;
  nextTime: string;
  timeOn: string;
  timeOff: string;
};

type SunTimes = { sunrise: string; sunset: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function fetchSunTimes(lat: number, lon: number): Promise<SunTimes> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`
  );
  const data = await res.json();
  return {
    sunrise: formatTime(data.daily.sunrise[0]),
    sunset:  formatTime(data.daily.sunset[0]),
  };
}

async function geolocateIP(ip: string): Promise<{ lat: number; lon: number }> {
  const res  = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon`);
  const data = await res.json();
  return { lat: data.lat as number, lon: data.lon as number };
}

// ─── ModeSelector ─────────────────────────────────────────────────────────────

type ModeSelectorProps = {
  confirmed: Mode;
  pending:   Mode;
  onChange:  (m: Mode) => void;
};

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: 'manuel',        label: 'Manuel',       icon: '✋' },
  { key: 'programmateur', label: 'Programmateur', icon: '🕐' },
  { key: 'solaire',       label: 'Solaire',       icon: '☀️' },
];

function ModeSelector({ confirmed, pending, onChange }: ModeSelectorProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.modeRow}>
      {MODES.map((m) => {
        const isConfirmed = confirmed === m.key;
        const isPending   = pending === m.key && pending !== confirmed;
        return (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.modeBtn,
              { backgroundColor: theme.background },
              isConfirmed && [styles.modeBtnConfirmed, { backgroundColor: theme.surfaceActive, borderColor: theme.accentBorder }],
              isPending   && [styles.modeBtnPending,   { backgroundColor: theme.pendingBg,     borderColor: theme.pendingBorder }],
            ]}
            onPress={() => onChange(m.key)}
          >
            <Text style={styles.modeBtnIcon}>{m.icon}</Text>
            <Text style={[
              styles.modeBtnLabel,
              { color: theme.textSecondary },
              isConfirmed && { color: theme.textPrimary },
              isPending   && { color: theme.pendingText },
            ]}>
              {m.label}
            </Text>
            {isConfirmed && <Text style={styles.confirmedDot}>●</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── TimeEditor ───────────────────────────────────────────────────────────────

type TimeEditorProps = {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
};

function TimeEditor({ label, value, onChange }: TimeEditorProps) {
  const { theme } = useTheme();

  function bump(field: 'hour' | 'minute', delta: number) {
    const [h, m] = value.split(':').map(Number);
    if (field === 'hour') {
      onChange(`${String((h + delta + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    } else {
      onChange(`${String(h).padStart(2, '0')}:${String((m + delta + 60) % 60).padStart(2, '0')}`);
    }
  }

  const [hh, mm] = value.split(':');

  return (
    <View style={styles.scheduleField}>
      <Text style={[styles.scheduleFieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.timeEditor}>
        {/* Heures */}
        <View style={styles.timeUnit}>
          <TouchableOpacity style={[styles.timeBtn, { backgroundColor: theme.background }]} onPress={() => bump('hour', 1)}>
            <Text style={[styles.timeBtnText, { color: theme.textSecondary }]}>▲</Text>
          </TouchableOpacity>
          <Text style={[styles.scheduleFieldValue, { color: theme.textPrimary }]}>{hh}</Text>
          <TouchableOpacity style={[styles.timeBtn, { backgroundColor: theme.background }]} onPress={() => bump('hour', -1)}>
            <Text style={[styles.timeBtnText, { color: theme.textSecondary }]}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.timeSep, { color: theme.textPrimary }]}>:</Text>

        {/* Minutes */}
        <View style={styles.timeUnit}>
          <TouchableOpacity style={[styles.timeBtn, { backgroundColor: theme.background }]} onPress={() => bump('minute', 1)}>
            <Text style={[styles.timeBtnText, { color: theme.textSecondary }]}>▲</Text>
          </TouchableOpacity>
          <Text style={[styles.scheduleFieldValue, { color: theme.textPrimary }]}>{mm}</Text>
          <TouchableOpacity style={[styles.timeBtn, { backgroundColor: theme.background }]} onPress={() => bump('minute', -1)}>
            <Text style={[styles.timeBtnText, { color: theme.textSecondary }]}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── SaveButton ───────────────────────────────────────────────────────────────

function SaveButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.saveBtn,
        disabled && { backgroundColor: theme.disabledBg },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.saveBtnText, disabled && { color: theme.disabledText }]}>
        ✓ Enregistrer
      </Text>
    </TouchableOpacity>
  );
}

// ─── LumiereControl ───────────────────────────────────────────────────────────

export function LumiereControl() {
  const { messages, publish } = useMqtt();
  const { theme, isDark }     = useTheme();

  const [confirmedMode, setConfirmedMode] = useState<Mode>('manuel');
  const [pendingMode,   setPendingMode]   = useState<Mode>('manuel');

  const [scheduleOn,           setScheduleOn]           = useState('08:00');
  const [scheduleOff,          setScheduleOff]          = useState('20:00');
  const [confirmedScheduleOn,  setConfirmedScheduleOn]  = useState('08:00');
  const [confirmedScheduleOff, setConfirmedScheduleOff] = useState('20:00');

  const [sunTimes,   setSunTimes]   = useState<SunTimes | null>(null);
  const [loadingSun, setLoadingSun] = useState(false);

  const isEditingRef = useRef(false);
  const lastIpRef    = useRef<string | null>(null);

  // ── Sync depuis l'Arduino ─────────────────────────────────────────────────

  useEffect(() => {
    const latest = messages.find((m) => m.topic === TOPICS.LED_STATUS);
    if (!latest) return;
    try {
      const s: LedStatus = JSON.parse(latest.payload);
      setConfirmedMode(s.mode);
      if (!isEditingRef.current) {
        setPendingMode(s.mode);
        if (s.timeOn)  setScheduleOn(s.timeOn);
        if (s.timeOff) setScheduleOff(s.timeOff);
      }
    } catch {}
  }, [messages]);

  // ── Heures solaires ───────────────────────────────────────────────────────
  // Stocker l'IP dès qu'elle arrive, indépendamment du mode
  useEffect(() => {
    const latest = messages.find((m) => m.topic === TOPICS.LOCALISATION);
    if (!latest) return;
    let parsed: { ip?: string };
    try { parsed = JSON.parse(latest.payload); } catch { return; }
    if (!parsed.ip) return;
    if (parsed.ip === lastIpRef.current) return;
    lastIpRef.current = parsed.ip; // toujours stocker l'IP
    setSunTimes(null);             // forcer le rechargement des heures solaires
  }, [messages]);

  // Charger les heures solaires dès que le mode ET l'IP sont disponibles
  useEffect(() => {
    if (pendingMode !== 'solaire') return;
    if (!lastIpRef.current) return;
    if (sunTimes) return; // déjà chargées
    loadSunTimes(lastIpRef.current);
  }, [pendingMode, sunTimes]);

  async function loadSunTimes(ip: string) {
    setLoadingSun(true);
    try {
      const { lat, lon } = await geolocateIP(ip);
      setSunTimes(await fetchSunTimes(lat, lon));
    } catch {
      console.warn('Impossible de récupérer les heures solaires');
    } finally {
      setLoadingSun(false);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleModeSelect(newMode: Mode) {
    if (newMode === pendingMode) return;
    isEditingRef.current = true;
    setPendingMode(newMode);
    if (newMode === 'solaire' && lastIpRef.current) loadSunTimes(lastIpRef.current);
  }

  function handleSave() {
    publish(TOPICS.LED_MODE, pendingMode, true);
    if (pendingMode === 'programmateur') {
      publish(TOPICS.LED_SCHEDULE, JSON.stringify({ on: scheduleOn, off: scheduleOff }), true);
      setConfirmedScheduleOn(scheduleOn);
      setConfirmedScheduleOff(scheduleOff);
    }
    if (pendingMode === 'solaire' && sunTimes) {
      publish(TOPICS.LED_SCHEDULE, JSON.stringify({ on: sunTimes.sunrise, off: sunTimes.sunset }), true);
    }
    setConfirmedMode(pendingMode);
    isEditingRef.current = false;
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const ledOn = messages.find((m) => m.topic === TOPICS.LED_STATE)?.payload === 'ON';

  const modeChanged     = pendingMode !== confirmedMode;
  const scheduleChanged =
    pendingMode === 'programmateur' &&
    (scheduleOn !== confirmedScheduleOn || scheduleOff !== confirmedScheduleOff);
  const canSave = (modeChanged || scheduleChanged) && (pendingMode !== 'solaire' || !!sunTimes);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>

      {/* En-tête */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💡</Text>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Lumière</Text>
        <View style={[styles.stateBadge, {
          backgroundColor: ledOn ? theme.surfaceActive : (isDark ? '#0f172a' : '#f1f5f9'),
          borderWidth: ledOn ? 1 : 0,
          borderColor: theme.accentBorder,
        }]}>
          <Text style={[styles.stateBadgeText, { color: ledOn ? theme.accentDark : theme.textMuted }]}>
            {ledOn ? 'Allumée' : 'Éteinte'}
          </Text>
        </View>
      </View>

      {/* Sélecteur de mode */}
      <ModeSelector confirmed={confirmedMode} pending={pendingMode} onChange={handleModeSelect} />

      {/* ── Panneau Manuel ── */}
      {pendingMode === 'manuel' && (
        <View style={styles.panel}>
          {confirmedMode !== 'manuel' ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              publish(TOPICS.LED_MODE, 'manuel', true);
              setConfirmedMode('manuel');
              isEditingRef.current = false;
            }}>
              <Text style={styles.actionBtnText}>↩ Passer en manuel</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.manualRow}>
              <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>Contrôle direct</Text>
              <Switch
                value={ledOn}
                onValueChange={(v) => publish(TOPICS.LED_CMD, v ? 'ON' : 'OFF')}
              />
            </View>
          )}
        </View>
      )}

      {/* ── Panneau Programmateur ── */}
      {pendingMode === 'programmateur' && (
        <View style={styles.panel}>
          <View style={styles.scheduleRow}>
            <TimeEditor label="🌅 Allumage"  value={scheduleOn}  onChange={(v) => { isEditingRef.current = true; setScheduleOn(v);  }} />
            <Text style={[styles.scheduleSep, { color: theme.textMuted }]}>→</Text>
            <TimeEditor label="🌙 Extinction" value={scheduleOff} onChange={(v) => { isEditingRef.current = true; setScheduleOff(v); }} />
          </View>
          <SaveButton onPress={handleSave} disabled={!canSave} />
        </View>
      )}

      {/* ── Panneau Solaire ── */}
      {pendingMode === 'solaire' && (
        <View style={styles.panel}>
          {loadingSun ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 8 }} />
          ) : sunTimes ? (
            <View style={styles.sunRow}>
              <View style={styles.sunField}>
                <Text style={styles.sunIcon}>🌅</Text>
                <Text style={[styles.sunLabel, { color: theme.textSecondary }]}>Lever</Text>
                <Text style={[styles.sunValue, { color: theme.textPrimary }]}>{sunTimes.sunrise}</Text>
              </View>
              <View style={[styles.sunDivider, { backgroundColor: theme.sidebarDivider }]} />
              <View style={styles.sunField}>
                <Text style={styles.sunIcon}>🌇</Text>
                <Text style={[styles.sunLabel, { color: theme.textSecondary }]}>Coucher</Text>
                <Text style={[styles.sunValue, { color: theme.textPrimary }]}>{sunTimes.sunset}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>
              En attente de la position de la serre…
            </Text>
          )}
          <Text style={[styles.solarNote, { color: theme.textMuted }]}>
            Horaires calculés selon la position de la serre. Mis à jour au démarrage de l'app.
          </Text>
          <SaveButton onPress={handleSave} disabled={!canSave} />
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card:           { borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },

  modeRow:            { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeBtn:            { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, gap: 2 },
  modeBtnPending:     { backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fbbf24' },
  modeBtnConfirmed:   { borderWidth: 1 },
  modeBtnIcon:        { fontSize: 16 },
  modeBtnLabel:       { fontSize: 11, fontWeight: '500' },
  confirmedDot:       { fontSize: 8, color: '#22c55e', marginTop: 2 },

  panel:      { gap: 12 },
  manualRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel: { fontSize: 13 },

  scheduleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  scheduleField:      { alignItems: 'center', gap: 4 },
  scheduleFieldLabel: { fontSize: 12, marginBottom: 4 },
  scheduleFieldValue: { fontSize: 26, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  timeEditor:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timeUnit:           { alignItems: 'center', gap: 4 },
  timeSep:            { fontSize: 24, fontWeight: '700', marginBottom: 2, paddingHorizontal: 2 },
  timeBtn:            { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  timeBtnText:        { fontSize: 12 },
  scheduleSep:        { fontSize: 18 },

  actionBtn:      { backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  actionBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
  saveBtn:        { backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled:{ backgroundColor: '#cbd5e1' },
  saveBtnText:    { color: '#fff', fontWeight: '600', fontSize: 14 },

  sunRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sunField:   { alignItems: 'center', gap: 4 },
  sunIcon:    { fontSize: 24 },
  sunLabel:   { fontSize: 12 },
  sunValue:   { fontSize: 22, fontWeight: '700' },
  sunDivider: { width: 1, height: 50 },
  solarNote:  { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});