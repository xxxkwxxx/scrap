const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./handlers');
const { updateSystemStatus, checkAndSendDailySummary, checkLogoutCommand } = require('./store');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Helps with stability in some envs
            '--disable-gpu'
        ],
    },
    // Using a remote cache can help, but sometimes latest is better. 
    // Commenting out to retry default behavior or use a known stable if this fails.
    /*
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
    */
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to log in.');
    updateSystemStatus('QR_READY', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
    updateSystemStatus('READY');
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    updateSystemStatus('DISCONNECTED');
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    updateSystemStatus('DISCONNECTED');
    // Destroy and reinitialize logic could go here, 
    // but usually process exit is safer for specialized supervisors (PM2) to restart.
    // For local dev, we might want to just log it.
    client.initialize();
});

client.on('message_create', handleMessage);

console.log('Initializing client...');
updateSystemStatus('INIT');
client.initialize();

// Heartbeat to ensure status stays in sync
setInterval(async () => {
    try {
        // Only check if we think we're connected
        if (client.info && client.info.wid) {
            const state = await client.getState();
            if (state === 'CONNECTED') {
                console.log('💓 Heartbeat: Client connected, ensuring READY status...');
                updateSystemStatus('READY');
            } else {
                console.log('💓 Heartbeat: Client state is', state);
            }
        } else {
            console.log('💓 Heartbeat: Client NOT connected yet.');
        }
    } catch (err) {
        console.log('💓 Heartbeat: Error checking state', err.message);
    }
}, 30000); // Check every 30 seconds

// SCHEDULER (Check every minute)
setInterval(async () => {
    try {
        await checkLogoutCommand(client); // Check for logout frequently

        if (client.info && client.info.wid) {
            await checkAndSendDailySummary(client);
        }
    } catch (error) {
        console.error('⏰ Scheduler Error:', error);
    }
}, 5000); // Check every 5 seconds (Reduced from 60s to allow faster logout response)

// ERROR HANDLING
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});
