const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupBucket() {
    console.log('🪣 Checking "media" bucket...');

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Error listing buckets:', listError);
        return;
    }

    const mediaBucket = buckets.find(b => b.name === 'media');

    if (mediaBucket) {
        console.log('✅ "media" bucket already exists.');
    } else {
        console.log('⚠️ "media" bucket missing. Creating...');
        const { data, error: createError } = await supabase.storage.createBucket('media', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/ogg']
        });

        if (createError) {
            console.error('❌ Error creating bucket:', createError);
        } else {
            console.log('✅ "media" bucket created successfully.');
        }
    }

    // Ensure public policy logic if needed (usually public: true in createBucket handles basic access)
    console.log('✅ Storage setup check complete.');
}

setupBucket();
