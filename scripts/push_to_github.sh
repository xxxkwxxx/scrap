#!/bin/bash

# Check if URL is provided
if [ -z "$1" ]; then
    echo "Usage: ./scripts/push_to_github.sh <YOUR_REPO_URL>"
    echo "Example: ./scripts/push_to_github.sh https://github.com/StartUpInc/antigravity.git"
    exit 1
fi

REPO_URL=$1

echo "Setting remote origin to: $REPO_URL"

# Remove existing origin if it exists to avoid errors
git remote remove origin 2>/dev/null

# Add new origin
git remote add origin "$REPO_URL"

# Ensure we are on main branch
git branch -M main

# Push code
echo "Pushing code to GitHub..."
git push -u origin main

echo "Done! Your code is now on GitHub."
