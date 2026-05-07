/**
 * hooks/useMqtt.js
 * Hook React pour la connexion MQTT via WebSocket Secure (HiveMQ Cloud)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

const MQTT_CONFIG = {
  brokerUrl: 'wss://95ad7664c9384cb0936c42c6ea5b8654.s1.eu.hivemq.cloud:8884/mqtt',
  options: {
    clientId: `serre-app-${Math.random().toString(16).slice(2, 8)}`,
    username: 'Ssxpn',
    password: 'isCPEarD7?LaKYq9',
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    keepalive: 60,
  },
};

export function useMqtt(initialTopics = []) {
  const clientRef               = useRef(null);
  const [status, setStatus]     = useState('disconnected');
  const [messages, setMessages] = useState([]);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    setStatus('connecting');

    const client = mqtt.connect(MQTT_CONFIG.brokerUrl, MQTT_CONFIG.options);
    clientRef.current = client;

    client.on('connect', () => {
      setStatus('connected');
      setLastError(null);
      initialTopics.forEach((topic) => client.subscribe(topic));
    });

    client.on('reconnect', () => setStatus('connecting'));
    client.on('offline',   () => setStatus('disconnected'));

    client.on('error', (err) => {
      setStatus('error');
      setLastError(err.message ?? 'Erreur MQTT inconnue');
    });

    client.on('message', (topic, payloadBuffer) => {
      const payload = payloadBuffer.toString();
      setMessages((prev) => [
        { topic, payload, ts: new Date() },
        ...prev.slice(0, 99),
      ]);
    });

    return () => client.end(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish     = useCallback((topic, payload, retain = false) => {
    clientRef.current?.publish(topic, payload, { retain, qos: 1 });
  }, []);

  const subscribe   = useCallback((topic) => clientRef.current?.subscribe(topic),   []);
  const unsubscribe = useCallback((topic) => clientRef.current?.unsubscribe(topic), []);

  return { status, messages, publish, subscribe, unsubscribe, lastError };
}
