-- Add user_id column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id column to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Enable RLS on groups (messages already enabled)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.messages;
DROP POLICY IF EXISTS "Allow individual read access" ON public.messages;
DROP POLICY IF EXISTS "Allow individual insert access" ON public.messages;
DROP POLICY IF EXISTS "Allow individual read access" ON public.groups;
DROP POLICY IF EXISTS "Allow individual insert access" ON public.groups;

-- Create policies for messages
CREATE POLICY "Allow individual read access" ON public.messages
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access" ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create policies for groups
CREATE POLICY "Allow individual read access" ON public.groups
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access" ON public.groups
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- BACKFILL DATA (Optional: Link existing data to the owner if we can find them)
-- This block attempts to find a user by email and update null records.
-- Replace 'keewee4123@gmail.com' with the actual owner email if different.
DO $$
DECLARE
    target_user_id uuid;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'keewee4123@gmail.com' LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        UPDATE public.messages SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE public.groups SET user_id = target_user_id WHERE user_id IS NULL;
    END IF;
END $$;
