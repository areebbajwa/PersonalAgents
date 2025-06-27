#!/bin/bash
# Verify screen scrolling shortcuts

echo "=== Screen Scrolling Configuration Verification ==="
echo ""

# Check if screen is installed
if ! command -v screen &> /dev/null; then
    echo "ERROR: GNU Screen is not installed"
    exit 1
fi

# Check screenrc exists
if [ ! -f ~/.screenrc ]; then
    echo "ERROR: ~/.screenrc not found"
    exit 1
fi

echo "✓ GNU Screen is installed"
echo "✓ ~/.screenrc configuration found"
echo ""

echo "Configured shortcuts in ~/.screenrc:"
echo "-----------------------------------"
grep -E "bindkey.*eval.*copy.*stuff" ~/.screenrc | grep -v "^#" | while read line; do
    if echo "$line" | grep -q "1;9A.*Option.*Up"; then
        echo "✓ Option+Up: Auto-enter copy mode + page up"
    elif echo "$line" | grep -q "1;9B.*Option.*Down"; then
        echo "✓ Option+Down: Auto-enter copy mode + page down"
    elif echo "$line" | grep -q "1;6A.*Ctrl.*Shift.*Up"; then
        echo "✓ Ctrl+Shift+Up: Auto-enter copy mode + page up"
    elif echo "$line" | grep -q "1;6B.*Ctrl.*Shift.*Down"; then
        echo "✓ Ctrl+Shift+Down: Auto-enter copy mode + page down"
    fi
done
echo ""

echo "Other relevant settings:"
echo "-----------------------"
echo -n "• Scrollback buffer: "
grep "^defscrollback" ~/.screenrc | awk '{print $2 " lines"}'
echo -n "• Mouse support: "
grep "^mousetrack" ~/.screenrc | awk '{print $2}'
echo -n "• Alternate screen: "
grep "^altscreen" ~/.screenrc | awk '{print $2}'
echo ""

echo "How to use the new shortcuts:"
echo "----------------------------"
echo "1. Option+Up     : Scroll up by page and auto-exit copy mode"
echo "2. Option+Down   : Scroll down by page and auto-exit copy mode"
echo "3. No need to press ESC - automatically returns to normal mode!"
echo ""
echo "Alternative shortcuts:"
echo "• Ctrl+Shift+Up/Down : Also works for page scrolling"
echo "• Ctrl-a [           : Manual copy mode entry"
echo ""

echo "Testing:"
echo "--------"
echo "To test these shortcuts:"
echo "1. Open a new terminal window (shortcuts require reload)"
echo "2. Run: ./scripts/test-screen-scroll.sh"
echo "3. Try the Option+Up/Down shortcuts"
echo ""

# Check if we need to reload screen config
if screen -ls | grep -q "Attached"; then
    echo "⚠️  Note: You have active screen sessions. The new shortcuts will only"
    echo "   work in NEW screen sessions. Detach (Ctrl-a d) and reattach to test."
fi

echo ""
echo "✓ Configuration complete!"