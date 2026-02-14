const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log(`Current Time (HH:MM): ${currentTime}`);

    const { data: schedules, error: schedError } = await supabase
        .from('scheduled_summaries')
        .select('*')
        .eq('is_active', true);

    if (schedError) {
        console.error('Error fetching schedules:', schedError);
    } else {
        console.log('--- ACTIVE SCHEDULES ---');
        console.table(schedules.map(s => ({
            id: s.id,
            time: s.summary_time,
            target: s.target_name || s.target_id,
            last_run: s.last_run
        })));
    }

    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('timestamp, content, sender')
        .order('timestamp', { ascending: false })
        .limit(3);

    if (msgError) {
        console.error('Error fetching messages:', msgError);
    } else {
        console.log('--- RECENT MESSAGES ---');
        console.table(messages);
    }
}

checkState();
