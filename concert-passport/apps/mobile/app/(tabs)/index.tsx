import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { colors, spacing, radius, typography, shadows } from '../../src/utils/theme';
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

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={styles.card}
    >
      {/* Card header — user info */}
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {log.user.display_name.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.displayName}>{log.user.display_name}</Text>
          <Text style={styles.username}>@{log.user.username}</Text>
        </View>
        <Text style={styles.cardDate}>{timeAgo(log.created_at)}</Text>
      </View>

      {/* Show info pill */}
      <View style={styles.showPill}>
        <View style={{ flex: 1 }}>
          <Text style={styles.artistName}>{log.show.artist.name}</Text>
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
          <Text style={styles.tourBadgeText}>{log.show.tour.name}</Text>
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
              <Text style={styles.tagText}>{tag.replace(/-/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* First time badge */}
      {log.first_time && (
        <View style={styles.firstTimeBadge}>
          <Ionicons name="star" size={10} color={colors.legendary} />
          <Text style={styles.firstTimeText}>First time seeing them live</Text>
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
          <Text style={styles.actionCount}>Reply</Text>
        </Pressable>

        <Pressable style={styles.actionBtn}>
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎸</Text>
      <Text style={styles.emptyTitle}>Your feed is quiet</Text>
      <Text style={styles.emptyBody}>
        Follow people and log your first show to get started.
      </Text>
      <Pressable
        style={styles.emptyButton}
        onPress={() => router.push('/(tabs)/log')}
      >
        <LinearGradient
          colors={[colors.accent, colors.accentDark]}
          style={styles.emptyButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.emptyButtonText}>Log your first show</Text>
        </LinearGradient>
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
        <Text style={styles.headerLogo}>♬ Passport</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.logButton}
            onPress={() => router.push('/(tabs)/log')}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              style={styles.logButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add" size={16} color={colors.text} />
              <Text style={styles.logButtonText}>Log</Text>
            </LinearGradient>
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

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLogo: {
    color:         colors.text,
    fontSize:      22,
    fontFamily:    typography.heading,
    letterSpacing: 0.5,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon:  { padding: 4 },
  logButton:   { borderRadius: radius.full, overflow: 'hidden' },
  logButtonGradient: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   7,
  },
  logButtonText: { color: colors.text, fontSize: 13, fontFamily: typography.bodySemi },

  listContent: { paddingBottom: 80 },
  separator:   { height: 1, backgroundColor: colors.border },

  // Card
  card: {
    backgroundColor:   colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },

  // Card header
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.accent + '33',
    borderWidth:     1,
    borderColor:     colors.accent + '55',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText:  { color: colors.accentDark, fontSize: 14, fontFamily: typography.bodySemi },
  displayName: { color: colors.text,         fontSize: 14, fontFamily: typography.bodySemi },
  username:    { color: colors.textMuted,    fontSize: 12, fontFamily: typography.body },
  cardDate:    { color: colors.textMuted,    fontSize: 11, fontFamily: typography.mono },

  // Show pill
  showPill: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  artistName: { color: colors.text,          fontSize: 15, fontFamily: typography.bodySemi },
  showMeta:   { color: colors.textSecondary, fontSize: 12, fontFamily: typography.body,    marginTop: 2 },
  showDate:   { color: colors.textMuted,     fontSize: 11, fontFamily: typography.mono,    marginTop: 2 },
  stampThumb: { marginLeft: spacing.sm },

  // Tour badge
  tourBadge: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.accent + '22',
    borderWidth:       1,
    borderColor:       colors.accent + '66',
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  tourBadgeText: { color: colors.accentDark, fontSize: 11, fontFamily: typography.body },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono },

  // Review
  reviewText: {
    color:      colors.textSecondary,
    fontSize:   14,
    fontFamily: typography.body,
    lineHeight: 22,
  },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor:   colors.surfaceRaised,
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  tagText: { color: colors.textMuted, fontSize: 11, fontFamily: typography.body },

  // First time
  firstTimeBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
    backgroundColor:   colors.legendary + '18',
    borderWidth:       1,
    borderColor:       colors.legendary + '44',
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  firstTimeText: { color: colors.legendary, fontSize: 11, fontFamily: typography.body },

  // Actions
  actionBar: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.lg,
    paddingTop:    spacing.xs,
  },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: colors.textMuted, fontSize: 13, fontFamily: typography.body },

  // Empty state
  emptyState:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyEmoji:          { fontSize: 52, marginBottom: spacing.md },
  emptyTitle:          { color: colors.text,          fontSize: 20, fontFamily: typography.heading, marginBottom: spacing.sm },
  emptyBody:           { color: colors.textSecondary, fontSize: 14, fontFamily: typography.body,    textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  emptyButton:         { borderRadius: radius.lg, overflow: 'hidden' },
  emptyButtonGradient: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  emptyButtonText:     { color: colors.text, fontSize: 15, fontFamily: typography.bodySemi },
});
