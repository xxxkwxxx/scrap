const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCommands() {
    console.log('--- RECENT COMMANDS ---');
    const { data: commands, error } = await supabase
        .from('scraper_commands')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching commands:', error);
    } else {
        console.log(JSON.stringify(commands, null, 2));
    }
}

checkCommands();
