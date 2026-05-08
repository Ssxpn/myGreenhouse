/**
 * contexts/ThemeContext.tsx
 * Thème clair / sombre global, partagé dans toute l'app.
 * Persistance via AsyncStorage — survit aux rechargements.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'serre:theme';

// ─── Palettes ────────────────────────────────────────────────────────────────
export const LIGHT = {
  background:     '#f1f5f9',
  surface:        '#ffffff',
  surfaceActive:  '#dcfce7',
  sidebarBg:      '#ffffff',
  sidebarBorder:  '#e2e8f0',
  sidebarDivider: '#f1f5f9',
  textPrimary:    '#1e293b',
  textSecondary:  '#64748b',
  textMuted:      '#94a3b8',
  accent:         '#22c55e',
  accentDark:     '#16a34a',
  accentBorder:   '#22c55e',
  tabBarBg:       '#ffffff',
  tabBarBorder:   '#e2e8f0',
  headerBg:       '#ffffff',
  headerBorder:   '#e2e8f0',
  pendingBg:      '#fef9c3',
  pendingBorder:  '#fbbf24',
  pendingText:    '#92400e',
  disabledBg:     '#cbd5e1',
  disabledText:   '#ffffff',
  toggleIcon:     '☀️',
  toggleLabel:    'Thème clair',
} as const;

export const DARK = {
  background:     '#0f172a',
  surface:        '#1e293b',
  surfaceActive:  '#14532d',
  sidebarBg:      '#1e293b',
  sidebarBorder:  '#334155',
  sidebarDivider: '#334155',
  textPrimary:    '#f1f5f9',
  textSecondary:  '#94a3b8',
  textMuted:      '#64748b',
  accent:         '#22c55e',
  accentDark:     '#22c55e',
  accentBorder:   '#22c55e',
  tabBarBg:       '#1e293b',
  tabBarBorder:   '#334155',
  headerBg:       '#1e293b',
  headerBorder:   '#334155',
  pendingBg:      '#422006',
  pendingBorder:  '#92400e',
  pendingText:    '#fbbf24',
  disabledBg:     '#334155',
  disabledText:   '#64748b',
  toggleIcon:     '🌙',
  toggleLabel:    'Thème sombre',
} as const;

export type Theme = typeof LIGHT;

// ─── Contexte ────────────────────────────────────────────────────────────────
type ThemeContextType = {
  theme:       Theme;
  isDark:      boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark]     = useState(false);
  const [loaded, setLoaded]     = useState(false);

  /* ── Lecture AsyncStorage au montage ── */
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === 'dark') setIsDark(true);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /* ── Sauvegarde à chaque changement ── */
  const toggleTheme = useCallback(() => {
    setIsDark((d) => {
      const next = !d;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  /* ── Ne pas rendre l'app avant d'avoir lu le thème (évite le flash) ── */
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  return ctx;
}