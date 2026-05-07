/**
 * app/(tabs)/_layout.tsx
 * Navigation adaptative :
 *  - Mobile  → bottom tab bar + header avec toggle thème
 *  - Desktop → sidebar rail avec toggle thème en bas
 */
import { Switch } from '@/components/Switch';
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Constantes ─── */
const DESKTOP_BREAKPOINT = 768;
const RAIL_WIDTH         = 56;
const SIDEBAR_WIDTH      = 220;

const TABS = [
  { name: 'index',   label: 'Accueil', icon: '🏠' },
  { name: 'journal', label: 'Journal', icon: '📋' },
] as const;

/* ════════════════════════════════════════════════════════════
   Sidebar rail (desktop)
═════════════════════════════════════════════════════════════ */
function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const anim     = useRef(new Animated.Value(RAIL_WIDTH)).current;
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, isDark, toggleTheme } = useTheme();

  const toggle = () => {
    const toValue = expanded ? RAIL_WIDTH : SIDEBAR_WIDTH;
    Animated.spring(anim, {
      toValue,
      useNativeDriver: false,
      damping:   20,
      stiffness: 180,
    }).start();
    setExpanded(o => !o);
  };

  const navigate = (name: string) => {
    router.push(name === 'index' ? '/' : `/${name}`);
  };

  const isActive = (name: string) =>
    (pathname === '/' && name === 'index') || pathname.endsWith(name);

  return (
    <Animated.View style={[
      sidebar.rail,
      {
        width:           anim,
        backgroundColor: theme.sidebarBg,
        borderRightColor:theme.sidebarBorder,
      }
    ]}>

      {/* ── Bouton toggle ── */}
      <Pressable style={sidebar.toggleBtn} onPress={toggle}>
        <Text style={[sidebar.toggleIcon, { color: theme.textSecondary }]}>
          {expanded ? '◀' : '☰'}
        </Text>
      </Pressable>

      <View style={[sidebar.divider, { backgroundColor: theme.sidebarDivider }]} />

      {/* ── Items de navigation ── */}
      {TABS.map(tab => {
        const active = isActive(tab.name);
        return (
          <Pressable
            key={tab.name}
            style={[
              sidebar.item,
              active && {
                backgroundColor: theme.surfaceActive,
                borderWidth:     1,
                borderColor:     theme.accentBorder,
              },
            ]}
            onPress={() => navigate(tab.name)}
          >
            <Text style={sidebar.itemIcon}>{tab.icon}</Text>
            <Text
              style={[
                sidebar.itemLabel,
                { color: active ? theme.accentDark : theme.textSecondary },
                active && { fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}

      {/* ── Toggle thème en bas ── */}
      <View style={sidebar.spacer} />
      <View style={[sidebar.divider, { backgroundColor: theme.sidebarDivider }]} />
      <View style={sidebar.themeRow}>
        <Text style={sidebar.themeIcon}>{isDark ? '🌙' : '☀️'}</Text>
        <Text
          style={[sidebar.themeLabel, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {isDark ? 'Sombre' : 'Clair'}
        </Text>
        <Switch isThemeToggle />
      </View>

    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════
   Header mobile
═════════════════════════════════════════════════════════════ */
const MQTT_STATUS_CONFIG = {
  connected:    { color: '#22c55e', label: 'Connecté' },
  connecting:   { color: '#f59e0b', label: 'Connexion...' },
  disconnected: { color: '#94a3b8', label: 'Déconnecté' },
  error:        { color: '#ef4444', label: 'Erreur' },
};

const ARDUINO_STATUS_CONFIG = {
  online:  { color: '#22c55e', label: 'Connecté' },
  offline: { color: '#ef4444', label: 'Déconnecté' },
  unknown: { color: '#94a3b8', label: 'Inconnu' },
};

function MobileHeader() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { arduinoStatus } = useMqtt();
  const { top } = useSafeAreaInsets();
  const arduinoCfg = ARDUINO_STATUS_CONFIG[arduinoStatus] ?? ARDUINO_STATUS_CONFIG.unknown;

  return (
    <View style={[
      header.bar,
      {
        backgroundColor:   theme.headerBg,
        borderBottomColor: theme.headerBorder,
        paddingTop:        top + 12,
      }
    ]}>
      {/* Titre + statut empilés à gauche */}
      <View style={header.left}>
        <Text style={[header.title, { color: theme.textPrimary }]}>🌿 Ma Serre</Text>
        <View style={header.statusRow}>
          <View style={[header.statusDot, { backgroundColor: arduinoCfg.color }]} />
          <Text style={[header.statusLabel, { color: arduinoCfg.color }]}>
            {arduinoCfg.label}
          </Text>
        </View>
      </View>

      {/* Toggle thème à droite */}
      <View style={header.right}>
        <Text style={header.themeIcon}>{isDark ? '🌙' : '☀️'}</Text>
        <Switch isThemeToggle />
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   Layout principal
═════════════════════════════════════════════════════════════ */
export default function TabLayout() {
  const { width }  = useWindowDimensions();
  const { theme }  = useTheme();
  const isDesktop  = width >= DESKTOP_BREAKPOINT;

  /* ── Desktop ── */
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.background }}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="index"   options={{ title: 'Accueil' }} />
            <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
          </Tabs>
        </View>
      </View>
    );
  }

  /* ── Mobile ── */
  return (
    <View style={{ flex: 1, backgroundColor: theme.headerBg }}>
      <MobileHeader />
      <Tabs
        screenOptions={{
          headerShown:             false,
          tabBarStyle:             {
            ...styles.tabBar,
            backgroundColor: theme.tabBarBg,
            borderTopColor:  theme.tabBarBorder,
          },
          tabBarActiveTintColor:   theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarLabelStyle:        styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🏠</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'Journal',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>📋</Text>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

/* ─── Styles tab bar ─── */
const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth:  1,
    height:          74,
    paddingBottom:   16,
    paddingTop:      8,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: -2 },
    elevation:       8,
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
  },
  tabLabel: {
    fontSize:   11,
    fontWeight: '600',
    marginTop:  2,
  },
});

/* ─── Styles sidebar ─── */
const sidebar = StyleSheet.create({
  rail: {
    overflow:         'hidden',
    paddingTop:       16,
    paddingBottom:    16,
    borderRightWidth: 1,
  },
  toggleBtn: {
    width:           RAIL_WIDTH,
    height:          44,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
  },
  toggleIcon: {
    fontSize: 18,
  },
  divider: {
    height:           1,
    marginVertical:   10,
    marginHorizontal: 8,
  },
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            48,
    paddingHorizontal: 14,
    marginHorizontal:  6,
    marginVertical:    2,
    borderRadius:      10,
    gap:               12,
  },
  itemIcon: {
    fontSize:  20,
    width:     24,
    textAlign: 'center',
  },
  itemLabel: {
    fontSize:   14,
    fontWeight: '500',
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  themeRow: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            48,
    paddingHorizontal: 14,
    marginHorizontal:  6,
    marginVertical:    2,
    gap:               10,
  },
  themeIcon: {
    fontSize:  18,
    width:     24,
    textAlign: 'center',
  },
  themeLabel: {
    fontSize:   13,
    fontWeight: '500',
    flex:       1,
  },
  themeSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
});

/* ─── Styles header mobile ─── */
const header = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderBottomWidth: 1,
    shadowColor:       '#000',
    shadowOpacity:     0.04,
    shadowRadius:      4,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         2,
  },
  left: {
    gap: 3,
  },
  title: {
    fontSize:   17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  statusDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize:   12,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  themeIcon: {
    fontSize: 18,
  },
});