-- 1. DROP and RECREATE tables to ensure clean state and lowercase names
DROP TABLE IF EXISTS public.screens CASCADE;
DROP TABLE IF EXISTS public.playlists CASCADE;
DROP TABLE IF EXISTS public.media CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;

CREATE TABLE public.screens (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'offline',
  playlist_id uuid, 
  last_ping timestamp with time zone,
  owner text,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.playlists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  items jsonb default '[]'::jsonb,
  owner text,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.media (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  url text not null,
  duration numeric default 10,
  thumbnail text,
  owner text,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.schedules (
  id uuid default gen_random_uuid() primary key,
  screen_id uuid,
  playlist_id uuid,
  day text,
  start_hour int,
  end_hour int,
  owner text,
  created_at timestamp with time zone default now()
);

-- 2. DISABLE RLS (CRITICAL: This allows anonymous read/write)
ALTER TABLE public.screens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.media DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules DISABLE ROW LEVEL SECURITY;

-- 3. GRANT PERMISSIONS
GRANT ALL ON TABLE public.screens TO anon;
GRANT ALL ON TABLE public.screens TO authenticated;
GRANT ALL ON TABLE public.playlists TO anon;
GRANT ALL ON TABLE public.playlists TO authenticated;
GRANT ALL ON TABLE public.media TO anon;
GRANT ALL ON TABLE public.media TO authenticated;
GRANT ALL ON TABLE public.schedules TO anon;
GRANT ALL ON TABLE public.schedules TO authenticated;

-- 4. Enable Realtime triggers
BEGIN;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
COMMIT;
alter publication supabase_realtime add table public.screens;
alter publication supabase_realtime add table public.playlists;
alter publication supabase_realtime add table public.media;
alter publication supabase_realtime add table public.schedules;

-- 5. STORAGE BUCKET SETUP (Standard Way)
-- This creates the 'media' bucket folder if it doesn't already exist.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Allows anyone to upload and view files in the media bucket (for testing)
-- Note: We use the existing storage.objects table provided by Supabase.
DROP POLICY IF EXISTS "Public Access All" ON storage.objects;
CREATE POLICY "Public Access All" ON storage.objects FOR ALL USING ( bucket_id = 'media' );

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'media' );
