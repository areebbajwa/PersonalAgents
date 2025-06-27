#!/bin/bash

# Test google-sheets-cli from different directories
# Tests path resolution for config files

set -e

echo "🧪 Testing google-sheets-cli path resolution"
echo "=========================================="

# Save current directory
ORIGINAL_DIR=$(pwd)
SHEETS_CLI="$ORIGINAL_DIR/cli_tools/google-sheets-cli/google-sheets-cli"

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
    
    # Test help command (should work regardless of config)
    if $SHEETS_CLI --help >/dev/null 2>&1; then
        echo "✅ Help command works"
        ((TEST_PASSED++))
    else
        echo "❌ Help command failed"
        ((TEST_FAILED++))
    fi
    
    # Test read command (requires config)
    # This will fail if path resolution is broken
    # Using a fake spreadsheet ID to test path resolution
    ERROR_OUTPUT=$($SHEETS_CLI read fake-spreadsheet-id A1:B10 2>&1 || true)
    
    if echo "$ERROR_OUTPUT" | grep -q "Service account file not found"; then
        echo "❌ Path resolution failed - config not found"
        echo "   Error: $ERROR_OUTPUT"
        ((TEST_FAILED++))
    else
        # Either found config or got a different error (like invalid spreadsheet)
        echo "✅ Config file path resolved correctly"
        ((TEST_PASSED++))
    fi
}

# Test 1: From main repository
run_test "Main Repository" "$ORIGINAL_DIR"

# Test 2: From worktree
if [ -d "$ORIGINAL_DIR/worktrees" ]; then
    WORKTREE_DIR=$(find "$ORIGINAL_DIR/worktrees" -maxdepth 1 -type d | head -2 | tail -1)
    if [ -n "$WORKTREE_DIR" ] && [ "$WORKTREE_DIR" != "$ORIGINAL_DIR/worktrees" ]; then
        run_test "Worktree Directory" "$WORKTREE_DIR"
    fi
fi

# Test 3: From temp directory
TEMP_DIR=$(mktemp -d)
run_test "Temp Directory" "$TEMP_DIR"
rm -rf "$TEMP_DIR"

# Test 4: From home directory
run_test "Home Directory" "$HOME"

# Test 5: From root directory (if accessible)
if [ -w "/" ]; then
    run_test "Root Directory" "/"
else
    echo -e "\n⏭️  Skipping root directory test (no write access)"
fi

# Return to original directory
cd "$ORIGINAL_DIR"

# Summary
echo -e "\n📊 Test Summary"
echo "=============="
echo "✅ Passed: $TEST_PASSED"
echo "❌ Failed: $TEST_FAILED"

# Exit with appropriate code
if [ $TEST_FAILED -gt 0 ]; then
    echo -e "\n❌ google-sheets-cli path resolution needs fixing!"
    exit 1
else
    echo -e "\n✅ google-sheets-cli works from all directories!"
    exit 0
fi