const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log('🧹 Cleaning up test messages...');

    // Delete messages with specific test IDs
    const { error } = await supabase
        .from('messages')
        .delete()
        .ilike('whatsapp_id', 'test_%');

    if (error) {
        console.error('❌ Error cleaning up:', error);
    } else {
        console.log('✅ Cleanup complete. Deleted test messages.');
    }
}

cleanup();
