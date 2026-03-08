import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { colors, typography } from '../utils/theme';
import type { Stamp, StampRarity } from '@concert-passport/shared';

// Rarity config — flat brutalist fills, no gradients
const RARITY_CONFIG: Record<StampRarity, { bg: string; fg: string; label: string; borderColor: string }> = {
  common:    { bg: '#1A1A1A',         fg: '#FFFFFF', label: '',            borderColor: '#000000' },
  uncommon:  { bg: colors.uncommon,   fg: '#000000', label: 'UNCOMMON',    borderColor: '#000000' },
  rare:      { bg: colors.rare,       fg: '#000000', label: 'RARE',        borderColor: '#000000' },
  legendary: { bg: colors.legendary,  fg: '#000000', label: '✦ LEGENDARY', borderColor: '#000000' },
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
        <View
          style={[
            styles.card,
            isLarge ? styles.cardLarge : styles.cardSmall,
            { backgroundColor: config.bg, borderColor: config.borderColor },
          ]}
        >
          {/* Hard-offset shadow block (decorative) */}
          <View style={[styles.shadowBlock, { borderColor: config.borderColor }]} />

          {/* Rarity label */}
          {stamp.rarity !== 'common' && (
            <Text style={[styles.rarityLabel, { color: config.fg }]}>
              {config.label}
            </Text>
          )}

          {/* Artist initial — square block */}
          <View style={[styles.iconArea, { borderColor: config.fg + '44' }]}>
            <Text style={[styles.iconText, { color: config.fg }]}>
              {stamp.label_line_1?.charAt(0) ?? '♪'}
            </Text>
          </View>

          {/* Stamp info */}
          <View style={styles.info}>
            <Text style={[styles.artistName, { color: config.fg }]} numberOfLines={1}>
              {stamp.label_line_1?.toUpperCase()}
            </Text>
            {isLarge && (
              <Text style={[styles.venueName, { color: config.fg + 'BB' }]} numberOfLines={1}>
                {stamp.label_line_2}
              </Text>
            )}
            <Text style={[styles.date, { color: config.fg + '99' }]}>
              {stamp.label_line_3}
            </Text>
          </View>

          {/* Limited badge */}
          {stamp.is_limited && (
            <View style={[styles.limitedBadge, { borderColor: config.fg, backgroundColor: config.fg + '22' }]}>
              <Text style={[styles.limitedText, { color: config.fg }]}>LTD</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  containerLarge: { margin: 8 },
  containerSmall: { margin: 4 },

  card: {
    alignItems: 'center',
    overflow:   'hidden',
    borderWidth: 2,
    position:   'relative',
  },
  cardLarge: {
    width:   160,
    height:  200,
    padding: 14,
  },
  cardSmall: {
    width:   90,
    height:  115,
    padding: 8,
  },

  // Brutalist hard-offset decorative block
  shadowBlock: {
    position:    'absolute',
    top:         4,
    left:        4,
    right:       -4,
    bottom:      -4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    zIndex:      -1,
  },

  rarityLabel: {
    fontSize:      9,
    fontFamily:    typography.mono,
    letterSpacing: 1.5,
    marginBottom:  4,
  },

  iconArea: {
    width:           56,
    height:          56,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
    marginVertical:  8,
  },
  iconText: {
    fontSize:   24,
    fontFamily: typography.mono,
  },

  info: {
    alignItems: 'center',
    gap:        2,
  },
  artistName: {
    fontSize:      11,
    fontFamily:    typography.mono,
    textAlign:     'center',
    letterSpacing: 0.5,
  },
  venueName: {
    fontSize:   9,
    fontFamily: typography.mono,
    textAlign:  'center',
  },
  date: {
    fontSize:      8,
    fontFamily:    typography.mono,
    marginTop:     2,
    letterSpacing: 0.5,
  },

  limitedBadge: {
    position:          'absolute',
    top:               8,
    right:             8,
    borderWidth:       1,
    paddingHorizontal: 4,
    paddingVertical:   2,
  },
  limitedText: {
    fontSize:      7,
    fontFamily:    typography.mono,
    letterSpacing: 1,
  },
});
