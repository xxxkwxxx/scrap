-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Groups table
create table if not exists public.groups (
  id text primary key, -- WhatsApp group ID (serialized)
  name text not null,
  created_at timestamptz default now()
);

-- Messages table
create table if not exists public.messages (
  id bigserial primary key,
  group_id text references public.groups(id) on delete cascade,
  sender text not null,
  content text,
  timestamp timestamptz not null,
  created_at timestamptz default now()
);

-- Summaries table
create table if not exists public.summaries (
  id bigserial primary key,
  group_id text references public.groups(id) on delete cascade,
  summary text not null,
  summary_date date not null,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.groups enable row level security;
alter table public.messages enable row level security;
alter table public.summaries enable row level security;

-- Allow authenticated users (frontend dashboard) to read
create policy "Enable read access for authenticated users" on public.groups for select using (auth.role() = 'authenticated');
create policy "Enable read access for authenticated users" on public.messages for select using (auth.role() = 'authenticated');
create policy "Enable read access for authenticated users" on public.summaries for select using (auth.role() = 'authenticated');

-- Allow service role (scraper) full access
create policy "Enable all access for service role" on public.groups for all using (auth.role() = 'service_role');
create policy "Enable all access for service role" on public.messages for all using (auth.role() = 'service_role');
create policy "Enable all access for service role" on public.summaries for all using (auth.role() = 'service_role');
