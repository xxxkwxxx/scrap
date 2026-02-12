-- Create system_status table to track scraper state
CREATE TABLE IF NOT EXISTS public.system_status (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    qr_code TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (so the frontend can see status)
CREATE POLICY "Allow public read access" ON public.system_status
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role full access (implicit, but good to be explicit about intent or if using restricted roles)
-- Service role bypasses RLS by default, so no policy strictly needed for writing if using service_role key.
