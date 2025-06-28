#!/bin/bash

# Test selenium-cli from different directories
# Tests that the tool works from any location

set +e  # Don't exit on error

echo "🧪 Testing selenium-cli from different directories"
echo "================================================"

# Save current directory
ORIGINAL_DIR=$(pwd)
SELENIUM_CLI="$ORIGINAL_DIR/cli_tools/selenium-cli/selenium-cli"

# Test configuration
TEST_PASSED=0
TEST_FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_dir=$2
    
    echo -e "\n📍 Test: $test_name"
    echo "Directory: $test_dir"
    
    cd "$test_dir"
    
    # Test help command
    if $SELENIUM_CLI --help >/dev/null 2>&1; then
        echo "✅ Help command works"
        ((TEST_PASSED++))
    else
        echo "❌ Help command failed"
        ((TEST_FAILED++))
    fi
    
    # Test version command
    if $SELENIUM_CLI --version >/dev/null 2>&1; then
        echo "✅ Version command works"
        ((TEST_PASSED++))
    else
        echo "❌ Version command failed"
        ((TEST_FAILED++))
    fi
    
    # Test status command (should work even without browser)
    STATUS_OUTPUT=$($SELENIUM_CLI status 2>&1)
    if echo "$STATUS_OUTPUT" | grep -qE "(No active browser session|Browser is running|not running)"; then
        echo "✅ Status command works"
        ((TEST_PASSED++))
    else
        echo "❌ Status command failed"
        echo "   Output: $STATUS_OUTPUT"
        ((TEST_FAILED++))
    fi
}

# Test 1: From worktree root
run_test "Worktree Root" "$ORIGINAL_DIR"

# Test 2: From home directory
run_test "Home Directory" "$HOME"

# Test 3: From main repository
MAIN_REPO="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents"
if [ -d "$MAIN_REPO" ]; then
    run_test "Main Repository" "$MAIN_REPO"
fi

# Test 4: From temp directory
TEMP_DIR=$(mktemp -d)
run_test "Temp Directory" "$TEMP_DIR"
rm -rf "$TEMP_DIR"

# Test 5: Test all commands (without actually launching browser)
echo -e "\n📍 Test: Command Availability"
cd "$ORIGINAL_DIR"

COMMANDS=(
    "session --help"
    "launch --help"
    "navigate --help"
    "click --help"
    "type --help"
    "text --help"
    "screenshot --help"
    "export-html --help"
    "key --help"
    "hover --help"
    "double-click --help"
    "right-click --help"
    "upload --help"
    "status --help"
    "close --help"
)

echo "Testing all subcommands..."
for cmd in "${COMMANDS[@]}"; do
    if $SELENIUM_CLI $cmd >/dev/null 2>&1; then
        echo "✅ Command works: selenium-cli $cmd"
        ((TEST_PASSED++))
    else
        echo "❌ Command failed: selenium-cli $cmd"
        ((TEST_FAILED++))
    fi
done

# Return to original directory
cd "$ORIGINAL_DIR"

# Summary
echo -e "\n📊 Test Summary"
echo "=============="
echo "✅ Passed: $TEST_PASSED"
echo "❌ Failed: $TEST_FAILED"

# Exit with appropriate code
if [ $TEST_FAILED -gt 0 ]; then
    echo -e "\n❌ selenium-cli has issues!"
    exit 1
else
    echo -e "\n✅ selenium-cli works from all directories!"
    exit 0
fi