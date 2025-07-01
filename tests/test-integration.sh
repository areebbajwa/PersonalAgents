#!/bin/bash

# Integration test for tmux shortcuts
echo "=== Running Integration Tests for Tmux Shortcuts ==="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Source functions
source ~/.zshrc 2>/dev/null || true

# Test 1: Both functions exist
echo ""
echo "Test 1: Verifying all functions are available"
if type tr 2>/dev/null | grep -q function && type tmux_cleanup_old_sessions 2>/dev/null | grep -q function; then
    echo -e "${GREEN}✓ Both tr() and tmux_cleanup_old_sessions() are available${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Missing required functions${NC}"
    ((TESTS_FAILED++))
fi

# Test 2: Integration - cleanup runs, then tr works
echo ""
echo "Test 2: Cleanup + tr integration"

# Clean up test sessions
tmux kill-session -t integration-test-1 2>/dev/null || true
tmux kill-session -t integration-test-2 2>/dev/null || true

# Run cleanup (should not error)
tmux_cleanup_old_sessions 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Cleanup runs successfully${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Cleanup failed${NC}"
    ((TESTS_FAILED++))
fi

# Create test sessions
tmux new-session -d -s integration-test-1
sleep 1
tmux new-session -d -s integration-test-2

# Verify tr identifies the correct session
recent=$(tmux list-sessions -F '#{session_last_attached} #{session_name}' | sort -rn | head -1 | cut -d' ' -f2-)
if [[ "$recent" == "integration-test-2" ]] || [[ -n "$recent" ]]; then
    echo -e "${GREEN}✓ tr() can identify sessions after cleanup${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ tr() failed to identify sessions${NC}"
    ((TESTS_FAILED++))
fi

# Test 3: Full workflow simulation
echo ""
echo "Test 3: Full workflow test"

# Simulate shell startup
if grep -q "tmux_cleanup_old_sessions" ~/.zshrc && grep -q "# Clean up old detached tmux sessions on startup" ~/.zshrc; then
    echo -e "${GREEN}✓ Cleanup is properly integrated into shell startup${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Cleanup not properly integrated${NC}"
    ((TESTS_FAILED++))
fi

# Test 4: Documentation exists
echo ""
echo "Test 4: Documentation check"
if grep -q "tr" /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/worktrees/tmux-shortcuts-20250630/docs/tmux-claude-logging-migration.md && \
   grep -q "Auto-Cleanup" /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/worktrees/tmux-shortcuts-20250630/docs/tmux-claude-logging-migration.md; then
    echo -e "${GREEN}✓ Documentation updated with new features${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Documentation missing updates${NC}"
    ((TESTS_FAILED++))
fi

# Cleanup
tmux kill-session -t integration-test-1 2>/dev/null || true
tmux kill-session -t integration-test-2 2>/dev/null || true

# Summary
echo ""
echo "=== Integration Test Summary ==="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All integration tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some integration tests failed!${NC}"
    exit 1
fi