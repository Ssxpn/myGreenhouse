/**
 * components/MqttStatusBadge.jsx
 * Affiche l'état MQTT (connexion broker) ET l'état Arduino (online/offline).
 */
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import { StyleSheet, Text, View } from 'react-native';

const MQTT_CONFIG = {
  connected:    { color: '#22c55e', label: 'Broker connecté' },
  connecting:   { color: '#f59e0b', label: 'Connexion...' },
  disconnected: { color: '#94a3b8', label: 'Déconnecté' },
  error:        { color: '#ef4444', label: 'Erreur' },
};

const ARDUINO_CONFIG = {
  online:  { color: '#22c55e', label: 'Connecté' },
  offline: { color: '#ef4444', label: 'Déconnecté' },
  unknown: { color: '#94a3b8', label: 'Inconnu' },
};

export function MqttStatusBadge() {
  const { theme }                    = useTheme();
  const { status, arduinoStatus }    = useMqtt();
  const mqttCfg    = MQTT_CONFIG[status]         ?? MQTT_CONFIG.disconnected;
  const arduinoCfg = ARDUINO_CONFIG[arduinoStatus] ?? ARDUINO_CONFIG.unknown;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Broker MQTT */}
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: mqttCfg.color }]} />
        <Text style={[styles.label, { color: mqttCfg.color }]}>{mqttCfg.label}</Text>
      </View>
      {/* Arduino */}
      <View style={[styles.separator, { backgroundColor: theme.sidebarDivider }]} />
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: arduinoCfg.color }]} />
        <Text style={[styles.label, { color: arduinoCfg.color }]}>{arduinoCfg.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  label:      { fontSize: 12, fontWeight: '500' },
  separator:  { width: 1, height: 14, marginHorizontal: 2 },
});