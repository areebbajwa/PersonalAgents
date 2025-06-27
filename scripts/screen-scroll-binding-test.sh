#!/bin/bash
# Test different screen key binding methods

echo "=== Testing Screen Key Bindings ==="
echo ""
echo "Current .screenrc bindings:"
echo "--------------------------"
echo "1. Ctrl-a j  : Scroll down and exit copy mode"
echo "2. Ctrl-a k  : Scroll up and exit copy mode"
echo "3. Ctrl-a J  : Alternative scroll down"
echo "4. Ctrl-a K  : Alternative scroll up"
echo "5. Ctrl+Up   : Direct scroll up"
echo "6. Ctrl+Down : Direct scroll down"
echo ""

# Check if we're in a screen session
if [ -z "$STY" ]; then
    echo "⚠️  Not in a screen session. Starting one..."
    screen -S binding-test bash -c '
        echo "=== INSIDE SCREEN SESSION ==="
        echo ""
        echo "Generating test output..."
        for i in {1..100}; do
            echo "Line $i: Test output for scrolling verification"
        done
        echo ""
        echo "=== KEY BINDING TESTS ==="
        echo ""
        echo "Try these key combinations:"
        echo "1. Ctrl-a j    : Should scroll down one page"
        echo "2. Ctrl-a k    : Should scroll up one page"
        echo "3. Ctrl+Up/Down: Alternative if available"
        echo ""
        echo "Press Ctrl-a d to detach when done"
        bash
    '
else
    echo "✓ Already in screen session: $STY"
    echo ""
    echo "Try the key combinations above"
fi