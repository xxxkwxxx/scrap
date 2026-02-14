require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables. Check .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
    console.log('📦 Checking storage buckets...');

    // 1. List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Error listing buckets:', listError);
        return;
    }

    const mediaBucket = buckets.find(b => b.name === 'media');

    if (mediaBucket) {
        console.log('✅ "media" bucket already exists.');
    } else {
        console.log('⚠️ "media" bucket not found. Creating it...');

        // 2. Create bucket
        const { data, error: createError } = await supabase.storage.createBucket('media', {
            public: true, // Make it public so images can be viewed
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'audio/mpeg', 'application/pdf']
        });

        if (createError) {
            console.error('❌ Error creating bucket:', createError);
        } else {
            console.log('✅ "media" bucket created successfully!');
        }
    }
}

setupStorage();
