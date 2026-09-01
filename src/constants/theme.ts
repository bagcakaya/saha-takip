/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A', // Sleek slate-900 instead of pure black
    background: '#F8FAFC', // Slate-50 off-white
    backgroundElement: '#FFFFFF', // Clean white cards
    backgroundSelected: '#E2E8F0', // Slate-200
    textSecondary: '#64748B', // Slate-500
    primary: '#0F172A', // Dark Indigo/Slate Primary
    primaryBg: '#F1F5F9',
    primaryAccent: '#3B82F6', // Blue Accent
    statusCompleted: '#10B981', // Emerald-500
    statusCompletedBg: '#E6F4EA', // Muted green-50
    statusNotPresent: '#F59E0B', // Amber-500
    statusNotPresentBg: '#FEF3C7', // Amber-50
    statusPending: '#94A3B8', // Slate-400
    statusPendingBg: '#F1F5F9', // Slate-100
    danger: '#EF4444', // Red-500
    dangerBg: '#FEE2E2', // Red-50
  },
  dark: {
    text: '#F8FAFC', // Slate-50
    background: '#0F172A', // Slate-900
    backgroundElement: '#1E293B', // Slate-800
    backgroundSelected: '#334155', // Slate-700
    textSecondary: '#94A3B8', // Slate-400
    primary: '#3B82F6', // Blue Accent
    primaryBg: '#172554', // Dark Blue
    primaryAccent: '#60A5FA',
    statusCompleted: '#34D399', // Emerald-400
    statusCompletedBg: '#064E3B', // Muted green-900
    statusNotPresent: '#FBBF24', // Amber-400
    statusNotPresentBg: '#78350F', // Amber-900
    statusPending: '#64748B', // Slate-500
    statusPendingBg: '#1E293B', // Slate-800
    danger: '#F87171', // Red-400
    dangerBg: '#7F1D1D', // Red-900
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
