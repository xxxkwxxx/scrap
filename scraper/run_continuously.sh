#!/bin/bash

# Define the scraper command
SCRAPER_CMD="node scraper/index.js"

# Function to run the scraper loop
run_scraper() {
    while true; do
        echo "🚀 Starting WhatsApp Scraper..."
        $SCRAPER_CMD
        
        EXIT_CODE=$?
        echo "⚠️ Scraper crashed with exit code $EXIT_CODE. Restarting in 5 seconds..."
        
        # Wait before restarting to avoid rapid looping in case of immediate failure
        sleep 5
    done
}

# Start the loop
run_scraper
