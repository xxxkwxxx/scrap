-- Migration: Update summaries table for history and range tracking
-- Created: 2024-02-13

-- Add columns to summaries table
alter table public.summaries 
add column if not exists user_id uuid references auth.users(id) on delete cascade,
add column if not exists start_date timestamptz,
add column if not exists end_date timestamptz;

-- Update RLS policies for histories
create policy "Users can view their own summary history" 
on public.summaries 
for select 
using (auth.uid() = user_id);

create policy "Users can insert their own summaries" 
on public.summaries 
for insert 
with check (auth.uid() = user_id);

create policy "Service role can manage all summaries" 
on public.summaries 
for all 
using (auth.role() = 'service_role');
