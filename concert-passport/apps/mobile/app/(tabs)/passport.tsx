import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  FlatList,
  Share,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../src/utils/theme';
import { StampCard } from '../../src/components/StampCard';
import type { Stamp, Passport } from '@concert-passport/shared';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PASSPORT_W = SCREEN_W * 0.72;
const PASSPORT_H = PASSPORT_W * 1.42;
const PAGE_W     = SCREEN_W;
const STAMPS_PER_PAGE = 6;

// Mock data
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
  id: 'p1', user_id: 'u1', theme: 'classic', cover_color: '#000000',
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
  const rotateY      = useSharedValue(0);
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
    opacity:   coverOpacity.value,
    transform: [{ perspective: 1200 }, { rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.passportContainer, coverStyle]}>
      <Pressable onPress={onOpen}>
        {/* Hard-offset shadow */}
        <View style={styles.passportShadow} />

        <View style={styles.passportCover}>
          {/* Inner border */}
          <View style={styles.coverInnerBorder} />

          {/* Music note icon — square block */}
          <View style={styles.crest}>
            <Text style={styles.crestIcon}>♬</Text>
          </View>

          {/* Title block */}
          <View style={styles.coverTitleBlock}>
            <Text style={styles.coverCountry}>CONCERT</Text>
            <Text style={styles.coverTitle}>PASSPORT</Text>
            <View style={styles.coverDivider} />
          </View>

          {/* Barcode strip */}
          <View style={styles.barcodeArea}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.barcodeBar,
                  { width: i % 3 === 0 ? 3 : 1, marginHorizontal: 1 },
                ]}
              />
            ))}
          </View>

          {/* Username + year */}
          <View style={styles.coverFooter}>
            <Text style={styles.coverUsername}>@USERNAME</Text>
            <Text style={styles.coverYear}>2 0 2 5</Text>
          </View>

          {/* Tap hint */}
          <Text style={styles.tapHint}>[ TAP TO OPEN ]</Text>
        </View>
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

  const pages: Stamp[][] = [];
  for (let i = 0; i < stamps.length; i += STAMPS_PER_PAGE) {
    pages.push(stamps.slice(i, i + STAMPS_PER_PAGE));
  }
  if (pages.length === 0 || pages[pages.length - 1].length === STAMPS_PER_PAGE) {
    pages.push([]);
  }

  if (!visible) return null;

  return (
    <Animated.View style={[styles.pagesContainer, animStyle]}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={22} color="#000000" />
        </Pressable>
        <Text style={styles.pageHeaderTitle}>YOUR STAMPS_</Text>
        <Pressable
          style={styles.shareButton}
          onPress={() => Share.share({ message: 'Check out my Concert Passport!' })}
        >
          <Ionicons name="share-outline" size={20} color="#000000" />
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
  const emptySlots = STAMPS_PER_PAGE - stamps.length;

  return (
    <View style={styles.page}>
      {/* Page binding — black bar on left */}
      <View style={styles.pageBinding} />

      <View style={styles.pageContent}>
        <Text style={styles.pageNumber}>PAGE {pageNumber} / {totalPages}</Text>

        <View style={styles.stampGrid}>
          {stamps.map((stamp, i) => (
            <StampCard
              key={stamp.id}
              stamp={stamp}
              size="large"
              animationDelay={i * 80}
            />
          ))}
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

// ─── Stats bar ───────────────────────────────────────────────────────────────────

function PassportStats({ passport }: { passport: Passport }) {
  return (
    <View style={styles.statsRow}>
      <StatItem label="SHOWS"     value={String(passport.total_shows)} />
      <View style={styles.statDivider} />
      <StatItem label="ARTISTS"   value={String(passport.total_artists)} />
      <View style={styles.statDivider} />
      <StatItem label="COUNTRIES" value={String(passport.total_countries)} />
      <View style={styles.statDivider} />
      <StatItem label="STAMPS"    value={String(passport.total_stamps)} />
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.background}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PASSPORT_</Text>
          <Pressable>
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Stats */}
        <PassportStats passport={MOCK_PASSPORT} />

        {/* Year selector */}
        <View style={styles.yearPill}>
          <Ionicons name="chevron-back" size={14} color="#000000" />
          <Text style={styles.yearText}>2025</Text>
          <Ionicons name="chevron-forward" size={14} color="#000000" />
        </View>

        {/* Passport cover */}
        <View style={styles.passportArea}>
          <PassportCover
            passport={MOCK_PASSPORT}
            isOpen={isOpen}
            onOpen={() => setIsOpen(true)}
          />
        </View>

        {/* Pages slide up */}
        <PassportPages
          stamps={MOCK_STAMPS}
          visible={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: '#000000' },
  background: { flex: 1, backgroundColor: colors.background },

  // Header — black bar with green title
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   '#000000',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  headerTitle: {
    color:         colors.accent,
    fontSize:      20,
    fontFamily:    typography.mono,
    letterSpacing: 2,
  },

  // Stats — sharp bordered row
  statsRow: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    marginHorizontal:  spacing.md,
    marginTop:         spacing.md,
    marginBottom:      spacing.sm,
    borderWidth:       2,
    borderColor:       '#000000',
    paddingVertical:   spacing.sm,
    backgroundColor:   '#F0F0F0',
  },
  statDivider: {
    width:           2,
    height:          32,
    backgroundColor: '#000000',
  },
  statItem:  { alignItems: 'center', flex: 1 },
  statValue: {
    color:         colors.text,
    fontSize:      22,
    fontFamily:    typography.mono,
    letterSpacing: 1,
  },
  statLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontFamily:    typography.mono,
    letterSpacing: 2,
    marginTop:     2,
  },

  // Year selector — sharp bordered
  yearPill: {
    flexDirection:     'row',
    alignSelf:         'center',
    alignItems:        'center',
    gap:               spacing.sm,
    borderWidth:       2,
    borderColor:       '#000000',
    paddingVertical:   6,
    paddingHorizontal: 16,
    marginBottom:      spacing.lg,
    backgroundColor:   colors.accent,
  },
  yearText: {
    color:         '#000000',
    fontSize:      13,
    fontFamily:    typography.mono,
    letterSpacing: 4,
  },

  passportArea: {
    alignItems:     'center',
    justifyContent: 'center',
    flex:           1,
  },

  // Passport cover — flat black, lime green accents
  passportContainer: {
    position: 'relative',
  },
  passportShadow: {
    position:        'absolute',
    top:             8,
    left:            8,
    width:           PASSPORT_W,
    height:          PASSPORT_H,
    backgroundColor: colors.accent,
    zIndex:          0,
  },
  passportCover: {
    width:           PASSPORT_W,
    height:          PASSPORT_H,
    backgroundColor: '#000000',
    borderWidth:     2,
    borderColor:     colors.accent,
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical:   28,
    paddingHorizontal: 20,
    overflow:        'hidden',
    zIndex:          1,
  },
  coverInnerBorder: {
    position:    'absolute',
    top:         8,
    left:        8,
    right:       8,
    bottom:      8,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  crest: {
    width:           72,
    height:          72,
    borderWidth:     2,
    borderColor:     colors.accent,
    backgroundColor: '#000000',
    alignItems:      'center',
    justifyContent:  'center',
  },
  crestIcon: {
    fontSize:   32,
    color:      colors.accent,
    fontFamily: typography.mono,
  },
  coverTitleBlock: { alignItems: 'center' },
  coverCountry: {
    color:         colors.accent + '88',
    fontSize:      10,
    fontFamily:    typography.mono,
    letterSpacing: 6,
  },
  coverTitle: {
    color:         '#FFFFFF',
    fontSize:      26,
    fontFamily:    typography.mono,
    letterSpacing: 8,
    marginTop:     4,
  },
  coverDivider: {
    marginTop:       8,
    width:           80,
    height:          2,
    backgroundColor: colors.accent,
  },

  // Barcode decoration
  barcodeArea: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    height:         32,
  },
  barcodeBar: {
    height:          '100%',
    backgroundColor: colors.accent,
  },

  coverFooter: { alignItems: 'center', gap: 4 },
  coverUsername: {
    color:         'rgba(255,255,255,0.7)',
    fontSize:      11,
    fontFamily:    typography.mono,
    letterSpacing: 2,
  },
  coverYear: {
    color:         colors.accent,
    fontSize:      12,
    fontFamily:    typography.mono,
    letterSpacing: 8,
  },
  tapHint: {
    position:      'absolute',
    bottom:        12,
    color:         colors.accent + '55',
    fontSize:      9,
    fontFamily:    typography.mono,
    letterSpacing: 2,
  },

  // Pages overlay — white with black border
  pagesContainer: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          SCREEN_H * 0.78,
    backgroundColor: colors.background,
    borderTopWidth:  2,
    borderTopColor:  '#000000',
    overflow:        'hidden',
  },
  pageHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.accent,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  closeButton:     { padding: 4 },
  pageHeaderTitle: {
    color:         '#000000',
    fontSize:      14,
    fontFamily:    typography.mono,
    letterSpacing: 2,
  },
  shareButton: { padding: 4 },

  pageIndicator: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            4,
    paddingVertical: spacing.sm,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  pageDot: {
    width:           8,
    height:          8,
    backgroundColor: '#CCCCCC',
    borderWidth:     1,
    borderColor:     '#000000',
  },
  pageDotActive: {
    backgroundColor: colors.accent,
    width:           20,
  },

  // Single page
  page: {
    width:         PAGE_W,
    flexDirection: 'row',
  },
  pageBinding: {
    width:            14,
    backgroundColor:  '#000000',
  },
  pageContent: {
    flex:    1,
    padding: spacing.md,
  },
  pageNumber: {
    color:         colors.textMuted,
    fontSize:      8,
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
    width:        160,
    height:       200,
    margin:       8,
    borderWidth:  2,
    borderColor:  '#000000',
    borderStyle:  'dashed',
    alignItems:   'center',
    justifyContent: 'center',
  },
  emptyStampIcon: {
    fontSize:   24,
    color:      '#CCCCCC',
    fontFamily: typography.mono,
  },
});
