const { spawn } = require('child_process');
const path = require('path');

// Define the scraper command
const SCRAPER_SCRIPT = path.join(__dirname, 'index.js');

function runScraper() {
    console.log('🚀 Starting WhatsApp Scraper...');

    // Spawn the scraper process
    // We wrap the path in quotes to handle spaces in directory names
    // Pre-cleanup: Kill any orphaned scraper processes to avoid session locks / duplicates
    const pkillPrefix = 'pkill -f "node .*scraper/index.js" || true';
    const scraper = spawn(`${pkillPrefix} && node`, [`"${SCRAPER_SCRIPT}"`], {
        stdio: 'inherit', // Pipe output to parent
        shell: true       // Use shell for compatibility
    });

    scraper.on('close', (code) => {
        console.log(`⚠️ Scraper exited with code ${code}. Restarting in 5 seconds...`);
        setTimeout(runScraper, 5000);
    });

    scraper.on('error', (err) => {
        console.error('❌ Failed to start scraper:', err);
        setTimeout(runScraper, 5000);
    });
}

// Start the loop
runScraper();
