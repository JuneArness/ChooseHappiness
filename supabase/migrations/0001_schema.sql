-- #ChooseHappiness database schema.
-- Security rules live in 0002_security.sql; all writes from the app go through the
-- functions in 0003_functions.sql, which check permissions and rate limits server-side.

create extension if not exists pgcrypto;

-- ---------- People ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 300),
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  suspended_until timestamptz,
  notify_replies boolean not null default true,
  notify_messages boolean not null default true,
  email_notifications boolean not null default false,
  allow_peer_messages boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Site settings (single row) ----------
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default '#ChooseHappiness',
  tagline text not null default 'Begin the journey when the paths are before you.',
  founders text not null default 'Stephen A. Parks Jr. & Gina P. McCoy',
  timezone text not null default 'America/New_York',
  contact_email text not null default '',
  logo_url text not null default '',
  hero_image_url text not null default '',
  -- Live support: the owner sets these. Nothing here is invented by the app.
  support_status text not null default 'offline' check (support_status in ('online', 'offline', 'unavailable')),
  support_hours text not null default '',
  support_response_time text not null default '',
  peer_chat_enabled boolean not null default false,
  community_open boolean not null default true,
  review_first_posts boolean not null default true,
  community_monitoring_note text not null default 'Moderators review reports as they are able. The community is not monitored around the clock.',
  message_retention_days int not null default 365 check (message_retention_days between 7 and 3650),
  high_risk_terms text[] not null default array[
    'suicide', 'suicidal', 'kill myself', 'end my life', 'end it all', 'want to die',
    'self harm', 'self-harm', 'cutting myself', 'hurt myself', 'overdose', 'no reason to live'
  ],
  external_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict do nothing;

-- ---------- Editorial content ----------
create table public.pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  summary text not null default '',
  body text not null default '',
  needs_professional_review boolean not null default false,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.topics (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  pillar text not null check (pillar in ('wellness', 'perspective')),
  title text not null,
  summary text not null default '',
  icon text not null default 'leaf',
  sort int not null default 0
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  topic_slug text references public.topics (slug) on update cascade on delete set null,
  pillar text not null check (pillar in ('wellness', 'perspective')),
  kind text not null default 'article' check (kind in ('article', 'exercise', 'research', 'worksheet')),
  title text not null check (char_length(title) between 3 and 160),
  summary text not null default '',
  body text not null default '',
  intro text not null default '',
  example text not null default '',
  closing text not null default '',
  steps jsonb not null default '[]'::jsonb,
  takeaways jsonb not null default '[]'::jsonb,
  prompts jsonb not null default '[]'::jsonb,
  exercise text not null default '',
  sources jsonb not null default '[]'::jsonb,
  related jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  sensitive boolean not null default false,
  content_note text not null default '',
  professional_note text not null default '',
  evidence_note text not null default '',
  author text not null default '#ChooseHappiness Editorial',
  reviewed_by_professional boolean not null default false,
  reading_minutes int not null default 5,
  image_url text not null default '',
  featured boolean not null default false,
  published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.articles (topic_slug);

create table public.reflection_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 5 and 300),
  scheduled_for date unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.journeys (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  summary text not null default '',
  minutes int not null default 10,
  steps jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  published boolean not null default true
);

-- ---------- Private member data ----------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_date date not null default current_date,
  title text not null default '' check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 20000),
  prompt text not null default '',
  source text not null default 'journal' check (source in ('journal', 'reflection', 'exercise', 'journey')),
  source_ref text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.journal_entries (user_id, entry_date desc);

create table public.saved_items (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('article', 'exercise', 'journey', 'thread')),
  item_ref text not null,
  status text not null check (status in ('saved', 'completed')),
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_ref, status)
);

-- ---------- Community ----------
create table public.forum_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null default '',
  sort int not null default 0,
  active boolean not null default true
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.forum_categories (slug) on update cascade,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 8000),
  content_warning text not null default '' check (char_length(content_warning) <= 80),
  status text not null default 'published' check (status in ('published', 'pending', 'removed')),
  hold_reason text not null default '',
  reply_count int not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  last_activity_at timestamptz not null default now()
);
create index on public.threads (category_slug, last_activity_at desc);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  content_warning text not null default '' check (char_length(content_warning) <= 80),
  status text not null default 'published' check (status in ('published', 'pending', 'removed')),
  hold_reason text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index on public.replies (thread_id, created_at);

create table public.reactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id uuid not null,
  kind text not null check (kind in ('support', 'relate', 'thanks')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id, kind)
);

create table public.category_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_slug text not null references public.forum_categories (slug) on update cascade on delete cascade,
  primary key (user_id, category_slug)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'block' check (kind in ('block', 'mute')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------- Safety and moderation ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('thread', 'reply', 'message', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('safety', 'harassment', 'hate', 'spam', 'privacy', 'misinformation', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  priority text not null default 'normal' check (priority in ('high', 'normal')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text not null default '',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (status, priority, created_at);

-- Append-only record of every moderator / administrator action.
create table public.moderation_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  about text not null default '' check (char_length(about) <= 200),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'reversed')),
  response text not null default '',
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Messaging ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('support', 'peer')),
  subject text not null default '' check (char_length(subject) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  from_staff boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  text text not null,
  link text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (user_id, created_at desc);

-- New sign-ups get a profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    v_name := 'Member ' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Live chat: stream new messages to members (Supabase Realtime respects the security rules).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
