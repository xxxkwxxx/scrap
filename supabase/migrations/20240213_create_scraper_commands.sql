-- Migration: Create scraper_commands table for async commands
-- Created: 2024-02-13

create table if not exists public.scraper_commands (
  id uuid primary key default uuid_generate_v4(),
  command text not null, -- 'SEND_MESSAGE'
  payload jsonb not null, -- { to: '...', text: '...' }
  status text default 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for polling
create index if not exists idx_scraper_commands_status on public.scraper_commands(status) where status = 'PENDING';

-- Enable RLS
alter table public.scraper_commands enable row level security;

-- Policies
create policy "Enable all access for authenticated users" 
on public.scraper_commands 
for all 
using (auth.role() = 'authenticated');

create policy "Enable all access for service role" 
on public.scraper_commands 
for all 
using (auth.role() = 'service_role');
