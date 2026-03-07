import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../utils/theme';

interface Props {
  value: number;           // 0–5, supports 0.5 increments
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readonly = false, size = 32 }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          star={star}
          value={value}
          size={size}
          readonly={readonly}
          onPress={onChange}
        />
      ))}
    </View>
  );
}

function Star({
  star,
  value,
  size,
  readonly,
  onPress,
}: {
  star:     number;
  value:    number;
  size:     number;
  readonly: boolean;
  onPress?: (v: number) => void;
}) {
  const scale = useSharedValue(1);

  const fill = value >= star ? 1 : value >= star - 0.5 ? 0.5 : 0;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (readonly || !onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(1.4, { damping: 8 }),
      withSpring(1,   { damping: 8 })
    );
    onPress(star);
  }

  return (
    <Pressable onPress={handlePress} disabled={readonly}>
      <Animated.View style={[animStyle, { width: size + 8, alignItems: 'center' }]}>
        {fill === 1   && <FullStar  size={size} />}
        {fill === 0.5 && <HalfStar  size={size} />}
        {fill === 0   && <EmptyStar size={size} />}
      </Animated.View>
    </Pressable>
  );
}

// SVG-like stars using unicode — replace with react-native-svg in production for crisp rendering
function FullStar({ size }: { size: number }) {
  return (
    <Animated.Text style={{ fontSize: size, color: colors.star, lineHeight: size + 4 }}>
      ★
    </Animated.Text>
  );
}

function HalfStar({ size }: { size: number }) {
  return (
    <Animated.Text style={{ fontSize: size, color: colors.star, lineHeight: size + 4 }}>
      ⭐
    </Animated.Text>
  );
}

function EmptyStar({ size }: { size: number }) {
  return (
    <Animated.Text style={{ fontSize: size, color: colors.border, lineHeight: size + 4 }}>
      ☆
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
  },
});
