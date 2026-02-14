-- Add whatsapp_id column to messages table to prevent duplicates
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS whatsapp_id text;

-- Add unique constraint on whatsapp_id
ALTER TABLE public.messages
ADD CONSTRAINT messages_whatsapp_id_key UNIQUE (whatsapp_id);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON public.messages(whatsapp_id);
