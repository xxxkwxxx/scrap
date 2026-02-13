const { saveMessage } = require('./store');

async function handleMessage(message) {
    try {
        const chat = await message.getChat();

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

        // Resolve Mentions (if any)
        try {
            const mentions = await message.getMentions();
            if (mentions && mentions.length > 0) {
                for (const mention of mentions) {
                    const mentionName = mention.pushname || mention.name || mention.shortName || mention.number;
                    const mentionId = mention.number; // The number without @c.us

                    // Replace @number with @name
                    // We use a global regex to replace all occurrences
                    const regex = new RegExp(`@${mentionId}`, 'g');
                    message.body = message.body.replace(regex, `@${mentionName}`);
                }
                console.log(`Resolved ${mentions.length} mentions in message.`);
            }
        } catch (err) {
            console.error('Error resolving mentions:', err);
        }

        console.log(`Received message from: ${senderName} (Chat: ${chat.name})`);
        await saveMessage(message, chat);

    } catch (error) {
        console.error('Error handling message:', error);
    }
}

module.exports = { handleMessage };
