import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

// Initialize Supabase (Service Role)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to get a random key or iterate
const getGeminiKeys = () => {
    const keysVar = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
    return keysVar.split(',').map((k) => k.trim()).filter((k) => k)
}

const generateWithRetry = async (prompt: string, keys: string[]) => {
    let lastError = null

    for (const key of keys) {
        try {
            console.log(`Attempting generation with key ending in ...${key.slice(-4)}`)
            const genAI = new GoogleGenerativeAI(key)
            const model = genAI.getGenerativeModel({
                model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
            })

            const result = await model.generateContent(prompt)
            return result.response.text()
        } catch (error: any) {
            console.warn(`Key ...${key.slice(-4)} failed:`, error.message)
            lastError = error
            continue
        }
    }
    throw lastError || new Error('No API keys available')
}

export async function POST(req: Request) {
    try {
        const { groupId, sender, startDate, endDate } = await req.json()

        // Build query
        let query = supabase
            .from('messages')
            .select('sender, content, timestamp, group_id')
            .order('timestamp', { ascending: true })
            .limit(200) // Increase limit for better summaries

        // Apply filters
        if (groupId && groupId !== 'all') {
            query = query.eq('group_id', groupId)
        }

        if (sender && sender !== 'all') {
            query = query.eq('sender', sender)
        }

        if (startDate) {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            query = query.gte('timestamp', start.toISOString())
        }

        if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            query = query.lte('timestamp', end.toISOString())
        }

        const { data: messages, error: fetchError } = await query

        if (fetchError || !messages || messages.length === 0) {
            return NextResponse.json({ message: 'No messages found to summarize for the selected criteria.' })
        }

        // 2. Construct prompt
        const messageText = messages
            .map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender} (${m.group_id ? 'Group' : 'DM'}): ${m.content}`)
            .join('\n')

        const prompt = `Summarize the following WhatsApp messages effectively. 
        Context: The user has filtered these messages. 
        Filters applied: 
        - Group: ${groupId || 'All'}
        - Sender: ${sender || 'All'}
        - Date Range: ${startDate || 'Any'} to ${endDate || 'Any'}

        Please provide a concise summary with bullet points, focusing on key discussions, decisions, and important information.
        
        Messages:
        ${messageText}`

        // 3. Call Gemini with Key Rotation
        const keys = getGeminiKeys()
        if (keys.length === 0) {
            return NextResponse.json({ error: 'No Gemini API keys configured' }, { status: 500 })
        }

        const summaryText = await generateWithRetry(prompt, keys)

        // 4. Save Summary (Optional: for now just return it, or save to a different table if needed. 
        // The existing 'summaries' table is linked to group_id, which might be null here. 
        // For this feature, returning the summary directly to the UI is often better for ad-hoc queries.)

        // We will return it directly for the new "Summarize Tab" usage.
        return NextResponse.json({ success: true, summary: summaryText, count: messages.length })

    } catch (error: any) {
        console.error('Summarization error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
