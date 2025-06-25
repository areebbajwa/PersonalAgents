#!/bin/bash
# Test Ctrl+Up/Down scrolling in screen

echo "=== Testing Ctrl+Up/Down Auto-Scrolling ==="
echo ""
echo "This test will verify the new Ctrl+Shift+Up/Down keybindings."
echo ""
echo "Instructions:"
echo "1. Run this script to create a test screen session"
echo "2. Try pressing Ctrl+Shift+Up to scroll up (auto-enters copy mode)"
echo "3. Try pressing Ctrl+Shift+Down to scroll down"
echo "4. Press ESC or q to exit copy mode"
echo ""
echo "Creating test session with lots of output..."

# Create a screen session with numbered output
screen -dmS ctrltest bash -c '
echo "=== SCROLL TEST OUTPUT ==="
for i in {1..200}; do
    echo "Line $i: This is test output to demonstrate scrolling"
done
echo ""
echo "=== END OF OUTPUT ==="
echo ""
echo "Now try:"
echo "- Ctrl+Shift+Up: Auto-enter copy mode and page up"
echo "- Ctrl+Shift+Down: Auto-enter copy mode and page down"
echo "- ESC or q: Exit copy mode"
echo ""
bash
'

echo ""
echo "Test session 'ctrltest' created!"
echo "Attach with: screen -r ctrltest"
echo "Exit with: Ctrl-a k"