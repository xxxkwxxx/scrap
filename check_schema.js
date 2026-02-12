require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    console.log('Checking user_settings schema...');

    // Try to select the column
    const { data, error } = await supabase
        .from('user_settings')
        .select('summary_time')
        .limit(1);

    if (error) {
        console.error('Error selecting summary_time:', error.message);
        console.log('Column likely missing.');
    } else {
        console.log('Column exists.');
    }
}

checkSchema();
