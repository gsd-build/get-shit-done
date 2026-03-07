// =============================================================
// Concert Passport — Shared TypeScript Types
// Generated from database schema — keep in sync
// =============================================================

export type StampRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type FollowStatus = 'pending' | 'accepted';
export type PassportTheme = 'classic' | 'neon' | 'vintage' | 'minimal';
export type NotificationType =
  | 'new_follower'
  | 'show_like'
  | 'review_comment'
  | 'same_show'
  | 'rare_stamp'
  | 'friend_attended'
  | 'wrapped_ready';

// -------------------------------------------------------------
// Profile
// -------------------------------------------------------------
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  spotify_id: string | null;
  passport_theme: PassportTheme;
  is_private: boolean;
  show_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// Artist
// -------------------------------------------------------------
export interface Artist {
  id: string;
  name: string;
  slug: string;
  spotify_id: string | null;
  musicbrainz_id: string | null;
  image_url: string | null;
  genres: string[];
  country: string | null;
  formed_year: number | null;
  stamp_color: string | null;
  stamp_icon_url: string | null;
}

// -------------------------------------------------------------
// Venue
// -------------------------------------------------------------
export interface Venue {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  image_url: string | null;
  setlistfm_id: string | null;
}

// -------------------------------------------------------------
// Tour
// -------------------------------------------------------------
export interface Tour {
  id: string;
  artist_id: string;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  stamp_url: string | null;
  rarity: StampRarity;
  setlistfm_id: string | null;
}

// -------------------------------------------------------------
// Show
// -------------------------------------------------------------
export interface Show {
  id: string;
  artist_id: string;
  venue_id: string;
  tour_id: string | null;
  show_date: string;
  show_time: string | null;
  is_festival: boolean;
  festival_name: string | null;
  setlist: SetlistData | null;
  setlistfm_id: string | null;
  attendance: number | null;
  log_count: number;
  avg_rating: number | null;
  // joined
  artist?: Artist;
  venue?: Venue;
  tour?: Tour | null;
}

export interface SetlistData {
  sets: SetlistSet[];
  info?: string;
}

export interface SetlistSet {
  name?: string;
  encore?: number;
  songs: SetlistSong[];
}

export interface SetlistSong {
  name: string;
  info?: string;
  cover?: { name: string; mbid?: string };
  tape?: boolean;
}

// -------------------------------------------------------------
// ShowLog — a user's concert entry
// -------------------------------------------------------------
export interface ShowLog {
  id: string;
  user_id: string;
  show_id: string;
  rating: number | null;            // 1.0–5.0
  review: string | null;
  review_excerpt: string | null;
  attended_date: string | null;
  section: string | null;
  first_time: boolean;
  tags: string[];
  songs_heard_first_live: string[];
  is_public: boolean;
  like_count: number;
  created_at: string;
  updated_at: string;
  // joined
  show?: Show;
  user?: Profile;
  stamp?: Stamp;
}

// Allowed tag values
export const SHOW_TAGS = [
  'pit',
  'front-row',
  'festival',
  'hometown-show',
  'first-time',
  'life-changing',
  'chaotic',
  'emotional',
  'perfect-setlist',
  'surprise-guest',
  'sold-out',
  'standing',
  'seated',
  'vip',
] as const;

export type ShowTag = typeof SHOW_TAGS[number];

// -------------------------------------------------------------
// Stamp
// -------------------------------------------------------------
export interface Stamp {
  id: string;
  show_log_id: string;
  user_id: string;
  artist_id: string;
  tour_id: string | null;
  show_id: string;
  stamp_url: string;
  rarity: StampRarity;
  is_limited: boolean;
  label_line_1: string | null;   // artist name
  label_line_2: string | null;   // venue + city
  label_line_3: string | null;   // date
  issued_at: string;
  // joined
  artist?: Artist;
}

// -------------------------------------------------------------
// Passport
// -------------------------------------------------------------
export interface Passport {
  id: string;
  user_id: string;
  theme: PassportTheme;
  cover_color: string;
  total_stamps: number;
  total_shows: number;
  total_artists: number;
  total_countries: number;
  // joined
  stamps?: Stamp[];
  profile?: Profile;
}

// -------------------------------------------------------------
// Social
// -------------------------------------------------------------
export interface Follow {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
  // joined
  follower?: Profile;
  following?: Profile;
}

export interface ShowLogLike {
  user_id: string;
  log_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  log_id: string;
  user_id: string;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

// -------------------------------------------------------------
// Notifications
// -------------------------------------------------------------
export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
}

// -------------------------------------------------------------
// Wrapped
// -------------------------------------------------------------
export interface UserWrapped {
  id: string;
  user_id: string;
  year: number;
  total_shows: number;
  total_artists: number;
  total_venues: number;
  total_cities: number;
  total_countries: number;
  top_artist_id: string | null;
  top_venue_id: string | null;
  avg_rating: number | null;
  highest_rated_log_id: string | null;
  first_show_log_id: string | null;
  total_stamps: number;
  legendary_stamps: number;
  share_image_url: string | null;
  generated_at: string;
  // joined
  top_artist?: Artist;
  top_venue?: Venue;
  first_show?: ShowLog;
  highest_rated_show?: ShowLog;
}

// -------------------------------------------------------------
// API Response wrappers
// -------------------------------------------------------------
export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// -------------------------------------------------------------
// Pagination
// -------------------------------------------------------------
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
