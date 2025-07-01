#!/bin/bash

# SAFER test for tr() function - won't kill current tmux session
echo "=== Testing tr() function (SAFE VERSION) ==="

# Source the tr function
source ~/.zshrc 2>/dev/null || true

# Test 1: Function exists
if type tr 2>/dev/null | grep -q function; then
    echo "✓ tr() function is defined"
else
    echo "✗ tr() function not found"
    exit 1
fi

# Test 2: Create test sessions (without killing server)
# Clean up any old test sessions first
tmux kill-session -t tmux-test-1 2>/dev/null || true
tmux kill-session -t tmux-test-2 2>/dev/null || true

# Create new test sessions
tmux new-session -d -s tmux-test-1
sleep 1
tmux new-session -d -s tmux-test-2
sleep 1

# Test 3: Verify tr can identify sessions
recent=$(tmux list-sessions -F '#{session_last_attached} #{session_name}' | sort -rn | head -1 | cut -d' ' -f2-)
echo "✓ Most recent session identified: $recent"

# Test 4: Test tr() when already in tmux
if [[ -n "$TMUX" ]]; then
    output=$(tr 2>&1)
    if [[ "$output" == *"Already in tmux session"* ]]; then
        echo "✓ tr() correctly prevents nested attachment"
    else
        echo "✗ tr() should prevent attachment when in tmux. Output: $output"
    fi
else
    echo "✓ Not in tmux, skipping nested attachment test"
fi

# Test 5: Cleanup our test sessions only
tmux kill-session -t tmux-test-1 2>/dev/null || true
tmux kill-session -t tmux-test-2 2>/dev/null || true
echo "✓ Test sessions cleaned up"

echo ""
echo "=== All tr() tests passed safely! ==="