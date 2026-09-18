import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  subtext: string;
  navBackground: string;
  navBorder: string;
  headerBackground: string;
  headerBorder: string;
  statBoxBg: string;
  statBoxBorder: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colors: ThemeColors;
}

const THEME_STORAGE_KEY = '@app_theme_mode';

const darkColors: ThemeColors = {
  background: '#020617',
  card: '#0c152e',
  cardBorder: 'rgba(255, 255, 255, 0.12)',
  text: '#ffffff',
  subtext: '#94a3b8',
  navBackground: 'rgba(15, 23, 42, 0.95)',
  navBorder: 'rgba(148, 163, 184, 0.15)',
  headerBackground: '#0b1329',
  headerBorder: 'rgba(255, 255, 255, 0.08)',
  statBoxBg: 'rgba(255, 255, 255, 0.08)',
  statBoxBorder: 'rgba(255, 255, 255, 0.1)',
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  card: '#ffffff',
  cardBorder: 'rgba(0, 0, 0, 0.08)',
  text: '#0f172a',
  subtext: '#64748b',
  navBackground: 'rgba(255, 255, 255, 0.95)',
  navBorder: 'rgba(226, 232, 240, 0.8)',
  headerBackground: '#ffffff',
  headerBorder: 'rgba(0, 0, 0, 0.06)',
  statBoxBg: 'rgba(15, 23, 42, 0.04)',
  statBoxBorder: 'rgba(15, 23, 42, 0.08)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        } else if (systemScheme === 'light' || systemScheme === 'dark') {
          setThemeState(systemScheme);
        }
      })
      .catch(() => {
        // fallback to dark
      });
  }, [systemScheme]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
