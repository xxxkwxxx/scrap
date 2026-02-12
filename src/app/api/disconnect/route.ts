import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { error } = await supabase
            .from('system_status')
            .upsert({
                id: 'whatsapp_scraper',
                status: 'LOGOUT_REQUEST',
                updated_at: new Date().toISOString()
            })

        if (error) {
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error disconnecting:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
