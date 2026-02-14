const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./handlers');
const { updateSystemStatus, checkAndSendDailySummary, checkLogoutCommand, checkPendingCommands, syncGroups } = require('./store');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new', // Use the modern headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-extensions',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        ],
    },
    // Locking to a very recent stable version to prevent "detached Frame" and "link failure"
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1012170065-alpha.html',
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to log in.');
    updateSystemStatus('QR_READY', qr);
});

client.on('ready', async () => {
    console.log('Client is ready!');
    console.log(`👋 Logged in as: ${client.info.pushname} (${client.info.wid._serialized})`);
    updateSystemStatus('READY');

    // Initial group sync
    await syncGroups(client);
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

console.log(`🚀 Initializing Scraper V2.2 (PID: ${process.pid}) (Stability Fix Applied)...`);
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
        // "detached Frame" and "Execution context was destroyed" are normal Puppeteer noise 
        // when WhatsApp Web reloads internal components. We silence them to keep logs clean.
        const noise = ['detached Frame', 'Execution context was destroyed', 'Target closed', 'Session closed'];
        if (!noise.some(msg => err.message.includes(msg))) {
            console.log('💓 Heartbeat: Status check issue:', err.message);
        }
    }
}, 30000); // Check every 30 seconds

// Periodic Group Sync (Every 6 hours)
setInterval(async () => {
    if (client.info && client.info.wid) {
        console.log('🔄 Periodic group sync starting...');
        await syncGroups(client);
    }
}, 6 * 60 * 60 * 1000);

// SCHEDULER (Check every minute)
setInterval(async () => {
    try {
        await checkLogoutCommand(client); // Check for logout frequently
        await checkPendingCommands(client); // Check for async commands from dashboard

        if (client.info && client.info.wid) {
            await checkAndSendDailySummary(client);
        } else {
            // Rate limit "not connected" logs to once per minute to avoid spam
            const now = Date.now();
            if (!global.lastNotConnectedLog || now - global.lastNotConnectedLog > 60000) {
                console.log('⏳ Scheduler: Client not ready/connected yet. Skipping summary check.');
                global.lastNotConnectedLog = now;
            }
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
