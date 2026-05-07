/**
 * components/EtatActuel.tsx
 */
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type LedStatus = {
  mode: 'manuel' | 'programmateur' | 'solaire';
  ledOn: boolean;
  nextEvent: 'allumage' | 'extinction' | 'manuel';
  nextTime: string;
};

function getLastPayload(messages: any[], topic: string): string | null {
  return messages.find((m) => m.topic === topic)?.payload ?? null;
}

function parseLedStatus(raw: string | null): LedStatus | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function formatNextTime(raw: string): string {
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  try {
    return new Date(raw).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return raw; }
}

const MODE_LABELS: Record<string, string> = {
  manuel:        '✋ Manuel',
  programmateur: '🕐 Programmateur',
  solaire:       '☀️ Solaire',
};

/* ─── Card générique ─── */
function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {children}
    </View>
  );
}

/* ─── Card Lumière ─── */
function LumiereCard({ status, messages }: { status: LedStatus | null; messages: any[] }) {
  const { theme } = useTheme();
  const ledOn = messages.find((m) => m.topic === TOPICS.LED_STATE)?.payload === 'ON';
  const hasNextEvent =
    status && status.mode !== 'manuel' && status.nextTime !== '' && status.nextEvent !== 'manuel';

  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💡</Text>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Lumière</Text>
      </View>
      <Text style={[styles.cardValue, { color: ledOn ? '#22c55e' : theme.textMuted }]}>
        {ledOn ? 'Allumée' : 'Éteinte'}
      </Text>
      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
        {status ? (MODE_LABELS[status.mode] ?? status.mode) : '—'}
      </Text>
      {hasNextEvent && (
        <View style={[styles.nextEventRow, { backgroundColor: theme.pendingBg }]}>
          <Text style={[styles.nextEventLabel, { color: theme.pendingText }]}>
            {status!.nextEvent === 'extinction' ? '🌙 Extinction' : '🌅 Allumage'}
          </Text>
          <Text style={[styles.nextEventTime, { color: theme.pendingText }]}>{formatNextTime(status!.nextTime)}</Text>
        </View>
      )}
    </Card>
  );
}

/* ─── Card Humidité ─── */
function HumiditeCard({ value }: { value: string | null }) {
  const { theme } = useTheme();
  const pct = value ? parseFloat(value) : null;
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💧</Text>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Humidité</Text>
      </View>
      <Text style={[styles.cardValue, { color: '#3b82f6' }]}>
        {pct !== null ? `${pct.toFixed(1)} %` : '—'}
      </Text>
      {pct !== null && (
        <View style={[styles.progressBar, { backgroundColor: theme.background }]}>
          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: '#3b82f6' }]} />
        </View>
      )}
    </Card>
  );
}

/* ─── Card Température ─── */
function TemperatureCard({ value }: { value: string | null }) {
  const { theme } = useTheme();
  const temp = value ? parseFloat(value) : null;
  const color =
    temp === null ? theme.textMuted :
    temp < 15     ? '#3b82f6' :
    temp < 25     ? '#22c55e' :
    temp < 30     ? '#f59e0b' : '#ef4444';
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>🌡️</Text>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Température</Text>
      </View>
      <Text style={[styles.cardValue, { color }]}>
        {temp !== null ? `${temp.toFixed(1)} °C` : '—'}
      </Text>
    </Card>
  );
}

/* ─── Card Ventilation ─── */
// Lit serre/fan/pwm (0-255 publié par l'Arduino)
// pwm === 0 → éteinte  |  pwm > 0 → en marche, pct = round(pwm/255*100)
function VentilationCard({ pwmRaw }: { pwmRaw: string | null }) {
  const { theme } = useTheme();

  const pwm  = pwmRaw !== null ? parseInt(pwmRaw, 10) : null;
  const isOn = pwm !== null && !isNaN(pwm) && pwm > 0;
  const pct  = isOn ? Math.round((pwm! / 255) * 100) : 0;

  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>🌀</Text>
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Ventilation</Text>
      </View>

      <Text style={[styles.cardValue, { color: isOn ? '#0284c7' : theme.textMuted }]}>
        {pwmRaw === null ? '—' : isOn ? 'En marche' : 'Arrêtée'}
      </Text>

      {isOn && (
        <>
          <View style={[styles.progressBar, { backgroundColor: theme.background }]}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#38bdf8' }]} />
          </View>
          <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
            Puissance : {pct} %
          </Text>
        </>
      )}

      {pwmRaw === null && (
        <Text style={[styles.cardMeta, { color: theme.textMuted }]}>En attente…</Text>
      )}
    </Card>
  );
}

/* ─── Composant principal ─── */
export function EtatActuel() {
  const { messages } = useMqtt();
  const { theme }    = useTheme();

  const ledStatus   = parseLedStatus(getLastPayload(messages, TOPICS.LED_STATUS));
  const temperature = getLastPayload(messages, TOPICS.TEMPERATURE);
  const humidite    = getLastPayload(messages, TOPICS.HUMIDITE);
  const fanPwm      = getLastPayload(messages, TOPICS.FAN_PWM);

  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>État actuel</Text>
        <Text style={[styles.updateTime, { color: theme.textMuted }]}>Mis à jour : {now}</Text>
      </View>
      <View style={styles.grid}>
        <LumiereCard     status={ledStatus} messages={messages} />
        <HumiditeCard    value={humidite} />
        <TemperatureCard value={temperature} />
        <VentilationCard pwmRaw={fanPwm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { marginBottom: 24 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:   { fontSize: 18, fontWeight: '700' },
  updateTime:     { fontSize: 11 },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:           { borderRadius: 14, padding: 14, width: '47.5%', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardIcon:       { fontSize: 16 },
  cardTitle:      { fontSize: 13, fontWeight: '500' },
  cardValue:      { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardMeta:       { fontSize: 11, marginTop: 2 },
  nextEventRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  nextEventLabel: { fontSize: 11, fontWeight: '500' },
  nextEventTime:  { fontSize: 11, fontWeight: '700' },
  progressBar:    { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 2 },
});