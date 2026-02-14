const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLastMessages() {
    console.log('🔍 Checking last 5 messages in DB...');

    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error fetching messages:', error);
        return;
    }

    if (!messages || messages.length === 0) {
        console.log('⚠️ No messages found.');
        return;
    }

    messages.forEach(msg => {
        console.log('------------------------------------------------');
        console.log(`ID: ${msg.id}`);
        console.log(`Sender: ${msg.sender}`);
        console.log(`Type: ${msg.message_type || 'N/A'}`); // Assuming there's a type column, or we infer
        console.log(`Content (Raw): "${msg.content}"`);
        console.log(`Media URL: ${msg.media_url || 'NULL'}`);
        console.log(`Timestamp: ${msg.timestamp}`);
    });
    console.log('------------------------------------------------');
}

checkLastMessages();
