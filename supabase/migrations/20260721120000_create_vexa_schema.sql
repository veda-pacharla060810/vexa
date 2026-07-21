-- VEXA database schema
-- Review this migration before applying it to Supabase.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  theme text not null default 'system',
  bio text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','archived')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date timestamptz,
  completed_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  tags text[] not null default '{}',
  is_recurring boolean not null default false,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'event' check (event_type in ('event','focus','reminder','habit','meeting')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  is_recurring boolean not null default false,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_end_after_start check (end_at > start_at)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  status text not null default 'draft' check (status in ('draft','scheduled','in_progress','completed','cancelled')),
  score numeric(5,2),
  max_score numeric(5,2),
  scheduled_for timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null default 'Focus Session',
  started_at timestamptz not null,
  ended_at timestamptz,
  target_minutes integer not null default 25 check (target_minutes > 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes > 0),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  notes text,
  mood_score integer check (mood_score is null or (mood_score >= 1 and mood_score <= 5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scroll_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Scroll Session',
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  content_type text not null default 'article' check (content_type in ('article','social','video','docs','unknown')),
  source_url text,
  topic text,
  scroll_depth_percent numeric(5,2) check (scroll_depth_percent is null or (scroll_depth_percent >= 0 and scroll_depth_percent <= 100)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  receipt_date date not null,
  category text,
  description text,
  source text,
  amount numeric(10,2) not null default 0.00 check (amount >= 0),
  currency char(3) not null default 'USD',
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  event_id uuid references public.calendar_events(id) on delete set null,
  insight_type text not null check (insight_type in ('daily_summary','task_recommendation','focus_analysis','habit_tip','weekly_review')),
  title text not null,
  summary text not null,
  confidence_score numeric(4,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_permissions_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  allow_ai_recommendations boolean not null default true,
  allow_ai_insights boolean not null default true,
  allow_data_usage boolean not null default false,
  default_model text,
  model_preferences jsonb not null default '{}'::jsonb,
  sensitivity_level text not null default 'medium' check (sensitivity_level in ('low','medium','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_tasks
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger set_updated_at_calendar_events
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

create trigger set_updated_at_tests
  before update on public.tests
  for each row execute function public.set_updated_at();

create trigger set_updated_at_focus_sessions
  before update on public.focus_sessions
  for each row execute function public.set_updated_at();

create trigger set_updated_at_scroll_sessions
  before update on public.scroll_sessions
  for each row execute function public.set_updated_at();

create trigger set_updated_at_daily_receipts
  before update on public.daily_receipts
  for each row execute function public.set_updated_at();

create trigger set_updated_at_ai_insights
  before update on public.ai_insights
  for each row execute function public.set_updated_at();

create trigger set_updated_at_ai_permissions_settings
  before update on public.ai_permissions_settings
  for each row execute function public.set_updated_at();

create index if not exists idx_tasks_profile_status on public.tasks(profile_id, status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_calendar_events_profile_start on public.calendar_events(profile_id, start_at);
create index if not exists idx_tests_profile_scheduled on public.tests(profile_id, scheduled_for);
create index if not exists idx_focus_sessions_profile_started on public.focus_sessions(profile_id, started_at);
create index if not exists idx_scroll_sessions_profile_started on public.scroll_sessions(profile_id, started_at);
create index if not exists idx_daily_receipts_profile_date on public.daily_receipts(profile_id, receipt_date);
create index if not exists idx_ai_insights_profile_created on public.ai_insights(profile_id, created_at);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tests enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.scroll_sessions enable row level security;
alter table public.daily_receipts enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_permissions_settings enable row level security;

create policy if not exists profiles_own_rows
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy if not exists tasks_own_rows
  on public.tasks
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists calendar_events_own_rows
  on public.calendar_events
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists tests_own_rows
  on public.tests
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists focus_sessions_own_rows
  on public.focus_sessions
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists scroll_sessions_own_rows
  on public.scroll_sessions
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists daily_receipts_own_rows
  on public.daily_receipts
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists ai_insights_own_rows
  on public.ai_insights
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy if not exists ai_permissions_settings_own_rows
  on public.ai_permissions_settings
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
