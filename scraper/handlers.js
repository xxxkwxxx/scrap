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

        console.log(`Received message from: ${senderName} (Chat: ${chat.name})`);
        await saveMessage(message, chat);

    } catch (error) {
        console.error('Error handling message:', error);
    }
}

module.exports = { handleMessage };
