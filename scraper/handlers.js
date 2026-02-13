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

        // Resolve Mentions (improve body by replacing @number with @name)
        try {
            const mentionMatches = message.body.match(/@\d+/g);
            if (mentionMatches) {
                for (const mentionStr of mentionMatches) {
                    const number = mentionStr.substring(1);
                    const contactId = `${number}@c.us`;
                    try {
                        const mentionedContact = await message.client.getContactById(contactId);
                        const mentionName = mentionedContact.pushname || mentionedContact.name || mentionedContact.shortName || number;
                        const regex = new RegExp(mentionStr, 'g');
                        message.body = message.body.replace(regex, `@${mentionName}`);
                        console.log(`Resolved mention: ${mentionStr} -> @${mentionName}`);
                    } catch (contactErr) {
                        console.warn(`Could not resolve contact for mention: ${mentionStr}`);
                    }
                }
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
