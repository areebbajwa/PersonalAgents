#!/bin/bash

# Test script to verify all CLI tools can run autonomously without blocking
# Exit codes: 0 = success, 1 = failure

# Don't exit on test failures - we expect some

echo "Testing CLI tools for autonomous execution..."
echo "============================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

# Function to test a command with timeout
test_command() {
    local description=$1
    local command=$2
    local timeout_seconds=${3:-5}
    
    echo -n "Testing: $description... "
    
    # Run command with timeout
    if timeout $timeout_seconds bash -c "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo -e "${RED}FAILED${NC} (timed out - blocking execution detected)"
        else
            echo -e "${RED}FAILED${NC} (exit code: $exit_code)"
        fi
        ((FAILED++))
        return 1
    fi
}

echo "1. Testing screenshot-cli..."
echo "----------------------------"
test_command "screenshot-cli fullscreen (non-interactive)" "cli_tools/screenshot-cli/screenshot-cli -o /tmp/test-fullscreen.png"
test_command "screenshot-cli with delay (non-interactive)" "cli_tools/screenshot-cli/screenshot-cli -d 2 -o /tmp/test-delay.png"
test_command "screenshot-cli list windows (non-interactive)" "cli_tools/screenshot-cli/screenshot-cli -l"
# These should fail (timeout) as they're interactive:
test_command "screenshot-cli window mode (interactive - should timeout)" "cli_tools/screenshot-cli/screenshot-cli -w -o /tmp/test-window.png" 3
test_command "screenshot-cli region mode (interactive - should timeout)" "cli_tools/screenshot-cli/screenshot-cli -r -o /tmp/test-region.png" 3

echo ""
echo "2. Testing ai-monitor-cli..."
echo "----------------------------"
# This should pass (non-blocking with --once)
test_command "ai-monitor-cli monitor --once (non-blocking)" "cli_tools/ai-monitor-cli/ai-monitor-cli monitor --once --session test-session"
# This should fail (timeout) as it's blocking:
test_command "ai-monitor-cli monitor (blocking - should timeout)" "cli_tools/ai-monitor-cli/ai-monitor-cli monitor --session test-session" 3

echo ""
echo "3. Testing other CLI tools for non-blocking execution..."
echo "-------------------------------------------------------"
test_command "browser-cli help" "cli_tools/browser-cli/browser-cli --help"
test_command "gmail-cli help" "cli_tools/gmail-cli/gmail-cli --help"
test_command "pdf-ai-cli help" "cli_tools/pdf-ai-cli/pdf-ai-cli --help"
test_command "spawn-cli list" "cli_tools/spawn-cli/spawn-cli list"
test_command "workflow-cli help" "cli_tools/workflow-cli/workflow-cli --help"
test_command "firebase-cli help" "cli_tools/firebase-cli/firebase-cli --help"
test_command "google-sheets-cli help" "cli_tools/google-sheets-cli/google-sheets-cli --help"
test_command "openrouter-multi-model help" "cli_tools/openrouter-multi-model/openrouter-multi-model --help"
test_command "desktop-automation-cli help" "cli_tools/desktop-automation-cli/desktop-automation-cli --help"
test_command "startup-manager help" "cli_tools/startup-manager/startup-manager --help"

echo ""
echo "============================================"
echo "Test Summary:"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

# Expected failures for interactive modes
EXPECTED_INTERACTIVE_FAILURES=3  # screenshot-cli -w, -r and ai-monitor-cli without --once

if [ $FAILED -eq $EXPECTED_INTERACTIVE_FAILURES ]; then
    echo -e "${GREEN}SUCCESS:${NC} All tests behaved as expected!"
    echo "- Non-interactive commands completed successfully"
    echo "- Interactive commands were correctly identified (timed out)"
    echo ""
    echo "Recommendations for autonomous execution:"
    echo "1. For screenshot-cli: Use default mode or --window-id instead of -w/-r"
    echo "2. For ai-monitor-cli: Always use --once flag for single runs"
    exit 0
else
    echo -e "${RED}FAILURE:${NC} Unexpected test results!"
    echo "Expected $EXPECTED_INTERACTIVE_FAILURES interactive mode timeouts, but got $FAILED failures total"
    exit 1
fi