#!/bin/bash

# fix_chrome_launch.sh - Fix Chrome launch issues after idle time
# This script resolves the common issue where Chrome fails to launch after 
# the computer has been idle for a long time due to orphaned processes and stale singleton locks

echo "🔧 Chrome Launch Fix - Cleaning up orphaned processes and stale locks..."

# Step 1: Kill any existing Chrome processes
echo "📋 Terminating existing Chrome processes..."
pkill -f "Google Chrome" 2>/dev/null

# Wait for processes to fully terminate
sleep 2

# Step 2: Check if any Chrome processes are still running
CHROME_PROCS=$(ps aux | grep -i "Google Chrome" | grep -v grep | wc -l)
if [ "$CHROME_PROCS" -gt 0 ]; then
    echo "⚠️  Some Chrome processes still running, force killing..."
    killall -9 "Google Chrome" 2>/dev/null
    sleep 1
fi

# Step 3: Clean up Chrome singleton files
echo "🧹 Cleaning up Chrome singleton lock files..."
CHROME_SUPPORT_DIR="$HOME/Library/Application Support/Google/Chrome"

if [ -d "$CHROME_SUPPORT_DIR" ]; then
    # Remove singleton lock files
    [ -L "$CHROME_SUPPORT_DIR/SingletonCookie" ] && rm "$CHROME_SUPPORT_DIR/SingletonCookie"
    [ -L "$CHROME_SUPPORT_DIR/SingletonLock" ] && rm "$CHROME_SUPPORT_DIR/SingletonLock"
    [ -L "$CHROME_SUPPORT_DIR/SingletonSocket" ] && rm "$CHROME_SUPPORT_DIR/SingletonSocket"
    echo "✅ Singleton lock files cleaned"
else
    echo "⚠️  Chrome support directory not found"
fi

# Step 4: Clean up temporary Chrome files
echo "🗑️  Cleaning up temporary Chrome files..."
find /var/folders -name "*Chrome*" -type d 2>/dev/null | while read dir; do
    if [ -w "$dir" ]; then
        rm -rf "$dir" 2>/dev/null
        echo "   Removed: $dir"
    fi
done

# Step 5: Reset Chrome's launchd registration if needed
echo "🔄 Checking launchd registration..."
launchctl list | grep -i chrome | while read line; do
    pid=$(echo "$line" | awk '{print $1}')
    if [ "$pid" != "-" ]; then
        service=$(echo "$line" | awk '{print $3}')
        echo "   Removing stale launchd service: $service"
        launchctl remove "$service" 2>/dev/null
    fi
done

# Step 6: Try to launch Chrome
echo "🚀 Attempting to launch Chrome..."
if open -a "Google Chrome"; then
    echo "✅ Chrome launched successfully!"
    exit 0
else
    echo "❌ Chrome launch failed. Error code: $?"
    echo "💡 You may need to restart your computer if the issue persists."
    exit 1
fi 