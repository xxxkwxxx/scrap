const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    console.log('--- ALL SCHEDULES ---');
    const { data: allSchedules } = await supabase.from('scheduled_summaries').select('*');
    console.log(JSON.stringify(allSchedules, null, 2));

    console.log('\n--- RECENT SUMMARIES (HISTORY) ---');
    const { data: history } = await supabase.from('summaries').select('*').order('created_at', { ascending: false }).limit(3);
    console.log(JSON.stringify(history, null, 2));
}

checkAll();
