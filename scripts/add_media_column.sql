-- Add media_url column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Verify the column was added (optional, but good for confirmation)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name = 'media_url';
