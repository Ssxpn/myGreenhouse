/**
 * contexts/MqttContext.tsx
 */
import { TOPICS } from '@/constants/topics';
import mqtt from 'mqtt';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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

type MqttStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type ArduinoStatus = 'online' | 'offline' | 'unknown';

type MqttMessage = {
  topic:   string;
  payload: string;
  ts:      Date;
};

type MqttContextType = {
  status:           MqttStatus;
  arduinoStatus:    ArduinoStatus;
  messages:         MqttMessage[];
  lastError:        string | null;
  publish:          (topic: string, payload: string, retain?: boolean) => void;
  subscribe:        (topic: string) => void;
  unsubscribe:      (topic: string) => void;
  clearMessages:    () => void;
  setArduinoStatus: (s: ArduinoStatus) => void; // ← pour forcer depuis l'extérieur
};

const MqttContext = createContext<MqttContextType | null>(null);

export function MqttProvider({ children, initialTopics = [] }: {
  children:       React.ReactNode;
  initialTopics?: string[];
}) {
  const clientRef                   = useRef<any>(null);
  const [status, setStatus]         = useState<MqttStatus>('disconnected');
  const [arduinoStatus, setArduino] = useState<ArduinoStatus>('unknown');
  const [messages, setMessages]     = useState<MqttMessage[]>([]);
  const [lastError, setLastError]   = useState<string | null>(null);

  useEffect(() => {
    setStatus('connecting');
    const topics = [...new Set([...initialTopics, TOPICS.STATUS])];
    const client = mqtt.connect(MQTT_CONFIG.brokerUrl, MQTT_CONFIG.options);
    clientRef.current = client;

    client.on('connect', () => {
      setStatus('connected');
      setLastError(null);
      topics.forEach((topic) => client.subscribe(topic));
    });

    client.on('reconnect', () => setStatus('connecting'));
    client.on('offline',   () => setStatus('disconnected'));

    client.on('error', (err: Error) => {
      setStatus('error');
      setLastError(err.message ?? 'Erreur MQTT inconnue');
    });

    client.on('message', (topic: string, payloadBuffer: Buffer) => {
      const payload = payloadBuffer.toString();
      if (topic === TOPICS.STATUS) {
        setArduino(payload === 'online' ? 'online' : 'offline');
        return;
      }
      setMessages((prev) => [
        { topic, payload, ts: new Date() },
        ...prev.slice(0, 99),
      ]);
    });

    return () => client.end(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = useCallback((topic: string, payload: string, retain = false) => {
    clientRef.current?.publish(topic, payload, { retain, qos: 1 });
  }, []);

  const subscribe = useCallback((topic: string) => {
    clientRef.current?.subscribe(topic);
  }, []);

  const unsubscribe = useCallback((topic: string) => {
    clientRef.current?.unsubscribe(topic);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const setArduinoStatus = useCallback((s: ArduinoStatus) => {
    setArduino(s);
  }, []);

  return (
    <MqttContext.Provider value={{
      status, arduinoStatus, messages, lastError,
      publish, subscribe, unsubscribe, clearMessages, setArduinoStatus,
    }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt() {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error('useMqtt doit être utilisé dans un MqttProvider');
  return ctx;
}