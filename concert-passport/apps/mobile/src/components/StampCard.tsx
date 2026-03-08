import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { colors, radius, typography } from '../utils/theme';
import type { Stamp, StampRarity } from '@concert-passport/shared';

// Rarity config
const RARITY_CONFIG: Record<StampRarity, { gradient: [string, string]; label: string; glow: string }> = {
  common:    { gradient: ['#6B7280', '#4B5563'],     label: '',            glow: 'transparent' },
  uncommon:  { gradient: ['#16A34A', '#15803D'],     label: 'UNCOMMON',    glow: 'rgba(22,163,74,0.3)' },
  rare:      { gradient: ['#2563EB', '#1D4ED8'],     label: 'RARE',        glow: 'rgba(37,99,235,0.35)' },
  legendary: { gradient: ['#D97706', '#B45309'],     label: '✦ LEGENDARY', glow: 'rgba(217,119,6,0.4)' },
};

interface Props {
  stamp: Stamp;
  size?: 'small' | 'large';
  onPress?: () => void;
  animationDelay?: number;
}

export function StampCard({ stamp, size = 'large', onPress, animationDelay = 0 }: Props) {
  const config  = RARITY_CONFIG[stamp.rarity];
  const scale   = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withDelay(animationDelay, withSpring(1));
    scale.value   = withDelay(animationDelay, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    scale.value = withSequence(
      withSpring(0.94, { damping: 10 }),
      withSpring(1,    { damping: 10 })
    );
    onPress?.();
  }

  const isLarge = size === 'large';

  return (
    <Animated.View style={[animStyle, isLarge ? styles.containerLarge : styles.containerSmall]}>
      <Pressable onPress={handlePress}>
        {/* Glow effect for rare+ */}
        {stamp.rarity !== 'common' && (
          <View style={[styles.glow, { shadowColor: config.glow, backgroundColor: config.glow }]} />
        )}

        <LinearGradient
          colors={config.gradient as [string, string]}
          style={[styles.card, isLarge ? styles.cardLarge : styles.cardSmall]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Perforated border (passport stamp look) */}
          <View style={styles.perforatedBorder} />

          {/* Rarity label */}
          {stamp.rarity !== 'common' && (
            <Text style={[styles.rarityLabel, { color: getRarityColor(stamp.rarity) }]}>
              {config.label}
            </Text>
          )}

          {/* Artist icon placeholder — will be actual image */}
          <View style={styles.iconArea}>
            <Text style={styles.iconText}>
              {stamp.label_line_1?.charAt(0) ?? '♪'}
            </Text>
          </View>

          {/* Stamp info */}
          <View style={styles.info}>
            <Text style={styles.artistName} numberOfLines={1}>
              {stamp.label_line_1}
            </Text>
            {isLarge && (
              <Text style={styles.venueName} numberOfLines={1}>
                {stamp.label_line_2}
              </Text>
            )}
            <Text style={styles.date}>{stamp.label_line_3}</Text>
          </View>

          {/* Limited badge */}
          {stamp.is_limited && (
            <View style={styles.limitedBadge}>
              <Text style={styles.limitedText}>LIMITED</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function getRarityColor(rarity: StampRarity): string {
  switch (rarity) {
    case 'uncommon':  return colors.uncommon;
    case 'rare':      return colors.rare;
    case 'legendary': return colors.legendary;
    default:          return colors.textMuted;
  }
}

const styles = StyleSheet.create({
  containerLarge: { margin: 8 },
  containerSmall: { margin: 4 },

  glow: {
    position:      'absolute',
    top:           -4,
    left:          -4,
    right:         -4,
    bottom:        -4,
    borderRadius:  radius.lg + 4,
    opacity:       0.6,
  },

  card: {
    borderRadius:  radius.lg,
    alignItems:    'center',
    overflow:      'hidden',
  },
  cardLarge: {
    width:         160,
    height:        200,
    padding:       14,
  },
  cardSmall: {
    width:         90,
    height:        115,
    padding:       8,
  },

  perforatedBorder: {
    position:      'absolute',
    top:           6,
    left:          6,
    right:         6,
    bottom:        6,
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.12)',
    borderRadius:  radius.md,
    borderStyle:   'dashed',
  },

  rarityLabel: {
    fontSize:      9,
    fontFamily:    typography.bodySemi,
    letterSpacing: 1.5,
    marginBottom:  4,
  },

  iconArea: {
    width:         64,
    height:        64,
    borderRadius:  32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems:    'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  iconText: {
    fontSize:      28,
    color:         colors.text,
  },

  info: {
    alignItems:    'center',
    gap:           2,
  },
  artistName: {
    color:         colors.text,
    fontSize:      12,
    fontFamily:    typography.bodySemi,
    textAlign:     'center',
  },
  venueName: {
    color:         colors.textSecondary,
    fontSize:      10,
    fontFamily:    typography.body,
    textAlign:     'center',
  },
  date: {
    color:         colors.textMuted,
    fontSize:      9,
    fontFamily:    typography.mono,
    marginTop:     2,
  },

  limitedBadge: {
    position:      'absolute',
    top:           10,
    right:         10,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth:   1,
    borderColor:   colors.legendary,
    borderRadius:  radius.sm,
    paddingHorizontal: 4,
    paddingVertical:   2,
  },
  limitedText: {
    fontSize:      7,
    color:         colors.legendary,
    fontFamily:    typography.bodySemi,
    letterSpacing: 1,
  },
});
