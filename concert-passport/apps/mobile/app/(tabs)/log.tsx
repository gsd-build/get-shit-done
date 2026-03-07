import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  FadeInDown,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { colors, spacing, radius, typography, shadows } from '../../src/utils/theme';
import { StarRating } from '../../src/components/StarRating';
import { SHOW_TAGS, type ShowTag } from '@concert-passport/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  id:       string;
  artist:   string;
  venue:    string;
  city:     string;
  date:     string;
  tourName: string | null;
}

// Mock search results — replaced by Setlist.fm + Spotify API
const MOCK_RESULTS: SearchResult[] = [
  { id: 's1', artist: 'Taylor Swift',   venue: 'Wembley Stadium',    city: 'London',   date: '21 Jun 2024', tourName: 'The Eras Tour' },
  { id: 's2', artist: 'Arctic Monkeys', venue: 'O2 Arena',           city: 'London',   date: '4 Nov 2023',  tourName: 'The Car Tour' },
  { id: 's3', artist: 'Beyoncé',        venue: 'Glastonbury',        city: 'Pilton',   date: '25 Jun 2023', tourName: 'Renaissance World Tour' },
  { id: 's4', artist: 'Radiohead',      venue: 'Alexandra Palace',   city: 'London',   date: '12 Mar 2023', tourName: null },
];

// ─── Search Row ──────────────────────────────────────────────────────────────

function SearchResultRow({
  result,
  onSelect,
}: {
  result:   SearchResult;
  onSelect: (r: SearchResult) => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    Haptics.selectionAsync();
    scale.value = withSequence(withSpring(0.97), withSpring(1));
    onSelect(result);
  }

  return (
    <Animated.View style={style}>
      <Pressable style={styles.searchRow} onPress={handlePress}>
        <View style={styles.searchRowIcon}>
          <Text style={{ fontSize: 18 }}>🎵</Text>
        </View>
        <View style={styles.searchRowBody}>
          <Text style={styles.searchRowArtist}>{result.artist}</Text>
          <Text style={styles.searchRowDetails}>
            {result.venue} · {result.city}
          </Text>
          <Text style={styles.searchRowDate}>{result.date}</Text>
          {result.tourName && (
            <Text style={styles.searchRowTour}>{result.tourName}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Selected show pill ──────────────────────────────────────────────────────

function SelectedShowPill({
  show,
  onClear,
}: {
  show:    SearchResult;
  onClear: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.selectedPill}>
      <LinearGradient
        colors={['#1c1c38', '#141428']}
        style={styles.selectedPillInner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.selectedArtist}>{show.artist}</Text>
          <Text style={styles.selectedDetails}>
            {show.venue} · {show.city}
          </Text>
          <Text style={styles.selectedDate}>{show.date}</Text>
          {show.tourName && (
            <View style={styles.tourBadge}>
              <Text style={styles.tourBadgeText}>{show.tourName}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={onClear} style={styles.pillClear}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Tag pill ────────────────────────────────────────────────────────────────

function TagPill({
  tag,
  selected,
  onToggle,
}: {
  tag:      string;
  selected: boolean;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    Haptics.selectionAsync();
    scale.value = withSequence(withSpring(0.9), withSpring(1));
    onToggle();
  }

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={handlePress}
        style={[styles.tagPill, selected && styles.tagPillSelected]}
      >
        {selected && (
          <Ionicons name="checkmark" size={11} color={colors.accent} style={{ marginRight: 3 }} />
        )}
        <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
          {tag.replace(/-/g, ' ')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Stamp reveal animation ──────────────────────────────────────────────────

function StampReveal({ onDone }: { onDone: () => void }) {
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate  = useSharedValue(-15);

  useEffect(() => {
    opacity.value = withTiming(1,   { duration: 200 });
    scale.value   = withSpring(1,   { damping: 10, stiffness: 100 });
    rotate.value  = withSpring(0,   { damping: 12 });
    // Auto-dismiss
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <View style={styles.stampRevealOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} />
      <Animated.View style={[styles.stampRevealCard, style]}>
        <Text style={styles.stampRevealEmoji}>🎫</Text>
        <Text style={styles.stampRevealTitle}>Stamp Earned!</Text>
        <Text style={styles.stampRevealSub}>Added to your passport</Text>
      </Animated.View>
    </View>
  );
}

import { useEffect } from 'react';

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LogShowScreen() {
  const [query,         setQuery]         = useState('');
  const [results,       setResults]       = useState<SearchResult[]>([]);
  const [selectedShow,  setSelectedShow]  = useState<SearchResult | null>(null);
  const [rating,        setRating]        = useState(0);
  const [review,        setReview]        = useState('');
  const [selectedTags,  setSelectedTags]  = useState<Set<string>>(new Set());
  const [firstTime,     setFirstTime]     = useState(false);
  const [isPublic,      setIsPublic]      = useState(true);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [showStampReveal, setShowStampReveal] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  // Live search
  useEffect(() => {
    if (!query.trim() || selectedShow) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    setResults(MOCK_RESULTS.filter(r =>
      r.artist.toLowerCase().includes(q) || r.venue.toLowerCase().includes(q)
    ));
  }, [query, selectedShow]);

  function selectShow(r: SearchResult) {
    setSelectedShow(r);
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function handleSubmit() {
    if (!selectedShow) return;
    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // TODO: call createShowLog() from services/shows.ts
    await new Promise(r => setTimeout(r, 1000)); // mock delay

    setIsSubmitting(false);
    setShowStampReveal(true);
  }

  const canSubmit = selectedShow !== null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Log a Show</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Show search ──────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Text style={styles.sectionLabel}>SHOW</Text>

            {selectedShow ? (
              <SelectedShowPill show={selectedShow} onClear={() => setSelectedShow(null)} />
            ) : (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search artist or venue…"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Search results dropdown */}
            {results.length > 0 && (
              <Animated.View entering={FadeInDown.springify()} style={styles.resultsContainer}>
                {results.map(r => (
                  <SearchResultRow key={r.id} result={r} onSelect={selectShow} />
                ))}
              </Animated.View>
            )}
          </Animated.View>

          {/* ── Rating ───────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(60).springify()}
            style={[styles.section, !selectedShow && styles.sectionDimmed]}
          >
            <Text style={styles.sectionLabel}>RATING</Text>
            <View style={styles.ratingRow}>
              <StarRating
                value={rating}
                onChange={selectedShow ? setRating : undefined}
                readonly={!selectedShow}
                size={36}
              />
              {rating > 0 && (
                <Animated.Text entering={FadeIn} style={styles.ratingLabel}>
                  {getRatingLabel(rating)}
                </Animated.Text>
              )}
            </View>
          </Animated.View>

          {/* ── Review ───────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(120).springify()}
            style={[styles.section, !selectedShow && styles.sectionDimmed]}
          >
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>YOUR THOUGHTS</Text>
              <Text style={styles.charCount}>{review.length}/500</Text>
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="What made this show unforgettable?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              value={review}
              onChangeText={setReview}
              editable={!!selectedShow}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* ── Tags ─────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(180).springify()}
            style={[styles.section, !selectedShow && styles.sectionDimmed]}
          >
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsWrap}>
              {SHOW_TAGS.map(tag => (
                <TagPill
                  key={tag}
                  tag={tag}
                  selected={selectedTags.has(tag)}
                  onToggle={() => selectedShow && toggleTag(tag)}
                />
              ))}
            </View>
          </Animated.View>

          {/* ── Toggles ──────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(240).springify()}
            style={[styles.section, !selectedShow && styles.sectionDimmed]}
          >
            <ToggleRow
              label="First time seeing them"
              sublabel="Get a special stamp badge"
              value={firstTime}
              onToggle={() => selectedShow && setFirstTime(v => !v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              label="Public log"
              sublabel="Visible to your followers"
              value={isPublic}
              onToggle={() => selectedShow && setIsPublic(v => !v)}
            />
          </Animated.View>

          {/* ── Submit ───────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.submitSection}>
            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              <LinearGradient
                colors={canSubmit ? ['#7c5cfc', '#5a3de8'] : [colors.surface, colors.surface]}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
                      Stamp It
                    </Text>
                    <Text style={styles.submitIcon}>🔖</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Stamp reveal overlay */}
      {showStampReveal && (
        <StampReveal onDone={() => {
          setShowStampReveal(false);
          router.replace('/(tabs)/passport');
        }} />
      )}
    </SafeAreaView>
  );
}

// ─── Toggle row ──────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  sublabel,
  value,
  onToggle,
}: {
  label:    string;
  sublabel: string;
  value:    boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSublabel}>{sublabel}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRatingLabel(rating: number): string {
  if (rating >= 5)   return 'Perfect';
  if (rating >= 4.5) return 'Extraordinary';
  if (rating >= 4)   return 'Loved it';
  if (rating >= 3.5) return 'Really good';
  if (rating >= 3)   return 'Good show';
  if (rating >= 2)   return 'It was alright';
  return 'Disappointing';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: colors.background },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color:      colors.text,
    fontSize:   18,
    fontFamily: typography.bodySemi,
  },

  // Section
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionDimmed: { opacity: 0.4 },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontFamily:    typography.bodySemi,
    letterSpacing: 1.5,
    marginBottom:  spacing.sm,
  },
  sectionRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },

  // Search
  searchContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: colors.surface,
    borderRadius:   radius.md,
    borderWidth:    1,
    borderColor:    colors.border,
    paddingHorizontal: spacing.md,
    height:         50,
  },
  searchIcon:  { marginRight: spacing.sm },
  searchInput: {
    flex:       1,
    color:      colors.text,
    fontSize:   15,
    fontFamily: typography.body,
  },
  resultsContainer: {
    backgroundColor: colors.surfaceRaised,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    marginTop:       spacing.sm,
    overflow:        'hidden',
  },
  searchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:            spacing.md,
  },
  searchRowIcon: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  searchRowBody:    { flex: 1 },
  searchRowArtist:  { color: colors.text,          fontSize: 14, fontFamily: typography.bodySemi },
  searchRowDetails: { color: colors.textSecondary, fontSize: 12, fontFamily: typography.body,    marginTop: 1 },
  searchRowDate:    { color: colors.textMuted,      fontSize: 11, fontFamily: typography.mono,    marginTop: 1 },
  searchRowTour:    { color: colors.accent,         fontSize: 10, fontFamily: typography.body,    marginTop: 3 },

  // Selected show pill
  selectedPill: { borderRadius: radius.md, overflow: 'hidden' },
  selectedPillInner: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    padding:        spacing.md,
    borderRadius:   radius.md,
    borderWidth:    1,
    borderColor:    colors.accent + '44',
  },
  selectedArtist:  { color: colors.text,          fontSize: 16, fontFamily: typography.bodySemi },
  selectedDetails: { color: colors.textSecondary, fontSize: 13, fontFamily: typography.body,    marginTop: 2 },
  selectedDate:    { color: colors.textMuted,      fontSize: 12, fontFamily: typography.mono,    marginTop: 2 },
  tourBadge: {
    alignSelf:         'flex-start',
    marginTop:         6,
    backgroundColor:   colors.accent + '22',
    borderWidth:       1,
    borderColor:       colors.accent + '55',
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tourBadgeText: { color: colors.accentLight, fontSize: 11, fontFamily: typography.body },
  pillClear:     { padding: 4, marginLeft: spacing.sm },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  ratingLabel: {
    color:      colors.textSecondary,
    fontSize:   14,
    fontFamily: typography.body,
  },
  charCount: { color: colors.textMuted, fontSize: 11, fontFamily: typography.mono },

  // Review
  reviewInput: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    padding:           spacing.md,
    color:             colors.text,
    fontSize:          15,
    fontFamily:        typography.body,
    minHeight:         100,
    lineHeight:        22,
  },

  // Tags
  tagsWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  tagPill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  tagPillSelected: {
    borderColor:     colors.accent,
    backgroundColor: colors.accentGlow,
  },
  tagText:         { color: colors.textSecondary, fontSize: 12, fontFamily: typography.body },
  tagTextSelected: { color: colors.accentLight },

  // Toggles
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel:    { color: colors.text,          fontSize: 14, fontFamily: typography.bodyMed },
  toggleSublabel: { color: colors.textMuted,     fontSize: 12, fontFamily: typography.body,    marginTop: 2 },
  toggle: {
    width:           46,
    height:          26,
    borderRadius:    13,
    backgroundColor: colors.border,
    padding:         3,
    justifyContent:  'center',
  },
  toggleOn:      { backgroundColor: colors.accent },
  toggleThumb: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: colors.textMuted,
  },
  toggleThumbOn: {
    backgroundColor: colors.text,
    alignSelf:       'flex-end',
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginVertical:  spacing.sm,
  },

  // Submit
  submitSection:        { padding: spacing.md, paddingTop: spacing.lg },
  submitButton:         { borderRadius: radius.lg, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.5 },
  submitGradient: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    gap:            spacing.sm,
  },
  submitText:         { color: colors.text, fontSize: 18, fontFamily: typography.bodySemi },
  submitTextDisabled: { color: colors.textMuted },
  submitIcon:         { fontSize: 20 },

  // Stamp reveal
  stampRevealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          100,
  },
  stampRevealCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius:    radius.xl,
    padding:         spacing.xl,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.accent + '55',
    ...shadows.stamp,
  },
  stampRevealEmoji: { fontSize: 64, marginBottom: spacing.md },
  stampRevealTitle: { color: colors.text,          fontSize: 24, fontFamily: typography.heading,  marginBottom: spacing.sm },
  stampRevealSub:   { color: colors.textSecondary, fontSize: 14, fontFamily: typography.body },
});
