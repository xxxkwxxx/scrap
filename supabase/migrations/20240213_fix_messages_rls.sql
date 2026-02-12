-- Enable RLS for messages table just in case
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users to messages
-- Check if policy exists first to avoid error
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'messages'
        AND policyname = 'Allow public read access'
    ) THEN
        CREATE POLICY "Allow public read access" ON public.messages
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END
$$;
