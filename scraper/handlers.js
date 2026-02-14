const { saveMessage, supabase, uploadMedia } = require('./store');

async function handleMessage(message) {
    // 1. No longer skipping self-sent messages
    // This allows recording the full conversation context.
    const isSelf = message.fromMe;
    if (isSelf) {
        console.log(`[${new Date().toLocaleTimeString()}] Processing self-sent message (${message.id._serialized})`);
    }

    try {
        const chat = await message.getChat();

        // Log own ID for debugging session identity
        const myId = message.client.info?.wid?._serialized;
        console.log(`[${new Date().toLocaleTimeString()}] Processing message in ${chat.name}. Own ID: ${myId}`);

        // Resolve the actual sender
        let senderId = message.from;
        if (chat.isGroup && message.author) {
            senderId = message.author;
        }

        // Get Contact info for the actual sender
        const contact = await message.client.getContactById(senderId);

        // Prioritize: Pushname > Name > ShortName > Formatted Number
        const senderName = contact.pushname || contact.name || contact.shortName || contact.number || senderId;

        // Attach resolved name to message for store.js
        message._senderName = senderName;

        // Resolve Mentions (improve body by replacing @number with @name)
        try {
            // 1. Try official mentions first
            const mentions = await message.getMentions();
            const resolvedIds = new Set();

            if (mentions && mentions.length > 0) {
                console.log(`[${new Date().toLocaleTimeString()}] Found ${mentions.length} official mentions.`);
                for (const contact of mentions) {
                    const mentionId = contact.id.user;
                    // Try to find a non-numeric name
                    const nameCandidates = [contact.pushname, contact.name, contact.shortName].filter(n => n && n.trim() !== '' && !/^\d+$/.test(n));
                    const mentionName = nameCandidates.length > 0 ? nameCandidates[0] : (contact.name || contact.pushname || contact.shortName || contact.number);

                    if (mentionName && mentionName !== mentionId) {
                        const regex = new RegExp(`@${mentionId}`, 'g');
                        message.body = message.body.replace(regex, `@${mentionName}`);
                        resolvedIds.add(mentionId);
                        console.log(`✅ Resolved official mention: @${mentionId} -> @${mentionName}`);
                    } else {
                        console.log(`ℹ️ Official mention @${mentionId} could not be resolved to a name.`);
                    }
                }
            }

            // 2. Fallback: Search for @number patterns that weren't resolved (manual tags)
            const manualMatches = message.body.match(/@(\d+)/g);
            if (manualMatches) {
                console.log(`[${new Date().toLocaleTimeString()}] Found ${manualMatches.length} manual mention patterns.`);
                for (const match of manualMatches) {
                    const number = match.substring(1);
                    if (!resolvedIds.has(number)) {
                        try {
                            // First, try to get the official ID from the number (handles LIDs)
                            let resolvedId = null;
                            try {
                                const idInfo = await message.client.getNumberId(number);
                                if (idInfo) resolvedId = idInfo._serialized;
                            } catch (e) { }

                            const searchId = resolvedId || `${number}@c.us`;
                            let contact = await message.client.getContactById(searchId);

                            // Try to find a non-numeric name from the contact
                            let nameCandidates = [contact.pushname, contact.name, contact.shortName].filter(n => n && n.trim() !== '' && !/^\d+$/.test(n));
                            let mentionName = nameCandidates.length > 0 ? nameCandidates[0] : null;

                            // If still no name, and we are in a group, search participants
                            if (!mentionName && chat.isGroup) {
                                const participants = chat.participants || [];
                                const participant = participants.find(p =>
                                    p.id.user === number ||
                                    p.id._serialized === searchId ||
                                    p.id._serialized.includes(number)
                                );
                                if (participant) {
                                    console.log(`✅ Found @${number} in group participants. Fetching info...`);
                                    const pContact = await message.client.getContactById(participant.id._serialized);
                                    nameCandidates = [pContact.pushname, pContact.name, pContact.shortName].filter(n => n && n.trim() !== '' && !/^\d+$/.test(n));
                                    mentionName = nameCandidates.length > 0 ? nameCandidates[0] : null;
                                }
                            }

                            // If STILL no name, try searching Supabase as a final resort
                            if (!mentionName && supabase) {
                                console.log(`🔍 Searching Supabase history for @${number}...`);
                                try {
                                    const { data: senderMatch } = await supabase
                                        .from('messages')
                                        .select('sender')
                                        .or(`sender.ilike.%${number}%,whatsapp_id.ilike.%${number}%`)
                                        .limit(1);

                                    if (senderMatch && senderMatch.length > 0 && !/^\d+$/.test(senderMatch[0].sender)) {
                                        mentionName = senderMatch[0].sender;
                                        console.log(`✅ Found @${number} in Supabase history: ${mentionName}`);
                                    }
                                } catch (dbErr) {
                                    console.warn(`Error searching Supabase for @${number}:`, dbErr.message);
                                }
                            }

                            if (mentionName && mentionName !== number) {
                                const regex = new RegExp(`@${number}`, 'g');
                                message.body = message.body.replace(regex, `@${mentionName}`);
                                console.log(`✅ Resolved manual mention: @${number} -> @${mentionName}`);
                            } else {
                                console.log(`ℹ️ Could not find a name for manual mention: @${number}.`);
                            }
                        } catch (contactErr) {
                            console.warn(`Could not resolve contact for manual mention: ${match} - ${contactErr.message}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error resolving mentions:', err);
        }

        // --- MEDIA & CALL HANDLING ---
        let mediaUrl = null;
        if (message.hasMedia) {
            // Try to upload media
            mediaUrl = await uploadMedia(message);

            if (message.type === 'image') {
                message._processedBody = message.body ? `[IMAGE] ${message.body}` : '[IMAGE]';
                if (mediaUrl) message._processedBody += ` ${mediaUrl}`;
            } else if (message.type === 'video') {
                message._processedBody = message.body ? `[VIDEO] ${message.body}` : '[VIDEO]';
                if (mediaUrl) message._processedBody += ` ${mediaUrl}`;
            } else if (message.type === 'audio' || message.type === 'ppt') {
                message._processedBody = '[AUDIO/VOICE MESSAGE]';
                if (mediaUrl) message._processedBody += ` ${mediaUrl}`;
            } else if (message.type === 'document') {
                message._processedBody = message.body ? `[DOCUMENT] ${message.body}` : '[DOCUMENT]';
                if (mediaUrl) message._processedBody += ` ${mediaUrl}`;
            } else if (message.type === 'sticker') {
                message.body = '[STICKER]';
            }
        }

        if (message.type === 'call_log') {
            message._processedBody = '[CALL LOG]';
        } else if (message.type === 'sticker') {
            message._processedBody = '[STICKER]';
        } else if (message.type === 'e2e_notification') {
            return;
        }

        // Final fallback for empty body
        if (!message._processedBody && (!message.body || message.body.trim() === '')) {
            message._processedBody = `[EMPTY MESSAGE - TYPE: ${message.type}]`;
        }
        // -----------------------------

        // -----------------------------



        console.log(`Received message from: ${senderName} (Chat: ${chat.name})`);
        console.log(`Saving Message Body: "${message._processedBody || message.body}"`); // DEBUG LOG
        await saveMessage(message, chat, mediaUrl);

    } catch (error) {
        console.error('Error handling message:', error);
    }
}

module.exports = { handleMessage };
