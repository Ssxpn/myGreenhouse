/**
 * components/VentilationControl.tsx
 */

import { Slider } from '@/components/Slider';
import { Switch } from '@/components/Switch';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function VentilationControl({
  scrollRef,
}: {
  scrollRef: React.RefObject<ScrollView>;
}) {
  const { messages, publish } = useMqtt();
  const [isOn,  setIsOn]     = useState(false);
  const [speed, setSpeed]    = useState(50);

  useEffect(() => {
    const pwmMsg = messages.find((m) => m.topic === TOPICS.FAN_PWM);
    if (!pwmMsg) return;
    const pwm = parseInt(pwmMsg.payload, 10);
    if (isNaN(pwm)) return;
    setIsOn(pwm > 0);
    if (pwm > 0) setSpeed(Math.round((pwm / 255) * 100));
  }, [messages]);

  function handleToggle(v: boolean) {
    setIsOn(v);
    publish(TOPICS.FAN_STATE, v ? 'ON' : 'OFF');
    if (v) publish(TOPICS.FAN_SPEED, String(speed));
  }

  // Le Slider nous dit qu'il a été relâché → on publie
  function handleRelease(finalValue: number) {
    setSpeed(finalValue);
    if (isOn) publish(TOPICS.FAN_SPEED, String(finalValue));
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>🌀</Text>
        <Text style={styles.cardTitle}>Ventilation</Text>
        <View style={[styles.stateBadge, { backgroundColor: isOn ? '#e0f2fe' : '#f1f5f9' }]}>
          <Text style={[styles.stateBadgeText, { color: isOn ? '#0284c7' : '#94a3b8' }]}>
            {isOn ? 'En marche' : 'Arrêtée'}
          </Text>
        </View>
        <Switch value={isOn} onValueChange={handleToggle} />
      </View>

      <View style={styles.divider} />

      <View style={styles.powerSection}>
        <Text style={styles.powerLabel}>⚡ Puissance</Text>

        <Slider
          initialValue={speed}
          onValueChange={setSpeed}
          onRelease={handleRelease}
          disabled={!isOn}
          scrollRef={scrollRef}
        />

        {!isOn && (
          <Text style={styles.powerNote}>Activez la ventilation pour régler</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon:       { fontSize: 18 },
  cardTitle:      { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
  stateBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },
  divider:        { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  powerSection:   { gap: 10 },
  powerLabel:     { fontSize: 13, fontWeight: '600', color: '#475569' },
  powerNote:      { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
});