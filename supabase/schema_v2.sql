-- System Status (for QR Code sync)
create table if not exists public.system_status (
  id text primary key, -- singleton 'whatsapp_scraper'
  status text not null, -- 'INIT', 'QR_READY', 'READY', 'DISCONNECTED'
  qr_code text,
  updated_at timestamptz default now()
);

-- User Settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text, -- Optional user-specific key
  summary_time time,   -- Preferred time for daily summary
  created_at timestamptz default now()
);

-- RLS
alter table public.system_status enable row level security;
alter table public.user_settings enable row level security;

-- Policies
create policy "Read system status" on public.system_status for select using (auth.role() = 'authenticated');
create policy "Service role manages system status" on public.system_status for all using (auth.role() = 'service_role');

create policy "Users manage own settings" on public.user_settings for all using (auth.uid() = user_id);
