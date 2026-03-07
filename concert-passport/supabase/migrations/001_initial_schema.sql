-- =============================================================
-- Concert Passport — Initial Schema
-- =============================================================
-- Supabase / PostgreSQL
-- Run via: supabase db push
-- =============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fuzzy search for artists/venues

-- =============================================================
-- ENUMS
-- =============================================================

create type stamp_rarity as enum ('common', 'uncommon', 'rare', 'legendary');
-- legendary = iconic shows (farewell tours, record-breaking nights, etc.)

create type follow_status as enum ('pending', 'accepted');

create type notification_type as enum (
  'new_follower',
  'show_like',
  'review_comment',
  'same_show',        -- someone else logged the same show you attended
  'rare_stamp',       -- you earned a rare/legendary stamp
  'friend_attended',  -- a friend logged a show you might like
  'wrapped_ready'     -- annual wrapped is ready
);

-- =============================================================
-- PROFILES
-- Extended from Supabase auth.users
-- =============================================================

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  display_name    text,
  avatar_url      text,
  bio             text,
  location        text,                        -- e.g. "London, UK"
  spotify_id      text unique,                 -- linked Spotify account
  passport_theme  text default 'classic',      -- visual theme for passport page
  is_private      boolean default false,       -- private account toggle
  show_count      int default 0,               -- denormalised for performance
  follower_count  int default 0,
  following_count int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- =============================================================
-- ARTISTS
-- Cached from Spotify / MusicBrainz — not user-created
-- =============================================================

create table artists (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text unique not null,       -- url-safe: "taylor-swift"
  spotify_id        text unique,
  musicbrainz_id    text unique,
  image_url         text,
  genres            text[],
  country           text,
  formed_year       int,
  stamp_color       text,                       -- brand hex for stamp generation
  stamp_icon_url    text,                       -- artist-specific stamp icon
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index artists_name_trgm_idx on artists using gin (name gin_trgm_ops);

-- =============================================================
-- VENUES
-- =============================================================

create table venues (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique not null,
  city            text not null,
  country         text not null,
  country_code    char(2) not null,            -- ISO 3166-1 alpha-2
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  capacity        int,
  image_url       text,
  setlistfm_id    text unique,
  created_at      timestamptz default now()
);

create index venues_city_idx on venues (city);
create index venues_country_idx on venues (country_code);

-- =============================================================
-- TOURS
-- A tour groups multiple shows under one named campaign
-- =============================================================

create table tours (
  id              uuid primary key default uuid_generate_v4(),
  artist_id       uuid not null references artists(id) on delete cascade,
  name            text not null,               -- "The Eras Tour"
  slug            text not null,
  start_date      date,
  end_date        date,
  stamp_url       text,                        -- tour-specific stamp design
  rarity          stamp_rarity default 'common',
  setlistfm_id    text unique,
  created_at      timestamptz default now(),

  unique (artist_id, slug)
);

-- =============================================================
-- SHOWS
-- A single performance — the core entity
-- =============================================================

create table shows (
  id              uuid primary key default uuid_generate_v4(),
  artist_id       uuid not null references artists(id) on delete restrict,
  venue_id        uuid not null references venues(id) on delete restrict,
  tour_id         uuid references tours(id) on delete set null,
  show_date       date not null,
  show_time       time,
  is_festival     boolean default false,
  festival_name   text,                        -- populated if is_festival = true
  setlist         jsonb,                       -- raw setlist from setlist.fm
  setlistfm_id    text unique,
  attendance      int,                         -- known attendance figure
  log_count       int default 0,              -- denormalised: how many users logged this
  avg_rating      numeric(3,2),               -- denormalised average rating
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index shows_artist_idx  on shows (artist_id);
create index shows_venue_idx   on shows (venue_id);
create index shows_date_idx    on shows (show_date desc);
create index shows_tour_idx    on shows (tour_id);

-- =============================================================
-- USER SHOW LOGS
-- The core user action — logging a show they attended
-- =============================================================

create table show_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  show_id         uuid not null references shows(id) on delete cascade,
  rating          numeric(2,1) check (rating >= 1 and rating <= 5),  -- 1.0–5.0, half-stars
  review          text,
  review_excerpt  text generated always as (left(review, 280)) stored,  -- tweet-length preview
  attended_date   date,                        -- may differ from show_date (festivals etc.)
  section         text,                        -- "Pit", "Floor A", "Block 112"
  first_time      boolean default false,       -- first time seeing this artist live
  tags            text[],                      -- ["front-row", "emotional", "perfect-setlist"]
  songs_heard_first_live text[],               -- song names heard live for the first time
  is_public       boolean default true,
  like_count      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique (user_id, show_id)                   -- one log per show per user
);

create index show_logs_user_idx    on show_logs (user_id);
create index show_logs_show_idx    on show_logs (show_id);
create index show_logs_rating_idx  on show_logs (rating desc);
create index show_logs_created_idx on show_logs (created_at desc);

-- =============================================================
-- STAMPS
-- The collectible passport stamps
-- =============================================================

create table stamps (
  id              uuid primary key default uuid_generate_v4(),
  show_log_id     uuid not null unique references show_logs(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  artist_id       uuid not null references artists(id) on delete cascade,
  tour_id         uuid references tours(id) on delete set null,
  show_id         uuid not null references shows(id) on delete cascade,
  stamp_url       text not null,               -- generated stamp image URL
  rarity          stamp_rarity default 'common',
  is_limited      boolean default false,       -- e.g. Glastonbury closer, final tour date
  label_line_1    text,                        -- artist name
  label_line_2    text,                        -- venue + city
  label_line_3    text,                        -- date
  issued_at       timestamptz default now()
);

create index stamps_user_idx   on stamps (user_id);
create index stamps_artist_idx on stamps (artist_id);

-- =============================================================
-- PASSPORT
-- One passport per user — the visual stamp book
-- =============================================================

create table passports (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null unique references profiles(id) on delete cascade,
  theme           text default 'classic',      -- "classic", "neon", "vintage", "minimal"
  cover_color     text default '#1a1a2e',
  total_stamps    int default 0,
  total_shows     int default 0,
  total_artists   int default 0,
  total_countries int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- =============================================================
-- SOCIAL — FOLLOWS
-- =============================================================

create table follows (
  follower_id   uuid not null references profiles(id) on delete cascade,
  following_id  uuid not null references profiles(id) on delete cascade,
  status        follow_status default 'accepted',  -- 'pending' for private accounts
  created_at    timestamptz default now(),

  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

create index follows_following_idx on follows (following_id);

-- =============================================================
-- SOCIAL — LIKES (on show logs)
-- =============================================================

create table show_log_likes (
  user_id     uuid not null references profiles(id) on delete cascade,
  log_id      uuid not null references show_logs(id) on delete cascade,
  created_at  timestamptz default now(),

  primary key (user_id, log_id)
);

-- =============================================================
-- SOCIAL — COMMENTS (on show logs)
-- =============================================================

create table comments (
  id          uuid primary key default uuid_generate_v4(),
  log_id      uuid not null references show_logs(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null,
  like_count  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index comments_log_idx on comments (log_id, created_at);

-- =============================================================
-- ARTIST FOLLOWS (separate from user follows)
-- =============================================================

create table artist_follows (
  user_id     uuid not null references profiles(id) on delete cascade,
  artist_id   uuid not null references artists(id) on delete cascade,
  created_at  timestamptz default now(),

  primary key (user_id, artist_id)
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,  -- recipient
  actor_id    uuid references profiles(id) on delete set null,          -- who triggered it
  type        notification_type not null,
  entity_id   uuid,                            -- show_log_id, comment_id, etc.
  is_read     boolean default false,
  created_at  timestamptz default now()
);

create index notifications_user_idx on notifications (user_id, is_read, created_at desc);

-- =============================================================
-- WRAPPED / YEAR IN REVIEW
-- Cached annual stats per user
-- =============================================================

create table user_wrapped (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references profiles(id) on delete cascade,
  year                  int not null,
  total_shows           int default 0,
  total_artists         int default 0,
  total_venues          int default 0,
  total_cities          int default 0,
  total_countries       int default 0,
  top_artist_id         uuid references artists(id),
  top_venue_id          uuid references venues(id),
  avg_rating            numeric(3,2),
  highest_rated_log_id  uuid references show_logs(id),
  first_show_log_id     uuid references show_logs(id),
  total_stamps          int default 0,
  legendary_stamps      int default 0,
  share_image_url       text,                  -- generated Wrapped card image
  generated_at          timestamptz default now(),

  unique (user_id, year)
);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

alter table profiles          enable row level security;
alter table show_logs         enable row level security;
alter table stamps            enable row level security;
alter table passports         enable row level security;
alter table follows           enable row level security;
alter table show_log_likes    enable row level security;
alter table comments          enable row level security;
alter table artist_follows    enable row level security;
alter table notifications     enable row level security;
alter table user_wrapped      enable row level security;

-- Profiles: public read, own write
create policy "Profiles are publicly readable"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Show logs: public if is_public, own write
create policy "Public logs are readable by all"
  on show_logs for select
  using (is_public = true or auth.uid() = user_id);

create policy "Users can manage their own logs"
  on show_logs for all using (auth.uid() = user_id);

-- Stamps: follow visibility
create policy "Stamps visible with log"
  on stamps for select
  using (
    exists (
      select 1 from show_logs sl
      where sl.id = stamps.show_log_id
      and (sl.is_public = true or sl.user_id = auth.uid())
    )
  );

create policy "Stamps created by system for own user"
  on stamps for insert with check (auth.uid() = user_id);

-- Notifications: own only
create policy "Users see own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on notifications for update using (auth.uid() = user_id);

-- Follows: readable, own write
create policy "Follows are publicly readable"
  on follows for select using (true);

create policy "Users manage their own follows"
  on follows for all using (auth.uid() = follower_id);

-- Comments: public read, own write
create policy "Comments are publicly readable"
  on comments for select using (true);

create policy "Users manage their own comments"
  on comments for all using (auth.uid() = user_id);

-- =============================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================

-- Auto-update updated_at timestamp
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger show_logs_updated_at
  before update on show_logs
  for each row execute function set_updated_at();

create trigger shows_updated_at
  before update on shows
  for each row execute function set_updated_at();

-- Increment/decrement show_count on profile when log is added/removed
create or replace function update_profile_show_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set show_count = show_count + 1 where id = new.user_id;
  elsif TG_OP = 'DELETE' then
    update profiles set show_count = show_count - 1 where id = old.user_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger show_log_count_trigger
  after insert or delete on show_logs
  for each row execute function update_profile_show_count();

-- Keep shows.log_count and shows.avg_rating in sync
create or replace function update_show_stats()
returns trigger as $$
begin
  update shows
  set
    log_count  = (select count(*) from show_logs where show_id = coalesce(new.show_id, old.show_id)),
    avg_rating = (select avg(rating) from show_logs where show_id = coalesce(new.show_id, old.show_id) and rating is not null)
  where id = coalesce(new.show_id, old.show_id);
  return null;
end;
$$ language plpgsql;

create trigger show_stats_trigger
  after insert or update or delete on show_logs
  for each row execute function update_show_stats();

-- Keep like_count on show_logs in sync
create or replace function update_log_like_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update show_logs set like_count = like_count + 1 where id = new.log_id;
  elsif TG_OP = 'DELETE' then
    update show_logs set like_count = like_count - 1 where id = old.log_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger like_count_trigger
  after insert or delete on show_log_likes
  for each row execute function update_log_like_count();

-- Keep follower/following counts in sync
create or replace function update_follow_counts()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    update profiles set follower_count  = follower_count  + 1 where id = new.following_id;
  elsif TG_OP = 'DELETE' then
    update profiles set following_count = following_count - 1 where id = old.follower_id;
    update profiles set follower_count  = follower_count  - 1 where id = old.following_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger follow_counts_trigger
  after insert or delete on follows
  for each row execute function update_follow_counts();

-- Auto-create passport when profile is created
create or replace function create_passport_for_profile()
returns trigger as $$
begin
  insert into passports (user_id) values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger profile_passport_trigger
  after insert on profiles
  for each row execute function create_passport_for_profile();
