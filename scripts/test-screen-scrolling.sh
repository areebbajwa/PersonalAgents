#!/bin/bash
# Test script for screen scrolling functionality

echo "=== Screen Scrolling Test Script ==="
echo ""
echo "This script will help you test screen's scrolling features."
echo ""
echo "INSTRUCTIONS:"
echo "1. Start a new screen session: screen -S scrolltest"
echo "2. Generate some output to scroll through:"
echo "   - Run: seq 1 100"
echo "   - Or: ls -la /"
echo ""
echo "3. Test COPY MODE scrolling:"
echo "   - Press Ctrl-a then [ (or Ctrl-a then ESC)"
echo "   - You should see 'Copy mode' indicator"
echo "   - Use arrow keys, Page Up/Down to scroll"
echo "   - Press ESC or q to exit copy mode"
echo ""
echo "4. Test MOUSE scrolling (if terminal supports it):"
echo "   - Try scrolling with mouse wheel"
echo "   - This works best with 'altscreen off' setting"
echo ""
echo "5. Exit screen: Ctrl-a then k (kill window)"
echo ""
echo "Press Enter to continue..."
read

# Create a test screen session with some output
screen -dmS scrolltest bash -c 'seq 1 100; echo ""; echo "Test complete. Try scrolling up to see all numbers."; echo "Enter copy mode with Ctrl-a ["; bash'

echo "Test screen session created: 'scrolltest'"
echo "Attach to it with: screen -r scrolltest"
echo ""
echo "Remember:"
echo "- Ctrl-a [ : Enter copy mode for scrolling"
echo "- ESC or q : Exit copy mode"
echo "- Ctrl-a k : Kill the screen session when done"