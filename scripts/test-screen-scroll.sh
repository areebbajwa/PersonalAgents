#!/bin/bash
# Test screen scrolling behavior

echo "=== Screen Scrolling Test ==="
echo ""
echo "Current screen configuration:"
echo "----------------------------"
grep -E "(altscreen|termcapinfo|mousetrack|defscrollback)" ~/.screenrc | grep -v "^#"
echo ""

echo "Active screen sessions:"
screen -ls
echo ""

echo "Testing instructions:"
echo "1. This script will create a new screen session with test output"
echo "2. Try scrolling with your mouse wheel"
echo "3. Note if you need to enter copy mode (Ctrl-a [) first"
echo "4. Press Ctrl-a d to detach when done testing"
echo ""
echo "Press Enter to create test session..."
read

# Create a new screen session with test content
screen -S scroll-test bash -c '
    echo "=== SCROLL TEST SESSION ==="
    echo "Current settings:"
    echo "altscreen: $(grep "^altscreen" ~/.screenrc)"
    echo "termcapinfo: $(grep "^termcapinfo.*ti@:te@" ~/.screenrc)"
    echo ""
    echo "Generating test output..."
    echo ""
    
    # Generate 100 lines of test output
    for i in {1..100}; do
        echo "Line $i: This is test output to verify scrolling behavior"
    done
    
    echo ""
    echo "=== END OF TEST OUTPUT ==="
    echo ""
    echo "Test instructions:"
    echo "1. Primary shortcuts (SSH-compatible):"
    echo "   - Ctrl+k: Scroll UP by page (auto-exits copy mode)"
    echo "   - Ctrl+j: Scroll DOWN by page (auto-exits copy mode)"
    echo "2. Alternative shortcuts:"
    echo "   - Ctrl+p: Scroll UP (previous)"
    echo "   - Ctrl+n: Scroll DOWN (next)"
    echo "3. You should see the screen scroll and immediately return to normal mode"
    echo "4. Try pressing Ctrl+k multiple times quickly"
    echo "5. Manual: Press Ctrl-a [ to enter copy mode"
    echo "6. Press Ctrl-a d to detach from this session"
    echo ""
    echo "Waiting for your test..."
    
    # Keep session alive
    bash
'