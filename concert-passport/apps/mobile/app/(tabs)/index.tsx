import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '../../src/utils/theme';
import { StarRating } from '../../src/components/StarRating';
import { StampCard } from '../../src/components/StampCard';
import type { ShowLog, Stamp } from '@concert-passport/shared';

// ─── Mock feed data ──────────────────────────────────────────────────────────

const MOCK_FEED: (ShowLog & {
  user:  { username: string; display_name: string; avatar_url: null };
  show:  { artist: { name: string }; venue: { name: string; city: string }; tour: { name: string } | null; show_date: string };
  stamp: Stamp | null;
})[] = [
  {
    id: 'l1', user_id: 'u2', show_id: 's1',
    rating: 5, review: 'I have never cried that many times at a concert in my life. The Eras Tour is genuinely once-in-a-generation. She played The Archer and I lost it completely.',
    review_excerpt: null, attended_date: '2024-06-21', section: 'Pit',
    first_time: false, tags: ['pit', 'life-changing', 'emotional'], songs_heard_first_live: ['The Archer'],
    is_public: true, like_count: 47, created_at: '2024-06-21T23:14:00Z', updated_at: '2024-06-21T23:14:00Z',
    user:  { username: 'sarahm', display_name: 'Sarah M', avatar_url: null },
    show:  { artist: { name: 'Taylor Swift' }, venue: { name: 'Wembley Stadium', city: 'London' }, tour: { name: 'The Eras Tour' }, show_date: '2024-06-21' },
    stamp: { id: 'st1', show_log_id: 'l1', user_id: 'u2', artist_id: 'a1', tour_id: 't1', show_id: 's1',
             stamp_url: '', rarity: 'legendary', is_limited: true,
             label_line_1: 'Taylor Swift', label_line_2: 'Wembley · London', label_line_3: '21 JUN 2024', issued_at: '' },
  },
  {
    id: 'l2', user_id: 'u3', show_id: 's2',
    rating: 4.5, review: 'Alex Turner was in full command. Tight setlist, no nonsense. Do I Wanna Know? into R U Mine? back to back was everything.',
    review_excerpt: null, attended_date: '2023-11-04', section: 'Floor A',
    first_time: false, tags: ['perfect-setlist', 'standing'], songs_heard_first_live: [],
    is_public: true, like_count: 23, created_at: '2023-11-04T22:45:00Z', updated_at: '2023-11-04T22:45:00Z',
    user:  { username: 'jcroft', display_name: 'James C', avatar_url: null },
    show:  { artist: { name: 'Arctic Monkeys' }, venue: { name: 'O2 Arena', city: 'London' }, tour: { name: 'The Car Tour' }, show_date: '2023-11-04' },
    stamp: { id: 'st2', show_log_id: 'l2', user_id: 'u3', artist_id: 'a2', tour_id: 't2', show_id: 's2',
             stamp_url: '', rarity: 'uncommon', is_limited: false,
             label_line_1: 'Arctic Monkeys', label_line_2: 'O2 Arena · London', label_line_3: '04 NOV 2023', issued_at: '' },
  },
  {
    id: 'l3', user_id: 'u4', show_id: 's3',
    rating: 5, review: 'Renaissance at Glastonbury. Historic. She closed the festival and owned every single second. CUFF IT into ALIEN SUPERSTAR — I will never forget it.',
    review_excerpt: null, attended_date: '2023-06-25', section: null,
    first_time: true, tags: ['festival', 'life-changing', 'first-time'], songs_heard_first_live: ['Alien Superstar', 'Cuff It'],
    is_public: true, like_count: 112, created_at: '2023-06-25T23:59:00Z', updated_at: '2023-06-25T23:59:00Z',
    user:  { username: 'priyad', display_name: 'Priya D', avatar_url: null },
    show:  { artist: { name: 'Beyoncé' }, venue: { name: 'Glastonbury', city: 'Pilton' }, tour: { name: 'Renaissance World Tour' }, show_date: '2023-06-25' },
    stamp: { id: 'st3', show_log_id: 'l3', user_id: 'u4', artist_id: 'a3', tour_id: 't3', show_id: 's3',
             stamp_url: '', rarity: 'rare', is_limited: true,
             label_line_1: 'Beyoncé', label_line_2: 'Glastonbury · Pilton', label_line_3: '25 JUN 2023', issued_at: '' },
  },
];

// ─── Ticker banner ────────────────────────────────────────────────────────────

function TickerBanner({ label }: { label: string }) {
  const repeated = Array.from({ length: 8 }, () => label).join('  ·  ');
  return (
    <View style={styles.ticker}>
      <Text style={styles.tickerText} numberOfLines={1}>{repeated}</Text>
    </View>
  );
}

// ─── Feed card ───────────────────────────────────────────────────────────────

function FeedCard({
  log,
  index,
}: {
  log:   typeof MOCK_FEED[number];
  index: number;
}) {
  const [liked, setLiked] = useState(false);
  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  function handleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 8 }),
      withSpring(1,   { damping: 8 })
    );
    setLiked(v => !v);
  }

  const formattedDate = formatDate(log.show.show_date);

  // Rarity → ticker label
  const tickerLabel = log.stamp
    ? (log.stamp.rarity === 'legendary' ? 'LEGENDARY'
    : log.stamp.rarity === 'rare'       ? 'RARE'
    : log.stamp.rarity === 'uncommon'   ? 'UNCOMMON'
    : 'COMMON')
    : 'LOGGED';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={styles.card}
    >
      {/* Rarity ticker */}
      <TickerBanner label={tickerLabel} />

      {/* Card header — user info */}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {log.user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.displayName}>{log.user.display_name.toUpperCase()}</Text>
            <Text style={styles.username}>@{log.user.username}</Text>
          </View>
          <Text style={styles.cardDate}>{timeAgo(log.created_at)}</Text>
        </View>

        {/* Show info block */}
        <View style={styles.showBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.artistName}>{log.show.artist.name.toUpperCase()}</Text>
            <Text style={styles.showMeta}>
              {log.show.venue.name} · {log.show.venue.city}
            </Text>
            <Text style={styles.showDate}>{formattedDate}</Text>
          </View>

          {/* Stamp thumbnail */}
          {log.stamp && (
            <View style={styles.stampThumb}>
              <StampCard stamp={log.stamp} size="small" />
            </View>
          )}
        </View>

        {/* Tour badge */}
        {log.show.tour && (
          <View style={styles.tourBadge}>
            <Text style={styles.tourBadgeText}>{log.show.tour.name.toUpperCase()}</Text>
          </View>
        )}

        {/* Rating */}
        {log.rating && (
          <View style={styles.ratingRow}>
            <StarRating value={log.rating} readonly size={16} />
            <Text style={styles.ratingText}>{log.rating.toFixed(1)}</Text>
          </View>
        )}

        {/* Review */}
        {log.review && (
          <Text style={styles.reviewText} numberOfLines={4}>
            {log.review}
          </Text>
        )}

        {/* Tags */}
        {log.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {log.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag.replace(/-/g, ' ').toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* First time badge */}
        {log.first_time && (
          <View style={styles.firstTimeBadge}>
            <Ionicons name="star" size={10} color="#000000" />
            <Text style={styles.firstTimeText}>FIRST TIME SEEING THEM LIVE</Text>
          </View>
        )}

        {/* Action bar */}
        <View style={styles.actionBar}>
          <Pressable style={styles.actionBtn} onPress={handleLike}>
            <Animated.View style={heartStyle}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={20}
                color={liked ? colors.accent : colors.textMuted}
              />
            </Animated.View>
            <Text style={styles.actionCount}>
              {log.like_count + (liked ? 1 : 0)}
            </Text>
          </Pressable>

          <Pressable style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
            <Text style={styles.actionCount}>REPLY</Text>
          </Pressable>

          <Pressable style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>YOUR FEED IS EMPTY_</Text>
      <Text style={styles.emptyBody}>
        Follow people and log your first show to get started.
      </Text>
      <Pressable
        style={styles.emptyButton}
        onPress={() => router.push('/(tabs)/log')}
      >
        <Text style={styles.emptyButtonText}>+ LOG YOUR FIRST SHOW</Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>PASSPORT_</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={styles.logButton}
            onPress={() => router.push('/(tabs)/log')}
          >
            <Text style={styles.logButtonText}>+ LOG</Text>
          </Pressable>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={MOCK_FEED}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <FeedCard log={item} index={index} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={EmptyFeed}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m`;
  if (hours < 24)  return `${hours}h`;
  if (days  < 7)   return `${days}d`;
  return formatDate(dateStr);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // Header — full black bar
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   '#000000',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  headerLogo: {
    color:         colors.accent,
    fontSize:      20,
    fontFamily:    typography.mono,
    letterSpacing: 2,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon:  { padding: 4 },

  // LOG button — flat lime green, sharp corners
  logButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       2,
    borderColor:       '#000000',
  },
  logButtonText: {
    color:         '#000000',
    fontSize:      12,
    fontFamily:    typography.mono,
    letterSpacing: 1,
  },

  listContent: { paddingBottom: 80 },
  separator:   { height: 2, backgroundColor: '#000000' },

  // Card wrapper — white with black border
  card: {
    backgroundColor: colors.background,
    borderWidth:     2,
    borderColor:     '#000000',
    margin:          spacing.sm,
    overflow:        'hidden',
  },

  // Green ticker strip at top of card
  ticker: {
    backgroundColor: colors.accent,
    paddingVertical: 3,
    overflow:        'hidden',
  },
  tickerText: {
    color:         '#000000',
    fontSize:      9,
    fontFamily:    typography.mono,
    letterSpacing: 2,
    paddingHorizontal: spacing.sm,
  },

  cardInner: {
    padding: spacing.md,
    gap:     spacing.sm,
  },

  // Card header
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width:           36,
    height:          36,
    backgroundColor: '#000000',
    borderWidth:     2,
    borderColor:     '#000000',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText:  { color: colors.accent, fontSize: 14, fontFamily: typography.mono },
  displayName: { color: colors.text,      fontSize: 13, fontFamily: typography.mono, letterSpacing: 1 },
  username:    { color: colors.textMuted, fontSize: 11, fontFamily: typography.body },
  cardDate:    { color: colors.textMuted, fontSize: 10, fontFamily: typography.mono },

  // Show block
  showBlock: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: '#F0F0F0',
    borderWidth:     2,
    borderColor:     '#000000',
    padding:         spacing.sm,
  },
  artistName: { color: colors.text,          fontSize: 14, fontFamily: typography.mono, letterSpacing: 1 },
  showMeta:   { color: colors.textSecondary, fontSize: 11, fontFamily: typography.body, marginTop: 2 },
  showDate:   { color: colors.textMuted,     fontSize: 10, fontFamily: typography.mono, marginTop: 2 },
  stampThumb: { marginLeft: spacing.sm },

  // Tour badge — lime green, black text, sharp
  tourBadge: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.accent,
    borderWidth:       2,
    borderColor:       '#000000',
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tourBadgeText: { color: '#000000', fontSize: 10, fontFamily: typography.mono, letterSpacing: 1 },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { color: colors.textMuted, fontSize: 11, fontFamily: typography.mono },

  // Review
  reviewText: {
    color:      colors.textSecondary,
    fontSize:   13,
    fontFamily: typography.body,
    lineHeight: 20,
  },

  // Tags — sharp outlined pills
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    borderWidth:       1,
    borderColor:       '#000000',
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  tagText: { color: colors.text, fontSize: 9, fontFamily: typography.mono, letterSpacing: 1 },

  // First time — green background badge
  firstTimeBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
    backgroundColor:   colors.accent,
    borderWidth:       2,
    borderColor:       '#000000',
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  firstTimeText: { color: '#000000', fontSize: 9, fontFamily: typography.mono, letterSpacing: 1 },

  // Actions
  actionBar: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.lg,
    paddingTop:    spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    marginTop:     spacing.xs,
  },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyTitle: {
    color:         colors.text,
    fontSize:      22,
    fontFamily:    typography.mono,
    marginBottom:  spacing.sm,
    letterSpacing: 2,
  },
  emptyBody: {
    color:         colors.textSecondary,
    fontSize:      13,
    fontFamily:    typography.body,
    textAlign:     'center',
    lineHeight:    20,
    marginBottom:  spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    borderWidth:     2,
    borderColor:     '#000000',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyButtonText: {
    color:         '#000000',
    fontSize:      13,
    fontFamily:    typography.mono,
    letterSpacing: 1,
  },
});
