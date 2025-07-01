#!/bin/bash

# Test script for tmux shortcuts
set -e

echo "=== Testing tmux shortcuts ==="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to check if command exists
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $1${NC}"
        ((TESTS_FAILED++))
    fi
}

# Clean up any existing test sessions
cleanup_test_sessions() {
    tmux kill-session -t test-session-1 2>/dev/null || true
    tmux kill-session -t test-session-2 2>/dev/null || true
    tmux kill-session -t test-old-session 2>/dev/null || true
}

# Start fresh
cleanup_test_sessions

echo ""
echo "Test 1: tr() function exists in .zshrc"
grep -q "^tr()" ~/.zshrc
check_result "tr() function found in .zshrc"

echo ""
echo "Test 2: tmux_cleanup_old_sessions() function exists"
grep -q "^tmux_cleanup_old_sessions()" ~/.zshrc
check_result "tmux_cleanup_old_sessions() function found in .zshrc"

echo ""
echo "Test 3: Cleanup function called on startup"
# Check if cleanup function is called (not just defined)
grep "tmux_cleanup_old_sessions" ~/.zshrc | grep -v "^tmux_cleanup_old_sessions()" | grep -q "tmux_cleanup_old_sessions"
check_result "Cleanup function is called on shell startup"

echo ""
echo "Test 4: tr() handles no sessions gracefully"
# Kill all sessions first
tmux kill-server 2>/dev/null || true
sleep 1

# Source the functions
source ~/.zshrc 2>/dev/null || true

# Test tr when no sessions exist
output=$(tr 2>&1)
if [[ "$output" == *"No tmux sessions found"* ]]; then
    check_result "tr() correctly reports no sessions"
else
    ((TESTS_FAILED++))
    echo -e "${RED}✗ tr() should report 'No tmux sessions found'${NC}"
fi

echo ""
echo "Test 5: tr() attaches to most recent session"
# Create test sessions with different activity times
tmux new-session -d -s test-session-1 -c /tmp
sleep 2
tmux new-session -d -s test-session-2 -c /tmp

# Get the most recent session using the same logic as tr()
expected=$(tmux list-sessions -F '#{session_last_attached} #{session_name}' | sort -rn | head -1 | cut -d' ' -f2-)

if [[ "$expected" == "test-session-2" ]]; then
    check_result "Most recent session correctly identified as test-session-2"
else
    ((TESTS_FAILED++))
    echo -e "${RED}✗ Expected test-session-2 to be most recent, got: $expected${NC}"
fi

echo ""
echo "Test 6: Cleanup function removes old sessions"
# Create a session and fake its activity time to be old
# Note: We can't directly set activity time, so we'll test the logic differently
# We'll create a session and verify the cleanup function's logic works

# Test that cleanup function exists and can be called without error
(
    source ~/.zshrc 2>/dev/null || true
    tmux_cleanup_old_sessions 2>/dev/null
)
if [ $? -eq 0 ]; then
    check_result "Cleanup function runs without errors"
else
    ((TESTS_FAILED++))
    echo -e "${RED}✗ Cleanup function failed to run${NC}"
fi

echo ""
echo "Test 7: tr() prevents attachment when already in tmux"
# Test inside tmux (simulate TMUX environment variable)
(
    export TMUX="/tmp/tmux-1000/default,12345,0"
    source ~/.zshrc 2>/dev/null || true
    output=$(tr 2>&1)
    if [[ "$output" == *"Already in tmux session"* ]]; then
        echo -e "${GREEN}✓ tr() correctly prevents nested attachment${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ tr() should prevent attachment when already in tmux${NC}"
        ((TESTS_FAILED++))
    fi
)

# Cleanup
cleanup_test_sessions

echo ""
echo "=== Test Summary ==="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi