import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
  FlatList,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../../src/utils/theme';
import { StampCard } from '../../src/components/StampCard';
import type { Stamp, Passport } from '@concert-passport/shared';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PASSPORT_W = SCREEN_W * 0.72;
const PASSPORT_H = PASSPORT_W * 1.42;    // real passport ratio
const PAGE_W     = SCREEN_W;
const STAMPS_PER_PAGE = 6;               // 2 columns × 3 rows

// Mock data — will be replaced by real service calls
const MOCK_STAMPS: Stamp[] = [
  { id: '1', show_log_id: '1', user_id: 'u1', artist_id: 'a1', tour_id: 't1', show_id: 's1',
    stamp_url: '', rarity: 'legendary', is_limited: true,
    label_line_1: 'Taylor Swift', label_line_2: 'Wembley · London', label_line_3: '21 JUN 2024', issued_at: '' },
  { id: '2', show_log_id: '2', user_id: 'u1', artist_id: 'a2', tour_id: null, show_id: 's2',
    stamp_url: '', rarity: 'uncommon', is_limited: false,
    label_line_1: 'Arctic Monkeys', label_line_2: 'O2 Arena · London', label_line_3: '04 NOV 2023', issued_at: '' },
  { id: '3', show_log_id: '3', user_id: 'u1', artist_id: 'a3', tour_id: 't3', show_id: 's3',
    stamp_url: '', rarity: 'rare', is_limited: false,
    label_line_1: 'Beyoncé', label_line_2: 'Glastonbury · Pilton', label_line_3: '25 JUN 2023', issued_at: '' },
  { id: '4', show_log_id: '4', user_id: 'u1', artist_id: 'a4', tour_id: null, show_id: 's4',
    stamp_url: '', rarity: 'common', is_limited: false,
    label_line_1: 'Radiohead', label_line_2: 'Alex. Palace · London', label_line_3: '12 MAR 2023', issued_at: '' },
  { id: '5', show_log_id: '5', user_id: 'u1', artist_id: 'a5', tour_id: null, show_id: 's5',
    stamp_url: '', rarity: 'uncommon', is_limited: false,
    label_line_1: 'Olivia Rodrigo', label_line_2: 'O2 Arena · London', label_line_3: '14 MAY 2024', issued_at: '' },
];

const MOCK_PASSPORT: Passport = {
  id: 'p1', user_id: 'u1', theme: 'classic', cover_color: '#1a1a2e',
  total_stamps: 5, total_shows: 5, total_artists: 5, total_countries: 2,
};

// ─── Passport Cover ────────────────────────────────────────────────────────────

function PassportCover({
  passport,
  isOpen,
  onOpen,
}: {
  passport: Passport;
  isOpen:   boolean;
  onOpen:   () => void;
}) {
  const rotateY   = useSharedValue(0);
  const coverOpacity = useSharedValue(1);

  useEffect(() => {
    if (isOpen) {
      rotateY.value      = withSpring(-160, { damping: 18, stiffness: 80 });
      coverOpacity.value = withTiming(0, { duration: 300 });
    } else {
      rotateY.value      = withSpring(0, { damping: 18, stiffness: 80 });
      coverOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isOpen]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.value,
    transform: [{ perspective: 1200 }, { rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.passportContainer, coverStyle]}>
      <Pressable onPress={onOpen}>
        <LinearGradient
          colors={['#1e1e3f', '#0d0d1a', '#1a0a2e']}
          style={styles.passportCover}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Embossed border */}
          <View style={styles.coverBorder} />

          {/* Crest / emblem */}
          <View style={styles.crest}>
            <Text style={styles.crestIcon}>♬</Text>
          </View>

          {/* Title block */}
          <View style={styles.coverTitleBlock}>
            <Text style={styles.coverCountry}>CONCERT</Text>
            <Text style={styles.coverTitle}>PASSPORT</Text>
          </View>

          {/* Username + year */}
          <View style={styles.coverFooter}>
            <Text style={styles.coverUsername}>@username</Text>
            <Text style={styles.coverYear}>2 0 2 5</Text>
          </View>

          {/* Subtle gold foil texture lines */}
          <View style={styles.foilLine1} />
          <View style={styles.foilLine2} />

          {/* Tap hint */}
          <Text style={styles.tapHint}>tap to open</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Passport Pages ─────────────────────────────────────────────────────────────

function PassportPages({
  stamps,
  visible,
  onClose,
}: {
  stamps:  Stamp[];
  visible: boolean;
  onClose: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const opacity     = useSharedValue(0);
  const translateY  = useSharedValue(40);

  useEffect(() => {
    if (visible) {
      opacity.value    = withSpring(1);
      translateY.value = withSpring(0, { damping: 18 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Chunk stamps into pages of STAMPS_PER_PAGE
  const pages: Stamp[][] = [];
  for (let i = 0; i < stamps.length; i += STAMPS_PER_PAGE) {
    pages.push(stamps.slice(i, i + STAMPS_PER_PAGE));
  }
  // Always add an empty page at end (for empty slots / future stamps)
  if (pages.length === 0 || pages[pages.length - 1].length === STAMPS_PER_PAGE) {
    pages.push([]);
  }

  if (!visible) return null;

  return (
    <Animated.View style={[styles.pagesContainer, animStyle]}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.pageHeaderTitle}>Your Stamps</Text>
        <Pressable
          style={styles.shareButton}
          onPress={() => Share.share({ message: 'Check out my Concert Passport! 🎫' })}
        >
          <Ionicons name="share-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>

      {/* Page indicator */}
      <View style={styles.pageIndicator}>
        {pages.map((_, i) => (
          <View
            key={i}
            style={[styles.pageDot, i === currentPage && styles.pageDotActive]}
          />
        ))}
      </View>

      {/* Swipeable pages */}
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
          setCurrentPage(page);
        }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item: pageStamps, index: pageIndex }) => (
          <PassportPage
            stamps={pageStamps}
            pageNumber={pageIndex + 1}
            totalPages={pages.length}
          />
        )}
      />
    </Animated.View>
  );
}

function PassportPage({
  stamps,
  pageNumber,
  totalPages,
}: {
  stamps:     Stamp[];
  pageNumber: number;
  totalPages: number;
}) {
  const filledSlots = stamps.length;
  const emptySlots  = STAMPS_PER_PAGE - filledSlots;

  return (
    <View style={styles.page}>
      {/* Page left binding line */}
      <View style={styles.pageBinding} />

      <View style={styles.pageContent}>
        {/* Page number */}
        <Text style={styles.pageNumber}>PAGE {pageNumber} / {totalPages}</Text>

        {/* Stamp grid — 2 columns */}
        <View style={styles.stampGrid}>
          {stamps.map((stamp, i) => (
            <StampCard
              key={stamp.id}
              stamp={stamp}
              size="large"
              animationDelay={i * 80}
            />
          ))}
          {/* Empty stamp slots */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.emptyStampSlot}>
              <Text style={styles.emptyStampIcon}>＋</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Stats bar at top ───────────────────────────────────────────────────────────

function PassportStats({ passport }: { passport: Passport }) {
  return (
    <View style={styles.statsRow}>
      <StatItem label="Shows"     value={String(passport.total_shows)} />
      <StatItem label="Artists"   value={String(passport.total_artists)} />
      <StatItem label="Countries" value={String(passport.total_countries)} />
      <StatItem label="Stamps"    value={String(passport.total_stamps)} />
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────────

export default function PassportScreen() {
  const [isOpen, setIsOpen] = useState(false);

  const passport = MOCK_PASSPORT;
  const stamps   = MOCK_STAMPS;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={['#0d0d1a', '#12102a', '#0d0d1a']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Passport</Text>
          <Pressable>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Stats */}
        <PassportStats passport={passport} />

        {/* Year selector pill */}
        <View style={styles.yearPill}>
          <Ionicons name="chevron-back" size={14} color={colors.textSecondary} />
          <Text style={styles.yearText}>2025</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>

        {/* Passport cover — centred on screen */}
        <View style={styles.passportArea}>
          <PassportCover
            passport={passport}
            isOpen={isOpen}
            onOpen={() => setIsOpen(true)}
          />
        </View>

        {/* Pages slide up over the cover when open */}
        <PassportPages
          stamps={stamps}
          visible={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: colors.background },
  background: { flex: 1 },

  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  headerTitle: {
    color:      colors.text,
    fontSize:   24,
    fontFamily: typography.heading,
  },

  statsRow: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.md,
    backgroundColor:   colors.surface,
    borderRadius:      radius.lg,
    paddingVertical:   spacing.md,
  },
  statItem:  { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontFamily: typography.mono },
  statLabel: { color: colors.textMuted, fontSize: 11, fontFamily: typography.body, marginTop: 2 },

  yearPill: {
    flexDirection:  'row',
    alignSelf:      'center',
    alignItems:     'center',
    gap:            spacing.sm,
    backgroundColor: colors.surface,
    borderRadius:   radius.full,
    paddingVertical:   6,
    paddingHorizontal: 16,
    marginBottom:   spacing.lg,
  },
  yearText: {
    color:      colors.text,
    fontSize:   14,
    fontFamily: typography.bodySemi,
    letterSpacing: 2,
  },

  passportArea: {
    alignItems:      'center',
    justifyContent:  'center',
    flex:            1,
  },

  // Cover
  passportContainer: {
    ...shadows.stamp,
  },
  passportCover: {
    width:         PASSPORT_W,
    height:        PASSPORT_H,
    borderRadius:  radius.xl,
    alignItems:    'center',
    justifyContent: 'space-between',
    paddingVertical:   32,
    paddingHorizontal: 24,
    overflow:      'hidden',
  },
  coverBorder: {
    position:  'absolute',
    top:       10,
    left:      10,
    right:     10,
    bottom:    10,
    borderWidth:  1,
    borderColor:  'rgba(255,215,100,0.2)',
    borderRadius: radius.lg,
  },
  crest: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: 'rgba(255,215,100,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(255,215,100,0.25)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  crestIcon: {
    fontSize: 36,
    color:    'rgba(255,215,100,0.8)',
  },
  coverTitleBlock: { alignItems: 'center' },
  coverCountry: {
    color:         'rgba(255,215,100,0.5)',
    fontSize:      11,
    fontFamily:    typography.bodySemi,
    letterSpacing: 4,
  },
  coverTitle: {
    color:         'rgba(255,215,100,0.9)',
    fontSize:      28,
    fontFamily:    typography.heading,
    letterSpacing: 6,
    marginTop:     4,
  },
  coverFooter: { alignItems: 'center', gap: 4 },
  coverUsername: {
    color:         colors.textSecondary,
    fontSize:      13,
    fontFamily:    typography.bodySemi,
    letterSpacing: 1,
  },
  coverYear: {
    color:         'rgba(255,215,100,0.5)',
    fontSize:      14,
    fontFamily:    typography.mono,
    letterSpacing: 6,
  },
  foilLine1: {
    position:  'absolute',
    top:       0,
    left:      -20,
    right:     -20,
    height:    1,
    backgroundColor: 'rgba(255,215,100,0.08)',
    transform: [{ rotate: '-15deg' }],
    top:       PASSPORT_H * 0.3,
  },
  foilLine2: {
    position:  'absolute',
    left:      -20,
    right:     -20,
    height:    1,
    backgroundColor: 'rgba(255,215,100,0.05)',
    transform: [{ rotate: '-15deg' }],
    top:       PASSPORT_H * 0.6,
  },
  tapHint: {
    position:  'absolute',
    bottom:    16,
    color:     'rgba(255,255,255,0.15)',
    fontSize:  11,
    fontFamily: typography.body,
    letterSpacing: 1,
  },

  // Pages overlay
  pagesContainer: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          SCREEN_H * 0.78,
    backgroundColor: colors.surface,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    overflow:        'hidden',
  },
  pageHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop:     spacing.md,
    paddingBottom:  spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: { padding: 4 },
  pageHeaderTitle: {
    color:      colors.text,
    fontSize:   16,
    fontFamily: typography.bodySemi,
  },
  shareButton: { padding: 4 },

  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap:           6,
    paddingVertical: spacing.sm,
  },
  pageDot: {
    width:         6,
    height:        6,
    borderRadius:  3,
    backgroundColor: colors.border,
  },
  pageDotActive: {
    backgroundColor: colors.accent,
    width:           16,
  },

  // Single page
  page: {
    width:     PAGE_W,
    flexDirection: 'row',
  },
  pageBinding: {
    width:           12,
    backgroundColor: colors.surfaceRaised,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  pageContent: {
    flex:    1,
    padding: spacing.md,
  },
  pageNumber: {
    color:         colors.textMuted,
    fontSize:      9,
    fontFamily:    typography.mono,
    letterSpacing: 2,
    marginBottom:  spacing.md,
    textAlign:     'right',
  },
  stampGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            spacing.sm,
  },
  emptyStampSlot: {
    width:           160,
    height:          200,
    margin:          8,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    borderStyle:     'dashed',
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyStampIcon: {
    fontSize: 24,
    color:    colors.border,
  },
});
