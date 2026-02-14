require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugSchema() {
    console.log('🔍 Debugging user_settings schema...');

    // 1. Get a user ID (or just pick one if existing)
    const { data: users, error: userError } = await supabase.from('user_settings').select('user_id').limit(1);

    if (userError || !users.length) {
        console.error('❌ Could not fetch any user for testing:', userError);
        return;
    }

    const userId = users[0].user_id;
    console.log(`👤 Testing with User ID: ${userId}`);

    // 2. Try to update save_media
    const { data, error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: userId,
            save_media: true
        })
        .select();

    if (error) {
        console.error('❌ Update FAILED. This likely means the column is missing.');
        console.error('Error Details:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Update SUCCESS! The column exists.');
        console.log('Returned Data:', JSON.stringify(data, null, 2));
    }
}

debugSchema();
