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

        // 1. Fetch group metadata first (to map IDs to Names)
        const { data: groups } = await supabase.from('groups').select('*')
        const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g.name]))

        // Build query
        let query = supabase
            .from('messages')
            .select('sender, content, timestamp, group_id')
            .order('timestamp', { ascending: true })
            .limit(1000) // Support a larger batch for summarization

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

        // 2. Group messages by chat and partition into Groups vs PMs
        const groupChats: Record<string, any[]> = {}
        const privateChats: Record<string, any[]> = {}

        messages.forEach(m => {
            const chatId = m.group_id
            const chatName = groupMap[chatId] || chatId || 'Unknown Chat'

            if (chatId && chatId.endsWith('@g.us')) {
                if (!groupChats[chatName]) groupChats[chatName] = []
                groupChats[chatName].push(m)
            } else {
                if (!privateChats[chatName]) privateChats[chatName] = []
                privateChats[chatName].push(m)
            }
        })

        const activeGroupCount = Object.keys(groupChats).length
        const activePmCount = Object.keys(privateChats).length

        // 3. Construct the strict prompt
        const prompt = `
        You are a highly efficient personal assistant. 
        Your task is to provide a detailed summary of the WhatsApp messages below, strictly organized by their **Group Name** or **Contact Name**.
        
        MANDATORY FORMATTING RULES:
        1. **HEADERS**: Every section MUST start with the Name of the group or person in BOLD (e.g., ### **468 - Project ER @ Chai Chee**).
        2. **NO TOPICAL GROUPING**: Do not group by topics like "Cement" or "Operations". Summarize everything that happened in one chat under its own header.
        3. **TEMPLATE PER CHAT**:
           ### **[CHAT NAME]**
           - **Who talked**: [Participants]
           - **Summary**: [Detailed, bulleted recap of all events, decisions, and updates in this specific chat.]
        
        4. Split the output into two major sections:
           ## 🏆 GROUP ACTIVITIES
           ## 👤 PRIVATE CONVERSATIONS

        DATA TO SUMMARIZE:
        ---
        ${activeGroupCount > 0 ? `## 🏆 GROUP ACTIVITIES\n${Object.entries(groupChats)
                .sort((a, b) => b[0].localeCompare(a[0])) // Sort descending Z-A
                .map(([name, msgs]) => `
[GROUP NAME: ${name}]
MESSAGES:
${msgs.map(m => `(${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ${m.sender}: ${m.content}`).join('\n')}
        `).join('\n\n')}` : ""}

        ${activePmCount > 0 ? `## 👤 PRIVATE CONVERSATIONS\n${Object.entries(privateChats)
                .sort((a, b) => b[0].localeCompare(a[0])) // Sort descending Z-A
                .map(([name, msgs]) => `
[CHAT WITH: ${name}]
MESSAGES:
${msgs.map(m => `(${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ${m.sender}: ${m.content}`).join('\n')}
        `).join('\n\n')}` : ""}
        `

        // 4. Call Gemini with Key Rotation
        const keys = getGeminiKeys()
        if (keys.length === 0) {
            return NextResponse.json({ error: 'No Gemini API keys configured' }, { status: 500 })
        }

        const summaryText = await generateWithRetry(prompt, keys)

        return NextResponse.json({ success: true, summary: summaryText, count: messages.length })

    } catch (error: any) {
        console.error('Summarization error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
