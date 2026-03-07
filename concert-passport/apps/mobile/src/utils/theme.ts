// =============================================================
// Concert Passport — Design Tokens
// =============================================================

export const colors = {
  // Backgrounds
  background:    '#0d0d1a',   // near-black, deep navy
  surface:       '#141428',   // card / bottom bar
  surfaceRaised: '#1c1c38',   // modals, elevated cards
  border:        '#2a2a50',

  // Text
  text:          '#f0f0ff',
  textSecondary: '#9999cc',
  textMuted:     '#555580',

  // Brand
  accent:        '#7c5cfc',   // electric violet — primary CTA
  accentLight:   '#a78bfa',
  accentGlow:    'rgba(124, 92, 252, 0.25)',

  // Stamp rarities
  common:        '#6b7280',
  uncommon:      '#22c55e',
  rare:          '#3b82f6',
  legendary:     '#f59e0b',

  // Ratings
  star:          '#fbbf24',

  // Status
  success:       '#22c55e',
  error:         '#ef4444',
  warning:       '#f59e0b',
} as const;

export const typography = {
  // Font families (loaded via expo-font)
  heading:  'Playfair-Bold',      // serif — passport/editorial feel
  body:     'Inter-Regular',
  bodyMed:  'Inter-Medium',
  bodySemi: 'Inter-SemiBold',
  mono:     'JetBrainsMono',      // for stats/numbers
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const radius = {
  sm:   6,
  md:   12,
  lg:   20,
  xl:   32,
  full: 9999,
} as const;

export const shadows = {
  stamp: {
    shadowColor: '#7c5cfc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
