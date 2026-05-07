/**
 * components/SerreBanner.tsx
 * Bannière hero avec photo + widget météo dynamique.
 *
 * Logique de demande de position :
 * - Dès que MQTT est connecté, on attend LOCALISATION_TIMEOUT_MS
 * - Si serre/localisation n'est pas reçu → on publie sur serre/localisation/request
 * - On retry toutes les LOCALISATION_RETRY_MS tant qu'on n'a pas la position
 */
import { TOPICS } from '@/constants/topics';
import { useMqtt } from '@/contexts/MqttContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground, StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const DESKTOP_BREAKPOINT      = 768;
const LOCALISATION_TIMEOUT_MS = 5_000;  // attente initiale avant première demande
const LOCALISATION_RETRY_MS   = 30_000; // intervalle entre les relances

const ARDUINO_STATUS_CONFIG = {
  online:  { color: '#22c55e', label: 'Connecté' },
  offline: { color: '#ef4444', label: 'Déconnecté' },
  unknown: { color: '#94a3b8', label: 'Inconnu' },
};

type Weather = { temp: number; label: string; icon: string; city: string };

function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0)               return { label: 'Ensoleillé',  icon: '☀️' };
  if (code <= 2)                return { label: 'Peu nuageux', icon: '🌤️' };
  if (code === 3)               return { label: 'Couvert',     icon: '☁️' };
  if (code >= 51 && code <= 67) return { label: 'Pluie',       icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Neige',       icon: '❄️' };
  if (code >= 80 && code <= 82) return { label: 'Averses',     icon: '🌦️' };
  if (code >= 95)               return { label: 'Orage',       icon: '⛈️' };
  return                               { label: 'Nuageux',     icon: '🌥️' };
}

async function geolocateIP(ip: string) {
  const res  = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city&lang=fr`);
  const data = await res.json();
  return { lat: data.lat as number, lon: data.lon as number, city: data.city as string };
}

async function getWeather(lat: number, lon: number) {
  const res  = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  const data = await res.json();
  const { temperature, weathercode } = data.current_weather;
  return { temp: Math.round(temperature), ...describeWeather(weathercode) };
}

function weatherChanged(prev: Weather | null, next: Weather): boolean {
  if (!prev) return true;
  return prev.temp !== next.temp || prev.label !== next.label;
}

export function SerreBanner() {
  const { messages, status, arduinoStatus, publish } = useMqtt();
  const { width }                     = useWindowDimensions();
  const isDesktop                     = width >= DESKTOP_BREAKPOINT;

  const [weather, setWeather]           = useState<Weather | null>(null);
  const [weatherLoading, setWLoading]   = useState(true);

  const lastIpRef             = useRef<string | null>(null);
  const lastWeatherRef        = useRef<Weather | null>(null);
  const hasLocalisationRef    = useRef(false);
  const retryIntervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Demande de position ───────────────────────────────────────────────────

  const requestLocalisation = useCallback(() => {
    if (hasLocalisationRef.current) return; // déjà reçue, inutile
    publish(TOPICS.LOCALISATION_REQUEST, 'request');
  }, [publish]);

  const stopRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  // Dès que MQTT est connecté, on lance le timer initial puis les retries
  useEffect(() => {
    if (status !== 'connected') return;
    if (hasLocalisationRef.current) return;

    // Première demande après LOCALISATION_TIMEOUT_MS
    const initialTimer = setTimeout(() => {
      requestLocalisation();
      // Puis retry toutes les LOCALISATION_RETRY_MS
      retryIntervalRef.current = setInterval(requestLocalisation, LOCALISATION_RETRY_MS);
    }, LOCALISATION_TIMEOUT_MS);

    return () => {
      clearTimeout(initialTimer);
      stopRetry();
    };
  }, [status, requestLocalisation, stopRetry]);

  // ── Réception de la position ──────────────────────────────────────────────

  useEffect(() => {
    const latest = messages.find((m) => m.topic === TOPICS.LOCALISATION);
    if (!latest) return;

    let parsed: { ip?: string };
    try { parsed = JSON.parse(latest.payload); } catch { return; }
    if (!parsed.ip) return;
    if (parsed.ip === lastIpRef.current) return;

    lastIpRef.current          = parsed.ip;
    hasLocalisationRef.current = true;
    stopRetry(); // position reçue → on arrête les relances

    geolocateIP(parsed.ip)
      .then(({ lat, lon, city }) =>
        getWeather(lat, lon).then((w) => {
          const next = { ...w, city };
          if (weatherChanged(lastWeatherRef.current, next)) {
            lastWeatherRef.current = next;
            setWeather(next);
          }
        })
      )
      .catch(() => {
        const fallback = { temp: 0, label: 'Indisponible', icon: '—', city: '?' };
        if (weatherChanged(lastWeatherRef.current, fallback)) {
          lastWeatherRef.current = fallback;
          setWeather(fallback);
        }
      })
      .finally(() => setWLoading(false));
  }, [messages, stopRetry]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const arduinoCfg = ARDUINO_STATUS_CONFIG[arduinoStatus] ?? ARDUINO_STATUS_CONFIG.unknown;

  return (
    <ImageBackground
      source={require('../assets/images/serre.jpg')}
      style={[styles.banner, !isDesktop && styles.bannerMobile]}
      imageStyle={[styles.image, !isDesktop && styles.imageMobile]}
    >
      {isDesktop && <View style={styles.gradient} />}

      {/* Widget météo */}
      <View style={styles.weatherWidget}>
        {weatherLoading || !weather ? (
          <ActivityIndicator size="small" color="#fbbf24" />
        ) : (
          <>
            <Text style={styles.weatherIcon}>{weather.icon}</Text>
            <View>
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              <Text style={styles.weatherLabel}>{weather.label} · {weather.city}</Text>
            </View>
          </>
        )}
      </View>

      {/* Titre + statut — desktop seulement */}
      {isDesktop && (
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Ma Serre 🌿</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: arduinoCfg.color }]} />
              <Text style={[styles.statusLabel, { color: arduinoCfg.color }]}>
                🌱 {arduinoCfg.label}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  banner:         { height: 200, overflow: 'hidden', marginBottom: 24, marginHorizontal: -20, justifyContent: 'space-between' },
  bannerMobile:   { marginHorizontal: 0, borderRadius: 16 },
  image:          { resizeMode: 'cover', width: '100%' },
  imageMobile:    { borderRadius: 16 },
  gradient:       { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.45)' },
  weatherWidget:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: 'rgba(10,20,14,0.65)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', minWidth: 80, minHeight: 44, justifyContent: 'center' },
  weatherIcon:    { fontSize: 20 },
  weatherTemp:    { color: '#fbbf24', fontSize: 18, fontWeight: '600', lineHeight: 22 },
  weatherLabel:   { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  titleContainer: { padding: 14 },
  titleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:          { color: '#e2f5ea', fontSize: 18, fontWeight: '600' },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,20,14,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot:      { width: 7, height: 7, borderRadius: 4 },
  statusLabel:    { fontSize: 12, fontWeight: '600' },
});