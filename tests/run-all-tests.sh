#!/bin/bash

# Run all tmux shortcuts tests
echo "=== Running All Tmux Shortcuts Tests ==="
echo ""

TOTAL_PASSED=0
TOTAL_FAILED=0

# Run each test
for test in test-tr-function.sh test-cleanup-function.sh test-integration.sh; do
    echo "Running $test..."
    if /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/worktrees/tmux-shortcuts-20250630/tests/$test; then
        ((TOTAL_PASSED++))
    else
        ((TOTAL_FAILED++))
    fi
    echo ""
done

echo "=== FINAL TEST SUMMARY ==="
echo "Test suites passed: $TOTAL_PASSED"
echo "Test suites failed: $TOTAL_FAILED"

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "\033[0;32mAll test suites passed!\033[0m"
    exit 0
else
    echo -e "\033[0;31mSome test suites failed!\033[0m"
    exit 1
fi