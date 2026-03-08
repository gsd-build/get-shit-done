// =============================================================
// Concert Passport — Design Tokens
// Brutalist: black · white · lime-green · monospace · zero-radius
// =============================================================

export const colors = {
  // Backgrounds
  background:    '#FFFFFF',
  surface:       '#FFFFFF',
  surfaceRaised: '#F0F0F0',
  border:        '#000000',

  // Text
  text:          '#000000',
  textSecondary: '#333333',
  textMuted:     '#666666',

  // Brand — lime green
  accent:        '#ADFF2F',
  accentDark:    '#7BBF00',
  accentGlow:    'rgba(173, 255, 47, 0.2)',

  // Stamp rarities
  common:        '#888888',
  uncommon:      '#ADFF2F',
  rare:          '#00D4FF',
  legendary:     '#FFE500',

  // Ratings
  star:          '#ADFF2F',

  // Status
  success:       '#ADFF2F',
  error:         '#FF3B2F',
  warning:       '#FFE500',
} as const;

export const typography = {
  // Monospace everywhere — digital / pixel feel
  heading:  'JetBrainsMono',
  body:     'Inter-Regular',
  bodyMed:  'Inter-Medium',
  bodySemi: 'Inter-SemiBold',
  mono:     'JetBrainsMono',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// Zero border-radius — brutalist sharp corners everywhere
export const radius = {
  sm:   0,
  md:   0,
  lg:   0,
  xl:   0,
  full: 0,
} as const;

// Hard-offset shadows — brutalist feel, no blur
export const shadows = {
  stamp: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius:  0,
    elevation:     6,
  },
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius:  0,
    elevation:     3,
  },
} as const;
