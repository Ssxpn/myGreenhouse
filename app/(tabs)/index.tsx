/**
 * app/(tabs)/index.tsx  →  Onglet "Accueil"
 */
import { EtatActuel } from '@/components/EtatActuel';
import { LumiereControl } from '@/components/LumiereControl';
import { SerreBanner } from '@/components/SerreBanner';
import { VentilationControl } from '@/components/VentilationControl';
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const DESKTOP_BREAKPOINT = 768;
const REFRESH_TIMEOUT_MS = 5000;

export default function HomeScreen() {
  const { lastError, publish, messages, setArduinoStatus } = useMqtt();
  const { theme }  = useTheme();
  const { width }  = useWindowDimensions();
  const isDesktop  = width >= DESKTOP_BREAKPOINT;

  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalisationRef         = useRef<string | null>(null);

  useEffect(() => {
    const latest = messages.find((m) => m.topic === TOPICS.LOCALISATION);
    if (latest) lastLocalisationRef.current = latest.ts.toISOString();
  }, [messages]);

  useEffect(() => {
    if (!refreshing) return;
    const latest = messages.find((m) => m.topic === TOPICS.LOCALISATION);
    if (!latest) return;
    if (latest.ts.getTime() > Date.now() - REFRESH_TIMEOUT_MS) {
      clearTimeout(timeoutRef.current!);
      setRefreshing(false);
    }
  }, [messages, refreshing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    publish(TOPICS.LOCALISATION_REQUEST, 'request');
    timeoutRef.current = setTimeout(() => {
      setArduinoStatus('offline');
      setRefreshing(false);
    }, REFRESH_TIMEOUT_MS);
  }, [publish, setArduinoStatus]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          isDesktop ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          )
        }
      >
        <SerreBanner />

        {lastError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {lastError}</Text>
          </View>
        )}

        <EtatActuel />

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Contrôles</Text>

        <LumiereControl />

        <VentilationControl />

        <View style={[styles.card, { backgroundColor: theme.surface }, styles.cardDisabled]}>
          <View style={styles.row}>
            <Text style={[styles.controlLabel, { color: theme.textPrimary }]}>💧 Brumisation</Text>
            <Text style={[styles.comingSoon, { color: theme.textMuted }]}>Bientôt</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  scroll:       { padding: 20, paddingBottom: 100 },
  errorBanner:  { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:    { color: '#dc2626', fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  card:         { borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardDisabled: { opacity: 0.5 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlLabel: { fontSize: 17, fontWeight: '600' },
  comingSoon:   { fontSize: 12, fontStyle: 'italic' },
});