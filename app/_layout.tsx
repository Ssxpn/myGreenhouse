/**
 * app/_layout.tsx  ←  Layout RACINE
 */
import { TOPICS } from '@/constants/topics';
import { MqttProvider } from '@/contexts/MqttContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const INITIAL_TOPICS = Object.values(TOPICS);

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal"  options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MqttProvider initialTopics={INITIAL_TOPICS}>
        <AppContent />
      </MqttProvider>
    </ThemeProvider>
  );
}