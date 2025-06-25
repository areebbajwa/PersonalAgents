#!/bin/bash
# Test VS Code terminal with AppleScript

echo "=== Testing VS Code Terminal with AppleScript ==="
echo ""

# First, take a screenshot of current state
SCREENSHOT_BEFORE="/tmp/vscode-before-$$.png"
screencapture -x "$SCREENSHOT_BEFORE"
echo "Screenshot saved: $SCREENSHOT_BEFORE"

# Open VS Code if not already open
osascript -e 'tell application "Visual Studio Code" to activate'
sleep 2

# Open a new terminal in VS Code
echo "Opening new terminal in VS Code..."
osascript <<EOF
tell application "System Events"
    tell process "Code"
        keystroke "`" using control down
    end tell
end tell
EOF

sleep 3

# Type pwd command to check directory
echo "Checking current directory..."
osascript <<EOF
tell application "System Events"
    tell process "Code"
        keystroke "pwd"
        keystroke return
    end tell
end tell
EOF

sleep 2

# Check if we're in screen
echo "Checking if screen started..."
osascript <<EOF
tell application "System Events"
    tell process "Code"
        keystroke "echo 'STY:' \$STY"
        keystroke return
    end tell
end tell
EOF

sleep 2

# Test Claude command
echo "Testing Claude access..."
osascript <<EOF
tell application "System Events"
    tell process "Code"
        keystroke "which claude"
        keystroke return
    end tell
end tell
EOF

sleep 2

# Take final screenshot
SCREENSHOT_AFTER="/tmp/vscode-after-$$.png"
screencapture -x "$SCREENSHOT_AFTER"
echo "Final screenshot saved: $SCREENSHOT_AFTER"

echo ""
echo "=== Test Complete ==="
echo "Check the screenshots to verify:"
echo "1. Terminal opened in project directory (not home)"
echo "2. Screen session auto-started (STY variable set)"
echo "3. Claude command is available"
echo ""
echo "Screenshots:"
echo "  Before: $SCREENSHOT_BEFORE"
echo "  After: $SCREENSHOT_AFTER"