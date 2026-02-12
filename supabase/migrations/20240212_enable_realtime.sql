-- Enable Realtime for messages and system_status tables
-- This allows the frontend to receive updates immediately without polling

-- Add 'messages' table to the 'supabase_realtime' publication
alter publication supabase_realtime add table messages;

-- Add 'system_status' table to the 'supabase_realtime' publication
alter publication supabase_realtime add table system_status;
