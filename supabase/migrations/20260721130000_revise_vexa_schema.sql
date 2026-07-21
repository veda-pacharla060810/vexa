-- Revised VEXA schema for the MVP product direction.
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
  bio text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.user_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  ai_personality text not null default 'supportive' check (ai_personality in ('supportive','direct','calm','playful','minimal')),
  focus_duration_minutes integer not null default 25 check (focus_duration_minutes > 0),
  scroll_limit_minutes integer not null default 45 check (scroll_limit_minutes > 0),
  morning_check_in boolean not null default true,
  night_reflection boolean not null default true,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  event_type text not null default 'event' check (event_type in ('event','focus','reminder','habit','meeting','test')),
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
  calendar_event_id uuid not null unique references public.calendar_events(id) on delete cascade,
  subject text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  score numeric(5,2),
  max_score numeric(5,2),
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
  platform text not null default 'unknown' check (platform in ('mobile','desktop','tablet','unknown')),
  reason text,
  reflection text,
  was_it_worth_it boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_productivity_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  receipt_date date not null,
  focus_time_minutes integer not null default 0 check (focus_time_minutes >= 0),
  scroll_time_minutes integer not null default 0 check (scroll_time_minutes >= 0),
  tasks_completed_count integer not null default 0 check (tasks_completed_count >= 0),
  biggest_win text,
  biggest_distraction text,
  ai_summary text,
  tomorrow_priority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  event_id uuid references public.calendar_events(id) on delete set null,
  insight_type text not null check (insight_type in ('daily_summary','task_recommendation','focus_analysis','habit_tip','weekly_review','conversation_summary')),
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

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'AI Conversation',
  user_prompt text not null,
  assistant_response text not null,
  intent text not null default 'general' check (intent in ('general','daily_review','focus_plan','task_help','reflection','command_center')),
  context_type text,
  context_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_user_preferences
  before update on public.user_preferences
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

create trigger set_updated_at_daily_productivity_receipts
  before update on public.daily_productivity_receipts
  for each row execute function public.set_updated_at();

create trigger set_updated_at_ai_insights
  before update on public.ai_insights
  for each row execute function public.set_updated_at();

create trigger set_updated_at_ai_permissions_settings
  before update on public.ai_permissions_settings
  for each row execute function public.set_updated_at();

create trigger set_updated_at_ai_conversations
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create index if not exists idx_tasks_profile_status on public.tasks(profile_id, status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_calendar_events_profile_start on public.calendar_events(profile_id, start_at);
create index if not exists idx_tests_profile_status on public.tests(profile_id, status);
create index if not exists idx_focus_sessions_profile_started on public.focus_sessions(profile_id, started_at);
create index if not exists idx_scroll_sessions_profile_started on public.scroll_sessions(profile_id, started_at);
create index if not exists idx_daily_productivity_receipts_profile_date on public.daily_productivity_receipts(profile_id, receipt_date);
create index if not exists idx_ai_insights_profile_created on public.ai_insights(profile_id, created_at);
create index if not exists idx_ai_conversations_profile_created on public.ai_conversations(profile_id, created_at);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tests enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.scroll_sessions enable row level security;
alter table public.daily_productivity_receipts enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_permissions_settings enable row level security;
alter table public.ai_conversations enable row level security;

create policy if not exists profiles_own_rows
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy if not exists user_preferences_own_rows
  on public.user_preferences
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

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

create policy if not exists daily_productivity_receipts_own_rows
  on public.daily_productivity_receipts
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

create policy if not exists ai_conversations_own_rows
  on public.ai_conversations
  for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
