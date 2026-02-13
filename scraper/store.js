const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    console.warn('Scraper will fail to save messages until credentials are set.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Cache for user_id to avoid repeated lookups
let cachedUserId = null;

async function getUserId() {
    if (cachedUserId) return cachedUserId;

    if (!supabase) return null;

    const ownerEmail = process.env.SCRAPER_OWNER_EMAIL;
    if (!ownerEmail) {
        console.warn('⚠️ SCRAPER_OWNER_EMAIL not set in .env. Messages will be saved without user_id.');
        return null;
    }

    // Since we are using service_role key, we can access auth.users via admin api but 
    // supabase-js client doesn't expose auth.users table directly for select usually unless 
    // configured. 
    // However, with service_role we can use getUserByEmail if we had the admin auth client,
    // or just raw select if we have permissions.
    // Let's try raw select wrapper or admin.listUsers.

    // Better approach with service role:
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('❌ Error fetching users:', error);
        return null;
    }

    const user = data.users.find(u => u.email === ownerEmail);
    if (user) {
        console.log(`✅ Found user_id for ${ownerEmail}: ${user.id}`);
        cachedUserId = user.id;
        return user.id;
    } else {
        console.warn(`⚠️ User with email ${ownerEmail} not found in Supabase.`);
        return null;
    }
}

async function saveMessage(message, chat) {
    if (!supabase) return;

    const { body, from, timestamp, author } = message;

    // Ensure group exists
    const userId = await getUserId();

    const { error: groupError } = await supabase
        .from('groups')
        .upsert({
            id: chat.id._serialized,
            name: chat.name,
            user_id: userId
        }, { onConflict: 'id' });

    if (groupError) {
        console.error('❌ Error saving group:', groupError);
    } else {
        console.log(`✅ Group saved/updated: ${chat.name}`);
    }

    // Save message
    const senderName = message._senderName || message.from;
    // Fallback to message.from if _senderName is not set (legacy or direct call)

    const { error: msgError } = await supabase
        .from('messages')
        .insert({
            group_id: chat.id._serialized,
            sender: senderName,
            content: body,
            timestamp: new Date(timestamp * 1000).toISOString(),
            user_id: userId
        });

    if (msgError) {
        console.error('❌ Error saving message:', msgError);
    } else {
        console.log(`✅ Message saved from ${senderName}`);
    }
}

async function updateSystemStatus(status, qrCode = null) {
    if (!supabase) return;

    const { error } = await supabase
        .from('system_status')
        .upsert({
            id: 'whatsapp_scraper',
            status,
            qr_code: qrCode,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('❌ ERROR updating system status:', error.message);
    } else {
        console.log(`✅ System status updated: ${status} ${qrCode ? '(with QR)' : ''}`);
    }
}

async function checkAndSendDailySummary(client) {
    if (!supabase) return;

    // 1. Get all users who have a summary_time set
    const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .not('summary_time', 'is', null)
        .not('summary_time', 'is', null);

    if (error) {
        console.error('Error fetching settings for scheduler:', error);
        return;
    }

    if (!settings || settings.length === 0) return;

    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    console.log(`Checking schedules at ${currentTime}...`);

    for (const userSetting of settings) {
        if (userSetting.summary_time === currentTime) {
            console.log(`Triggering daily summary for user ${userSetting.user_id} at ${currentTime}`);
            await generateAndSendSummaryForUser(userSetting, client);
        }
    }
}

async function generateAndSendSummaryForUser(setting, client) {
    try {
        // Fetch TODAY'S messages (from 00:00 to now)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = today.toISOString();

        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .gte('timestamp', startDate)
            .order('timestamp', { ascending: true });

        if (msgError) throw msgError;

        if (!messages || messages.length === 0) {
            console.log('No messages to summarize for today.');
            return;
        }

        const messageCount = messages.length;
        console.log(`Summarizing ${messageCount} messages...`);

        // Generate Summary (using API key from settings or env)
        const apiKey = setting.gemini_api_key || process.env.GEMINI_API_KEYS?.split(',')[0] || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('No Gemini API Found');
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

        const prompt = `
        You are a helpful personal assistant. 
        Please summarize the following WhatsApp messages from today (${new Date().toLocaleDateString()}).
        
        Focus on:
        - Key discussions and decisions.
        - Important tasks or reminders mentioned.
        - Who said what (if relevant).
        
        Messages:
        ${messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender}: ${m.content}`).join('\n')}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        // Send to "Own Chat" (Note to Self)
        // client.info.wid._serialized is the bot's own ID.
        const to = client.info.wid._serialized;

        const finalMessage = `🌟 *Daily AI Summary*\n\n${summary}\n\n_Processed ${messageCount} messages._`;

        await client.sendMessage(to, finalMessage);
        console.log(`✅ Daily summary sent to ${to}`);

    } catch (err) {
        console.error('Error generating/sending daily summary:', err);
    }
}

async function checkLogoutCommand(client) {
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('system_status')
            .select('status')
            .eq('id', 'whatsapp_scraper')
            .single();

        if (error) throw error;

        if (data && data.status === 'LOGOUT_REQUEST') {
            console.log('🛑 Received LOGOUT_REQUEST. Logging out...');
            await client.logout();
            console.log('✅ Client logged out.');
            await updateSystemStatus('DISCONNECTED');
            // Re-initialize to allow new login
            client.initialize();
        }
    } catch (err) {
        console.error('Error checking logout command:', err.message);
    }
}

module.exports = { saveMessage, updateSystemStatus, checkAndSendDailySummary, checkLogoutCommand };
