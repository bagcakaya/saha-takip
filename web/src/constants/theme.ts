export const Colors = {
  light: {
    text: '#0F172A', // Sleek slate-900
    background: '#F8FAFC', // Slate-50 off-white
    backgroundElement: '#FFFFFF', // Clean white cards
    backgroundSelected: '#E2E8F0', // Slate-200
    textSecondary: '#64748B', // Slate-500
    primary: '#0F172A', // Dark Slate Primary
    primaryBg: '#F1F5F9', // Slate-100
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
