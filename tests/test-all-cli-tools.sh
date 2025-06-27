#!/bin/bash

# Comprehensive test for all CLI tools
# Tests that all tools work from any directory

# Don't exit on error - we want to test all tools
set +e

echo "🧪 Comprehensive CLI Tools Test"
echo "==============================="
echo "Testing all CLI tools from different directories"
echo ""

# Save current directory
ORIGINAL_DIR=$(pwd)

# List of all CLI tools to test
CLI_TOOLS=(
    "ai-monitor-cli"
    "desktop-automation-cli"
    "firebase-cli"
    "gmail-cli"
    "google-sheets-cli"
    "openrouter-multi-model"
    "pdf-ai-cli"
    "record-cli"
    "screenshot-cli"
    "selenium-cli"
    "workflow-cli"
)

# Test statistics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_TOOLS=()

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a single tool
test_tool() {
    local tool=$1
    local test_dir=$2
    local test_name=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Check if tool exists
    local tool_path="$ORIGINAL_DIR/cli_tools/$tool/$tool"
    if [ ! -f "$tool_path" ]; then
        echo -e "${RED}✗${NC} $tool not found at $tool_path"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # Change to test directory
    cd "$test_dir"
    
    # Test help command
    if $tool_path --help >/dev/null 2>&1 || $tool_path -h >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $tool works from $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        # Some tools might not have --help, try running with no args
        if $tool_path 2>&1 | grep -qE "(Usage|usage|USAGE|Commands|commands|Options|options)" ; then
            echo -e "${GREEN}✓${NC} $tool works from $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}✗${NC} $tool failed from $test_name"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            FAILED_TOOLS+=("$tool from $test_name")
            return 1
        fi
    fi
}

# Test each tool from different directories
echo "📍 Testing from main repository..."
echo "================================="
for tool in "${CLI_TOOLS[@]}"; do
    test_tool "$tool" "$ORIGINAL_DIR" "main repo"
done

echo -e "\n📍 Testing from home directory..."
echo "================================"
for tool in "${CLI_TOOLS[@]}"; do
    test_tool "$tool" "$HOME" "home directory"
done

# Test from worktree if available
if [ -d "$ORIGINAL_DIR/worktrees" ]; then
    WORKTREE_DIR=$(find "$ORIGINAL_DIR/worktrees" -maxdepth 1 -type d | head -2 | tail -1)
    if [ -n "$WORKTREE_DIR" ] && [ "$WORKTREE_DIR" != "$ORIGINAL_DIR/worktrees" ]; then
        echo -e "\n📍 Testing from worktree..."
        echo "=========================="
        for tool in "${CLI_TOOLS[@]}"; do
            test_tool "$tool" "$WORKTREE_DIR" "worktree"
        done
    fi
fi

# Test from temp directory
TEMP_DIR=$(mktemp -d)
echo -e "\n📍 Testing from temp directory..."
echo "================================"
for tool in "${CLI_TOOLS[@]}"; do
    test_tool "$tool" "$TEMP_DIR" "temp directory"
done
rm -rf "$TEMP_DIR"

# Return to original directory
cd "$ORIGINAL_DIR"

# Summary
echo -e "\n📊 Test Summary"
echo "=============="
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}✓ Passed: $PASSED_TESTS${NC}"
echo -e "${RED}✗ Failed: $FAILED_TESTS${NC}"

if [ ${#FAILED_TOOLS[@]} -gt 0 ]; then
    echo -e "\n${RED}Failed tools:${NC}"
    for failure in "${FAILED_TOOLS[@]}"; do
        echo "  - $failure"
    done
fi

# Check specific path resolution for tools we fixed
echo -e "\n🔍 Path Resolution Verification"
echo "==============================="

# Function to check if tool uses ~/PersonalAgents symlink
check_path_resolution() {
    local tool=$1
    local file_patterns=("*.js" "*.py" "index.js" "src/*.js")
    local found_correct_path=false
    
    for pattern in "${file_patterns[@]}"; do
        local files=$(find "$ORIGINAL_DIR/cli_tools/$tool" -name "$pattern" 2>/dev/null)
        for file in $files; do
            if [ -f "$file" ]; then
                if grep -q "~/PersonalAgents\|homedir()\|HOME.*PersonalAgents" "$file" 2>/dev/null; then
                    found_correct_path=true
                    break 2
                fi
            fi
        done
    done
    
    if $found_correct_path; then
        echo -e "${GREEN}✓${NC} $tool uses ~/PersonalAgents symlink"
    else
        # Check if it's a bash-only tool or doesn't need config
        if [ -f "$ORIGINAL_DIR/cli_tools/$tool/$tool" ] && file "$ORIGINAL_DIR/cli_tools/$tool/$tool" | grep -q "shell script"; then
            local script_content=$(cat "$ORIGINAL_DIR/cli_tools/$tool/$tool")
            if ! echo "$script_content" | grep -qE "config|\.env"; then
                echo -e "${YELLOW}⚠${NC}  $tool is a shell script without config dependencies"
            else
                echo -e "${RED}✗${NC} $tool might not use ~/PersonalAgents symlink"
            fi
        else
            echo -e "${YELLOW}⚠${NC}  $tool path resolution unclear"
        fi
    fi
}

# Check the tools we specifically fixed
FIXED_TOOLS=("firebase-cli" "gmail-cli" "google-sheets-cli" "openrouter-multi-model" "pdf-ai-cli")
for tool in "${FIXED_TOOLS[@]}"; do
    check_path_resolution "$tool"
done

# Final result
echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All CLI tools work from any directory!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tools failed. Please check the failures above.${NC}"
    exit 1
fi