const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWrite() {
    console.log('Attempting to write READY status...');
    const { data, error } = await supabase
        .from('system_status')
        .upsert({
            id: 'whatsapp_scraper',
            status: 'READY',
            qr_code: null,
            updated_at: new Date().toISOString()
        })
        .select();

    if (error) {
        console.error('❌ Write failed:', error);
    } else {
        console.log('✅ Write successful:', data);
    }
}

testWrite();
