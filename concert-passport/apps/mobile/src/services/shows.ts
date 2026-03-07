import { supabase } from './supabase';
import type { Show, ShowLog, PaginatedResponse } from '@concert-passport/shared';

// -------------------------------------------------------------
// Shows
// -------------------------------------------------------------

export async function searchShows(query: string, limit = 20) {
  const { data, error } = await supabase
    .from('shows')
    .select(`
      *,
      artist:artists(*),
      venue:venues(*),
      tour:tours(*)
    `)
    .or(`artists.name.ilike.%${query}%, venues.name.ilike.%${query}%`)
    .order('show_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Show[];
}

export async function getShow(id: string) {
  const { data, error } = await supabase
    .from('shows')
    .select(`
      *,
      artist:artists(*),
      venue:venues(*),
      tour:tours(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Show;
}

export async function getShowsByArtist(artistId: string, page = 1, perPage = 20) {
  const from = (page - 1) * perPage;
  const to   = from + perPage - 1;

  const { data, error, count } = await supabase
    .from('shows')
    .select('*, venue:venues(*), tour:tours(*)', { count: 'exact' })
    .eq('artist_id', artistId)
    .order('show_date', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data:     data as Show[],
    count:    count ?? 0,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > to + 1,
  } satisfies PaginatedResponse<Show>;
}

// -------------------------------------------------------------
// Show Logs
// -------------------------------------------------------------

export async function createShowLog(payload: {
  show_id:               string;
  rating?:               number;
  review?:               string;
  section?:              string;
  first_time?:           boolean;
  tags?:                 string[];
  songs_heard_first_live?: string[];
  attended_date?:        string;
  is_public?:            boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('show_logs')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as ShowLog;
}

export async function updateShowLog(
  logId: string,
  updates: Partial<Pick<ShowLog, 'rating' | 'review' | 'section' | 'tags' | 'is_public'>>
) {
  const { data, error } = await supabase
    .from('show_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();

  if (error) throw error;
  return data as ShowLog;
}

export async function deleteShowLog(logId: string) {
  const { error } = await supabase
    .from('show_logs')
    .delete()
    .eq('id', logId);

  if (error) throw error;
}

export async function getUserLogs(userId: string, page = 1, perPage = 20) {
  const from = (page - 1) * perPage;
  const to   = from + perPage - 1;

  const { data, error, count } = await supabase
    .from('show_logs')
    .select(`
      *,
      show:shows(*, artist:artists(*), venue:venues(*), tour:tours(*)),
      stamp:stamps(*)
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data:     data as ShowLog[],
    count:    count ?? 0,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > to + 1,
  } satisfies PaginatedResponse<ShowLog>;
}

export async function getFeed(page = 1, perPage = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get IDs of users we follow
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted');

  const followingIds = (following ?? []).map(f => f.following_id);
  if (followingIds.length === 0) return { data: [], count: 0, page, per_page: perPage, has_more: false };

  const from = (page - 1) * perPage;
  const to   = from + perPage - 1;

  const { data, error, count } = await supabase
    .from('show_logs')
    .select(`
      *,
      user:profiles(*),
      show:shows(*, artist:artists(*), venue:venues(*)),
      stamp:stamps(*)
    `, { count: 'exact' })
    .in('user_id', followingIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data:     data as ShowLog[],
    count:    count ?? 0,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > to + 1,
  } satisfies PaginatedResponse<ShowLog>;
}

// -------------------------------------------------------------
// Likes
// -------------------------------------------------------------

export async function likeLog(logId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('show_log_likes')
    .insert({ user_id: user.id, log_id: logId });

  if (error) throw error;
}

export async function unlikeLog(logId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('show_log_likes')
    .delete()
    .eq('user_id', user.id)
    .eq('log_id', logId);

  if (error) throw error;
}
