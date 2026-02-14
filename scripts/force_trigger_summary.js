const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

// We need to import the generation logic. 
// However, the logic is currently embedded in `scraper/store.js` which requires the whatsapp client.
// We can't easily mock the full whatsapp client here without running the scraper.
// Instead, we will insert a COMMAND into `scraper_commands` table which the running scraper will pick up.
// But wait, the plan was to "force trigger". Creating a command is a better way to interact with the running scraper.
// 
// Let's modify `scraper/store.js` to handle a FORCE_SUMMARY command.
// OR, we can try to run the summary generation here if we can instantiate a limited client (but we need to send messages).
//
// Actually, `checkPendingCommands` in `store.js` already handles `SEND_MESSAGE`.
// We can add a `TRIGGER_SUMMARY` command to `scraper/store.js` and then this script just inserts that command.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceTrigger() {
    const args = process.argv.slice(2);
    const scheduleId = args[0]; // Optional: ID of the schedule to trigger

    console.log('🚀 Force Triggering Summary...');

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials.');
        return;
    }

    // Insert a command for the scraper to pick up
    // We will need to update `scraper/store.js` to handle 'TRIGGER_SUMMARY'

    const payload = scheduleId ? { schedule_id: scheduleId } : { all: true };

    const { data, error } = await supabase
        .from('scraper_commands')
        .insert({
            command: 'TRIGGER_SUMMARY',
            payload: payload,
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Failed to insert command:', error);
    } else {
        console.log(`✅ Command inserted! Command ID: ${data.id}`);
        console.log('The scraper (once running) will pick this up and generate the summary.');
    }
}

forceTrigger();
