/**
 * Teal Focus Design System — Single source of truth for all design tokens.
 *
 * Colors, spacing, radii, typography and semantic status tokens are defined
 * here and referenced by every screen and component.  Keep the visual layer
 * consistent by importing from this file instead of hard-coding values.
 */

export const colors = {
  primary: '#0F766E',
  primaryPressed: '#115E59',
  primaryTint: '#F0FDFA',
  primaryTintBorder: '#CCFBF1',
  inputBorderOnTint: '#99F6E4',

  background: '#F8FAFC',
  surface: '#FFFFFF',

  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  divider: '#F3F4F6',

  textPrimary: '#111827',
  textSecondary: '#6B7280',

  success: '#166534',
  successDot: '#16A34A',
  warning: '#92400E',
  warningDot: '#D97706',
  error: '#991B1B',
  errorDot: '#DC2626',

  white: '#FFFFFF',
} as const;

export const radius = {
  card: 14,
  button: 12,
  input: 12,
  fab: 16,
  badge: 999,
} as const;

export const spacing = {
  screenPadding: 20,
  gridGap: 12,
  cardPadding: 16,
  sectionGap: 20,
} as const;

export const typography = {
  screenTitle: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const },
  sectionHeading: { fontSize: 16, fontWeight: '600' as const },
  metricValue: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const },
  secondary: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionMedium: { fontSize: 12, fontWeight: '500' as const },
  tabLabel: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
} as const;

/** Re-export the whole theme as a single object for convenience. */
export const theme = { colors, radius, spacing, typography } as const;
export type Theme = typeof theme;
