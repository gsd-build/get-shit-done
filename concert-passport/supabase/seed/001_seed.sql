-- =============================================================
-- Concert Passport — Seed Data (development only)
-- =============================================================

-- Artists
insert into artists (id, name, slug, spotify_id, genres, country, stamp_color) values
  ('a1000000-0000-0000-0000-000000000001', 'Taylor Swift',       'taylor-swift',       '06HL4z0CvFAxyc27GXpf02', array['pop','country'],      'US', '#9b5de5'),
  ('a1000000-0000-0000-0000-000000000002', 'Arctic Monkeys',     'arctic-monkeys',     '7Ln80lUS6He07XvHI8qqHH', array['indie-rock','rock'],  'GB', '#f15bb5'),
  ('a1000000-0000-0000-0000-000000000003', 'Beyoncé',            'beyonce',            '6vWDO969PvNqNYHIOW5v0m', array['pop','r-n-b'],        'US', '#fee440'),
  ('a1000000-0000-0000-0000-000000000004', 'Radiohead',          'radiohead',          '4Z8W4fkeB5StDoAZafauZy', array['alternative','rock'], 'GB', '#00bbf9'),
  ('a1000000-0000-0000-0000-000000000005', 'Olivia Rodrigo',     'olivia-rodrigo',     '1McMsnEElThX1knmY4oliG', array['pop','alt-pop'],      'US', '#ff6b6b');

-- Venues
insert into venues (id, name, slug, city, country, country_code, capacity) values
  ('b1000000-0000-0000-0000-000000000001', 'O2 Arena',              'o2-arena-london',       'London',     'United Kingdom', 'GB', 20000),
  ('b1000000-0000-0000-0000-000000000002', 'Madison Square Garden', 'msg-new-york',          'New York',   'United States',  'US', 20789),
  ('b1000000-0000-0000-0000-000000000003', 'Glastonbury Festival',  'glastonbury',           'Pilton',     'United Kingdom', 'GB', 210000),
  ('b1000000-0000-0000-0000-000000000004', 'Wembley Stadium',       'wembley-stadium',       'London',     'United Kingdom', 'GB', 90000),
  ('b1000000-0000-0000-0000-000000000005', 'Sydney Opera House',    'sydney-opera-house',    'Sydney',     'Australia',      'AU', 5700);

-- Tours
insert into tours (id, artist_id, name, slug, start_date, end_date, rarity) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'The Eras Tour',        'the-eras-tour',        '2023-03-17', '2024-12-08', 'legendary'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'The Car Tour',         'the-car-tour',         '2023-01-01', '2023-12-31', 'uncommon'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'Renaissance World Tour','renaissance-world-tour','2023-05-10', '2023-10-01', 'rare');

-- Shows
insert into shows (id, artist_id, venue_id, tour_id, show_date) values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', '2024-06-21'),
  ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '2023-11-04'),
  ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', '2023-06-25');
