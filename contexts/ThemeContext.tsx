/**
 * contexts/ThemeContext.tsx
 * Thème clair / sombre global, partagé dans toute l'app.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

// ─── Palettes ────────────────────────────────────────────────────────────────

export const LIGHT = {
  /* Fonds */
  background:     '#f1f5f9',
  surface:        '#ffffff',
  surfaceActive:  '#dcfce7',

  /* Sidebar */
  sidebarBg:      '#ffffff',
  sidebarBorder:  '#e2e8f0',
  sidebarDivider: '#f1f5f9',

  /* Textes */
  textPrimary:    '#1e293b',
  textSecondary:  '#64748b',
  textMuted:      '#94a3b8',

  /* Accents */
  accent:         '#22c55e',
  accentDark:     '#16a34a',
  accentBorder:   '#22c55e',

  /* Tab bar */
  tabBarBg:       '#ffffff',
  tabBarBorder:   '#e2e8f0',

  /* Header mobile */
  headerBg:       '#ffffff',
  headerBorder:   '#e2e8f0',

  /* Pending / warning */
  pendingBg:      '#fef9c3',
  pendingBorder:  '#fbbf24',
  pendingText:    '#92400e',

  /* Bouton désactivé */
  disabledBg:     '#cbd5e1',
  disabledText:   '#ffffff',

  /* Toggle */
  toggleIcon:     '☀️',
  toggleLabel:    'Thème clair',
} as const;

export const DARK = {
  /* Fonds */
  background:     '#0f172a',
  surface:        '#1e293b',
  surfaceActive:  '#14532d',

  /* Sidebar */
  sidebarBg:      '#1e293b',
  sidebarBorder:  '#334155',
  sidebarDivider: '#334155',

  /* Textes */
  textPrimary:    '#f1f5f9',
  textSecondary:  '#94a3b8',
  textMuted:      '#64748b',

  /* Accents */
  accent:         '#22c55e',
  accentDark:     '#22c55e',
  accentBorder:   '#22c55e',

  /* Tab bar */
  tabBarBg:       '#1e293b',
  tabBarBorder:   '#334155',

  /* Header mobile */
  headerBg:       '#1e293b',
  headerBorder:   '#334155',

  /* Pending / warning */
  pendingBg:      '#422006',
  pendingBorder:  '#92400e',
  pendingText:    '#fbbf24',

  /* Bouton désactivé */
  disabledBg:     '#334155',
  disabledText:   '#64748b',

  /* Toggle */
  toggleIcon:     '🌙',
  toggleLabel:    'Thème sombre',
} as const;

export type Theme = typeof LIGHT;

// ─── Contexte ────────────────────────────────────────────────────────────────

type ThemeContextType = {
  theme:     Theme;
  isDark:    boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => setIsDark(d => !d), []);

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