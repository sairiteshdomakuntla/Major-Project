// Reusable theme foundation (mirrors tailwind.config.js extend).
// Keep colors/spacing/rounding in one place for future accessibility features
// (e.g. high-contrast mode, larger text).

export const theme = {
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#38BDF8',
    onPrimary: '#0F172A',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
} as const;

export type Theme = typeof theme;
