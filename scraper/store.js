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

async function uploadMedia(message) {
    if (!supabase) return null;

    try {
        // 1. Check user settings to see if media saving is enabled
        const userId = await getUserId();
        const { data: settings } = await supabase
            .from('user_settings')
            .select('save_media')
            .eq('user_id', userId)
            .maybeSingle();

        if (!settings || !settings.save_media) {
            return null; // Media saving not enabled
        }

        // 2. Download media
        const media = await message.downloadMedia();
        if (!media) return null;

        // 3. Upload to Supabase Storage
        const buffer = Buffer.from(media.data, 'base64');
        const fileName = `${userId}/${message.id._serialized}.${media.mimetype.split('/')[1]}`;

        const { data, error } = await supabase.storage
            .from('media')
            .upload(fileName, buffer, {
                contentType: media.mimetype,
                upsert: true
            });

        if (error) {
            console.error('❌ Error uploading media:', error);
            return null;
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

        console.log(`✅ Media uploaded: ${publicUrl}`);
        return publicUrl;

    } catch (err) {
        console.error('❌ Error processing media:', err);
        return null;
    }
}

async function saveMessage(message, chat, mediaUrl = null) {
    if (!supabase) return;

    const { body, from, timestamp, author } = message;
    const whatsappId = message.id?._serialized;

    // CRITICAL FIX: Do not save messages without a WhatsApp ID.
    // This prevents "ghost" duplicates where ID is null.
    if (!whatsappId) {
        console.warn('⚠️ Skipping message save: Missing whatsapp_id (prevents duplicates).', { content: body?.substring(0, 20) });
        return;
    }

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
    // Save message
    const finalContent = message._processedBody || message.body || body;
    const messageData = {
        group_id: chat.id._serialized,
        sender: message._senderName || chat.name || 'Unknown', // FIX: Use the resolved _senderName from handlers.js
        content: finalContent,
        timestamp: new Date(timestamp * 1000).toISOString(),
        user_id: userId,
        media_url: mediaUrl // Add media URL to message data
    };

    // ... existing code ...

    // Add whatsapp_id if available (for deduplication)
    if (whatsappId) {
        messageData.whatsapp_id = whatsappId;
    }

    // Save message with strict deduplication
    const { error: msgError } = await supabase
        .from('messages')
        .upsert(messageData, { onConflict: 'whatsapp_id' });

    if (msgError) {
        if (msgError.code === '23505') { // Unique violation
            console.log(`ℹ️ Duplicate message blocked: ${whatsappId} from ${messageData.sender}`);
        } else {
            console.error('❌ Error saving message:', msgError);
        }
    } else {
        console.log(`✅ Message saved from ${messageData.sender} in ${chat.name}. Content: "${messageData.content}"`);
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

    try {
        const now = new Date();
        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;
        const todayDateStr = now.toDateString();

        // Get all active schedules
        const { data: schedules, error } = await supabase
            .from('scheduled_summaries')
            .select('*')
            .eq('is_active', true);

        if (error) {
            if (error.code === '42P01') return; // Table not created yet
            throw error;
        }

        if (!schedules || schedules.length === 0) return;

        for (const schedule of schedules) {
            // Guard: Check if it already ran today to prevent duplicates
            if (schedule.last_run) {
                const lastRunDate = new Date(schedule.last_run).toDateString();
                if (lastRunDate === todayDateStr) {
                    continue; // Skip if already ran today
                }
            }

            // Robust Time Matching: Run if currentTime >= summary_time
            // This ensures we catch it even if we were restarting exactly at the minute.
            const [schedH, schedM] = schedule.summary_time.split(':').map(Number);
            const nowH = now.getHours();
            const nowM = now.getMinutes();

            const isTimeReached = (nowH > schedH) || (nowH === schedH && nowM >= schedM);

            if (!isTimeReached) continue;

            console.log(`⏰ Triggering scheduled summary for ${schedule.target_name || schedule.target_id} at ${currentTime} (scheduled for ${schedule.summary_time})`);

            try {
                const result = await generateAndSendSummaryForUser(schedule, client);

                // Update last_run only if successfully attempted
                await supabase
                    .from('scheduled_summaries')
                    .update({ last_run: new Date().toISOString() })
                    .eq('id', schedule.id);

                if (result === 'no_messages') {
                    console.log(`ℹ️ No new messages found for ${schedule.target_name || schedule.target_id}, marked as run for today.`);
                } else {
                    console.log(`✅ Summary process completed for ${schedule.target_name || schedule.target_id}`);
                }
            } catch (runErr) {
                console.error(`❌ Failed to process schedule ${schedule.id}:`, runErr);
            }
        }
    } catch (err) {
        console.error('Error in checkAndSendDailySummary:', err);
    }
}

async function generateAndSendSummaryForUser(schedule, client) {
    try {
        const userId = schedule.user_id;

        // 1. Determine Date Range
        // User requested FULL DAILY SUMMARY logic:
        // Always summarize the last 24 hours regardless of last_run.
        const today = new Date();
        const endDate = today.toISOString();

        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        const startDate = yesterday.toISOString();

        console.log(`📊 Generating summary for ${schedule.target_name || schedule.target_id} range: ${startDate} -> ${endDate}`);

        // 2. Fetch messages in range
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .gte('timestamp', startDate)
            .lte('timestamp', endDate)
            .order('timestamp', { ascending: true });

        if (msgError) throw msgError;

        if (!messages || messages.length === 0) {
            return 'no_messages';
        }

        // 3. Fetch groups to map IDs to Names
        const { data: groups } = await supabase.from('groups').select('*');
        const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g.name]));

        // 4. Partition messages
        const groupChats = {};
        const privateChats = {};

        messages.forEach(m => {
            const chatId = m.group_id;
            const chatName = groupMap[chatId] || chatId || 'Unknown Chat';

            if (chatId && chatId.endsWith('@g.us')) {
                if (!groupChats[chatName]) groupChats[chatName] = [];
                groupChats[chatName].push(m);
            } else {
                if (!privateChats[chatName]) privateChats[chatName] = [];
                privateChats[chatName].push(m);
            }
        });

        const activeGroupCount = Object.keys(groupChats).length;
        const activePmCount = Object.keys(privateChats).length;

        // 5. Generate AI Summary
        const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k !== '');

        if (apiKeys.length === 0) {
            throw new Error('No Gemini API keys found in .env');
        }

        let summary = null;
        let lastError = null;

        for (const apiKey of apiKeys) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

                const prompt = `
        You are a highly efficient personal assistant. 
        Your task is to provide a detailed summary of the WhatsApp messages below, strictly organized by their **Group Name** or **Contact Name**.
        
        MANDATORY FORMATTING RULES:
        1. **HEADERS**: Every section MUST start with the Name of the group or person in BOLD (e.g., ### **468 - Project ER @ Chai Chee**).
        2. **NO TOPICAL GROUPING**: Do not group by "Cement", "Updates", etc. Summarize *everything* that happened in one chat under its own header.
        3. **TEMPLATE PER CHAT**:
           ### **[CHAT NAME]**
           - **Who talked**: [Participants]
           - **Summary**: [Detailed, bulleted recap of all events, decisions, and updates in this specific chat.]
        
        DATA TO SUMMARIZE:
        ---
        ${Object.entries(groupChats).length > 0 ? `## 🏆 GROUP ACTIVITIES\n${Object.entries(groupChats)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([name, msgs]) => `
[CHAT NAME: ${name}]
MESSAGES:
${msgs.map(m => `(${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ${m.sender}: ${m.content}`).join('\n')}
        `).join('\n\n')}` : ""}

        ${Object.entries(privateChats).length > 0 ? `## 👤 PRIVATE CONVERSATIONS\n${Object.entries(privateChats)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([name, msgs]) => `
[CHAT WITH: ${name}]
MESSAGES:
${msgs.map(m => `(${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ${m.sender}: ${m.content}`).join('\n')}
        `).join('\n\n')}` : ""}
        `;

                const result = await model.generateContent(prompt);
                summary = result.response.text();

                if (summary) {
                    console.log(`✅ Summary generated successfully using API Key (ending in ...${apiKey.slice(-4)})`);
                    break;
                }
            } catch (err) {
                console.warn(`⚠️ Gemini API Key failed (ending in ...${apiKey.slice(-4)}):`, err.message);
                lastError = err;
            }
        }

        if (!summary) {
            throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message}`);
        }

        // 6. Save to History (summaries table)
        const { error: historyError } = await supabase.from('summaries').insert({
            user_id: userId,
            summary: summary,
            summary_date: today.toISOString().split('T')[0],
            start_date: startDate,
            end_date: endDate,
            group_id: schedule.target_type === 'group' ? schedule.target_id : null
        });
        if (historyError) console.error('❌ Failed to save summary to history:', historyError);

        // 7. Send to Destination
        let targetJid;
        if (schedule.target_type === 'me') {
            targetJid = client.info.wid._serialized;
        } else {
            targetJid = schedule.target_id;
        }

        const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const finalMessage = `🌟 *AI Summary Report - ${reportDate}*\n\n${summary}\n\n_Total: ${messages.length} messages across ${activeGroupCount + activePmCount} chats._`;

        await client.sendMessage(targetJid, finalMessage);
        console.log(`✅ Automated summary sent to ${targetJid} (${messages.length} messages)`);
        return 'sent';

    } catch (err) {
        console.error('Error in generateAndSendSummaryForUser:', err);
    }
}

async function syncGroups(client) {
    if (!supabase) return;
    try {
        const userId = await getUserId();
        const chats = await client.getChats();
        // Strict filter: must be marked as group, have @g.us suffix, and have a non-empty name
        const groups = chats.filter(c =>
            c.isGroup &&
            c.id._serialized.endsWith('@g.us') &&
            c.name &&
            c.name.trim() !== ''
        );

        console.log(`🔄 Syncing ${groups.length} actual groups from WhatsApp...`);

        // Clear existing groups for this user to remove stale/individual chats that no longer match
        await supabase.from('groups').delete().eq('user_id', userId);

        for (const chat of groups) {
            await supabase
                .from('groups')
                .upsert({
                    id: chat.id._serialized,
                    name: chat.name,
                    user_id: userId
                }, { onConflict: 'id' });
        }
        console.log('✅ Group sync completed.');
    } catch (err) {
        console.error('❌ Error syncing groups:', err);
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

async function checkPendingCommands(client) {
    if (!supabase) return;

    // Ensure client is ready and connected
    if (!client.info || !client.info.wid) return;

    try {
        const { data: commands, error } = await supabase
            .from('scraper_commands')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) {
            // Silence table not found errors if migration hasn't run yet
            if (error.code === '42P01') return;
            throw error;
        }

        if (!commands || commands.length === 0) return;

        for (const cmd of commands) {
            console.log(`🤖 Processing command: ${cmd.command} (${cmd.id})`);

            await supabase.from('scraper_commands').update({ status: 'PROCESSING' }).eq('id', cmd.id);

            try {
                if (cmd.command === 'SEND_MESSAGE') {
                    let { to, text } = cmd.payload;
                    if (!to || !text) throw new Error('Missing to or text in payload');

                    // Resolve "me" to the bot's own ID
                    const target = to === 'me' ? client.info.wid._serialized : to;
                    console.log(`📡 Sending message to target: ${target}`);

                    await client.sendMessage(target, text);
                    console.log(`✅ Message sent to ${target}`);

                    await supabase.from('scraper_commands').update({
                        status: 'COMPLETED',
                        updated_at: new Date().toISOString()
                    }).eq('id', cmd.id);
                } else if (cmd.command === 'SYNC_GROUPS') {
                    console.log('🔄 Manual sync groups requested...');
                    await syncGroups(client);
                    await supabase.from('scraper_commands').update({
                        status: 'COMPLETED',
                        updated_at: new Date().toISOString()
                    }).eq('id', cmd.id);
                } else if (cmd.command === 'TRIGGER_SUMMARY') {
                    console.log('⚡️ Manual summary trigger requested...');
                    const scheduleId = cmd.payload?.schedule_id;

                    // Fetch schedules to trigger
                    let query = supabase.from('scheduled_summaries').select('*').eq('is_active', true);
                    if (scheduleId) {
                        query = query.eq('id', scheduleId);
                    }

                    const { data: schedules, error: schedError } = await query;

                    if (schedError) throw schedError;

                    if (!schedules || schedules.length === 0) {
                        console.log('⚠️ No matching active schedules found to trigger.');
                    } else {
                        for (const schedule of schedules) {
                            console.log(`▶️ Manually triggering schedule: ${schedule.id} (${schedule.target_name || schedule.target_id})`);
                            try {
                                const result = await generateAndSendSummaryForUser(schedule, client);
                                console.log(`✅ Manual trigger result for ${schedule.target_name}: ${result}`);
                            } catch (err) {
                                console.error(`❌ Manual trigger failed for ${schedule.target_name}:`, err);
                            }
                        }
                    }

                    await supabase.from('scraper_commands').update({
                        status: 'COMPLETED',
                        updated_at: new Date().toISOString()
                    }).eq('id', cmd.id);
                } else {
                    throw new Error(`Unknown command: ${cmd.command}`);
                }
            } catch (cmdErr) {
                console.error(`❌ Command failed for ${cmd.id}:`, cmdErr);
                await supabase.from('scraper_commands').update({
                    status: 'FAILED',
                    error: cmdErr.message || String(cmdErr),
                    updated_at: new Date().toISOString()
                }).eq('id', cmd.id);
            }
        }
    } catch (err) {
        console.error('Error in checkPendingCommands:', err);
    }
}

module.exports = { saveMessage, updateSystemStatus, checkAndSendDailySummary, checkLogoutCommand, checkPendingCommands, syncGroups, generateAndSendSummaryForUser, supabase, uploadMedia };
