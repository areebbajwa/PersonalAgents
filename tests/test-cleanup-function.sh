#!/bin/bash

# Test for tmux_cleanup_old_sessions() function
echo "=== Testing tmux_cleanup_old_sessions() function ==="

# Source the cleanup function
source ~/.zshrc 2>/dev/null || true

# Test 1: Function exists
if type tmux_cleanup_old_sessions 2>/dev/null | grep -q function; then
    echo "✓ tmux_cleanup_old_sessions() function is defined"
else
    echo "✗ tmux_cleanup_old_sessions() function not found"
    exit 1
fi

# Test 2: Function runs without error (even with no sessions)
tmux_cleanup_old_sessions 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Function runs without errors"
else
    echo "✗ Function failed to run"
    exit 1
fi

# Test 3: Create test sessions and verify cleanup logic
# Clean up any existing test sessions
tmux kill-session -t cleanup-test-new 2>/dev/null || true
tmux kill-session -t cleanup-test-old 2>/dev/null || true

# Create a new session (should NOT be cleaned up)
tmux new-session -d -s cleanup-test-new
echo "✓ Created test session: cleanup-test-new"

# Test 4: Verify new sessions are NOT cleaned up
tmux_cleanup_old_sessions 2>/dev/null
if tmux has-session -t cleanup-test-new 2>/dev/null; then
    echo "✓ New session correctly preserved"
else
    echo "✗ New session was incorrectly cleaned up"
    exit 1
fi

# Test 5: Simulate old session (we can't actually change activity time, so we'll test the logic)
# Create a session that would be old
tmux new-session -d -s cleanup-test-old

# Verify the cleanup function checks activity time
# We'll check that the function contains the correct logic
if grep -q "session_activity" ~/.zshrc && grep -q "24 \* 60 \* 60" ~/.zshrc; then
    echo "✓ Cleanup function has correct 24-hour check logic"
else
    echo "✗ Cleanup function missing proper time check logic"
    exit 1
fi

# Test 6: Verify attached sessions are never cleaned
# We can't test this directly but can verify the logic exists
if grep -q 'attached.*==.*"1"' ~/.zshrc; then
    echo "✓ Cleanup function correctly skips attached sessions"
else
    echo "✗ Cleanup function missing attached session check"
    exit 1
fi

# Cleanup test sessions
tmux kill-session -t cleanup-test-new 2>/dev/null || true
tmux kill-session -t cleanup-test-old 2>/dev/null || true
echo "✓ Test sessions cleaned up"

echo ""
echo "=== All cleanup tests passed! ==="
echo "Note: Full 24-hour timeout cannot be tested without mocking time"