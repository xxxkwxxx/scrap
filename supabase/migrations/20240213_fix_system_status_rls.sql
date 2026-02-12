-- Enable RLS for system_status
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select system status
-- This ensures the frontend can read the status
CREATE POLICY "Allow authenticated users to select system_status"
ON system_status FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update system status
-- This is required for the "Disconnect WhatsApp" button to work
-- as it updates the status to 'LOGOUT_REQUEST'
CREATE POLICY "Allow authenticated users to update system_status"
ON system_status FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow insert if needed (e.g. initial setup from frontend, though mainly scraper handles inserts)
-- But let's be safe and allow insert too if row doesn't exist
CREATE POLICY "Allow authenticated users to insert system_status"
ON system_status FOR INSERT
TO authenticated
WITH CHECK (true);
