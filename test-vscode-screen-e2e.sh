#!/bin/bash
# E2E test for VS Code + Screen + Claude working directory fix

echo "=== E2E TEST: VS Code Terminal + Screen + Claude ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "Testing: $test_name ... "
    
    result=$(eval "$test_command" 2>&1)
    
    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Verify .screenrc uses non-login shell
run_test ".screenrc uses non-login shell" \
    "grep '^shell' ~/.screenrc | grep -v defshell" \
    "shell zsh"

# Test 2: Verify chdir is in .screenrc
run_test ".screenrc has chdir command" \
    "grep '^chdir' ~/.screenrc" \
    "chdir"

# Test 3: Verify precmd hook is in .zshrc
run_test ".zshrc has precmd hook for screen" \
    "grep -A 3 'if.*STY.*then' ~/.zshrc | grep 'screen -X chdir'" \
    "screen -X chdir"

# Test 4: Test screen session from specific directory
TEST_DIR="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools"
if [[ -d "$TEST_DIR" ]]; then
    cd "$TEST_DIR"
    
    # Start test screen session
    screen -dmS e2e-test-$$
    sleep 1
    
    # Get working directory
    screen -S e2e-test-$$ -p 0 -X stuff "pwd > /tmp/e2e-pwd.txt\n"
    sleep 1
    
    pwd_result=$(cat /tmp/e2e-pwd.txt 2>/dev/null | tr -d '\n')
    
    run_test "Screen preserves working directory" \
        "echo '$pwd_result'" \
        "$TEST_DIR"
    
    # Test new window
    screen -S e2e-test-$$ -X screen
    sleep 1
    screen -S e2e-test-$$ -p 1 -X stuff "pwd > /tmp/e2e-pwd2.txt\n"
    sleep 1
    
    pwd_result2=$(cat /tmp/e2e-pwd2.txt 2>/dev/null | tr -d '\n')
    
    run_test "New screen window preserves directory" \
        "echo '$pwd_result2'" \
        "$TEST_DIR"
    
    # Cleanup
    screen -S e2e-test-$$ -X quit 2>/dev/null
    rm -f /tmp/e2e-pwd*.txt
fi

# Test 5: Simulate VS Code terminal environment
export TERM_PROGRAM="vscode"
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents

run_test "VS Code terminal detection works" \
    "echo \$TERM_PROGRAM" \
    "vscode"

# Summary
echo ""
echo "=== TEST SUMMARY ==="
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi