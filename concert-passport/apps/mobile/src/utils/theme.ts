// =============================================================
// Concert Passport — Design Tokens
// =============================================================

export const colors = {
  // Backgrounds
  background:    '#FFFFFF',   // clean white
  surface:       '#F7F5F0',   // warm off-white — cards, bottom bar
  surfaceRaised: '#EDE9E0',   // modals, elevated cards
  border:        '#E2DDD4',

  // Text
  text:          '#0A0908',   // warm near-black
  textSecondary: '#5C5751',
  textMuted:     '#A09890',

  // Brand
  accent:        '#FF3B2F',   // bold coral-red — primary CTA
  accentLight:   '#FF6B61',
  accentGlow:    'rgba(255, 59, 47, 0.12)',

  // Stamp rarities
  common:        '#6B7280',
  uncommon:      '#16A34A',
  rare:          '#2563EB',
  legendary:     '#D97706',

  // Ratings
  star:          '#F59E0B',

  // Status
  success:       '#16A34A',
  error:         '#DC2626',
  warning:       '#D97706',
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
    shadowColor: '#FF3B2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;
