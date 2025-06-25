#!/bin/bash
# E2E test for screen commands

echo "=== E2E TEST: Screen Commands ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

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
        echo "  Expected to contain: $expected"
        echo "  Got: $result"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Clean up any test screens first
screen -ls | grep "e2e-test" | cut -d. -f1 | awk '{print $1}' | xargs -I {} screen -S {}.e2e-test -X quit 2>/dev/null

# Test 1: screen-list command exists and runs
run_test "screen-list exists" \
    "test -x '$SCRIPT_DIR/screen-list' && echo 'exists'" \
    "exists"

# Test 2: screen-new command exists
run_test "screen-new exists" \
    "test -x '$SCRIPT_DIR/screen-new' && echo 'exists'" \
    "exists"

# Test 3: All main commands exist
run_test "screen-kill exists" \
    "test -x '$SCRIPT_DIR/screen-kill' && echo 'exists'" \
    "exists"

# Test 4: screen-attach works
screen -dmS e2e-test-attach
sleep 0.5
run_test "screen-attach lists available session" \
    "$SCRIPT_DIR/screen-attach 2>&1 | grep 'e2e-test-attach'" \
    "e2e-test-attach"
screen -S e2e-test-attach -X quit 2>/dev/null

# Test 5: screen-recent exists
run_test "screen-recent exists" \
    "test -x '$SCRIPT_DIR/screen-recent' && echo 'exists'" \
    "exists"

# Test 6: screen-quick exists
run_test "screen-quick exists" \
    "test -x '$SCRIPT_DIR/screen-quick' && echo 'exists'" \
    "exists"

# Clean up
rm -f /tmp/e2e-quick-pwd.txt

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