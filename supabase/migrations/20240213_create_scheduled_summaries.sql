-- Migration: Create scheduled_summaries table
-- Created: 2024-02-13

create table if not exists public.scheduled_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  summary_time text not null, -- 'HH:MM'
  target_type text not null, -- 'me', 'number', 'group'
  target_id text not null, -- JID or phoneNumber
  target_name text, -- Friendly name (e.g. Group Name or Contact Name)
  is_active boolean default true,
  last_run timestamptz,
  created_at timestamptz default now()
);

-- Index for scheduler polling
create index if not exists idx_scheduled_summaries_time on public.scheduled_summaries(summary_time) where is_active = true;

-- Enable RLS
alter table public.scheduled_summaries enable row level security;

-- Policies
create policy "Users can manage their own schedules" 
on public.scheduled_summaries 
for all 
using (auth.uid() = user_id);

create policy "Service role can read all schedules" 
on public.scheduled_summaries 
for select 
using (auth.role() = 'service_role');

create policy "Service role can update last_run" 
on public.scheduled_summaries 
for update 
using (auth.role() = 'service_role');
