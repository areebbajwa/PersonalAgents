#!/bin/bash

# Real-world test for ai-monitor-cli
# This test simulates actual workflow usage with screen sessions

set -e

echo "🧪 AI Monitor Real-World Test"
echo "============================="

# Test configuration
TEST_PROJECT="real-world-test"
TEST_MODE="dev"
TEST_DIR=$(mktemp -d)
SCREEN_SESSION="ai-monitor-test-$$"
MONITOR_PID=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    # Kill monitor if running
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    # Kill screen session
    screen -S "$SCREEN_SESSION" -X quit 2>/dev/null || true
    
    # Remove test directory
    rm -rf "$TEST_DIR"
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set trap for cleanup
trap cleanup EXIT

# Function to check if process is running
is_running() {
    kill -0 $1 2>/dev/null
}

# Function to wait for log content
wait_for_log() {
    local log_file=$1
    local search_text=$2
    local timeout=${3:-30}
    local count=0
    
    echo -n "Waiting for '$search_text' in log..."
    while [ $count -lt $timeout ]; do
        if grep -q "$search_text" "$log_file" 2>/dev/null; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo -e " ${RED}✗ (timeout)${NC}"
    return 1
}

echo "Test directory: $TEST_DIR"
cd "$TEST_DIR"

# Step 1: Create a test screen session with logging
echo -e "\n${YELLOW}Step 1: Creating screen session${NC}"
screen -dmS "$SCREEN_SESSION" -L -Logfile "/tmp/screen_output_${SCREEN_SESSION}.log" bash
sleep 1

# Verify screen session exists
if ! screen -ls | grep -q "$SCREEN_SESSION"; then
    echo -e "${RED}Failed to create screen session${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Screen session created: $SCREEN_SESSION${NC}"

# Step 2: Start AI Monitor in background
echo -e "\n${YELLOW}Step 2: Starting AI Monitor${NC}"
AI_MONITOR_LOG="$TEST_DIR/ai-monitor.log"

# Start monitor with real settings
nohup ai-monitor-cli monitor \
    --project "$TEST_PROJECT" \
    --mode "$TEST_MODE" \
    --screen-session "$SCREEN_SESSION" \
    --interval 5 \
    > "$AI_MONITOR_LOG" 2>&1 &

MONITOR_PID=$!
sleep 2

# Verify monitor is running
if ! is_running $MONITOR_PID; then
    echo -e "${RED}AI Monitor failed to start${NC}"
    cat "$AI_MONITOR_LOG"
    exit 1
fi
echo -e "${GREEN}✓ AI Monitor started (PID: $MONITOR_PID)${NC}"

# Step 3: Simulate workflow violations
echo -e "\n${YELLOW}Step 3: Testing violation detection${NC}"

# Test 3a: Normal workflow start
echo -e "\n  ${YELLOW}3a: Simulating normal workflow start${NC}"
screen -S "$SCREEN_SESSION" -X stuff "echo 'Starting new development task...'\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "echo 'Running tests...'\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "echo 'All tests passed'\n"
sleep 6  # Wait for monitor cycle

# Check if no violation was detected
if grep -q "ai-monitor:" "$AI_MONITOR_LOG"; then
    echo -e "  ${YELLOW}⚠ Guidance sent (might be remind-rules)${NC}"
else
    echo -e "  ${GREEN}✓ No violation detected for clean output${NC}"
fi

# Test 3b: Simulate failing tests violation
echo -e "\n  ${YELLOW}3b: Simulating failing tests violation${NC}"
screen -S "$SCREEN_SESSION" -X stuff "npm test\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "FAIL src/index.test.js\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "  ✕ should return true (5ms)\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "Test Suites: 1 failed, 1 total\n"
sleep 1
screen -S "$SCREEN_SESSION" -X stuff "echo 'Continuing with implementation anyway...'\n"
sleep 6  # Wait for monitor cycle

# Check if violation was detected
if wait_for_log "$AI_MONITOR_LOG" "ai-monitor:.*violation" 10; then
    echo -e "  ${GREEN}✓ Violation detected for failing tests${NC}"
else
    echo -e "  ${RED}✗ Failed to detect violation for failing tests${NC}"
fi

# Test 3c: Test remind-rules timing
echo -e "\n  ${YELLOW}3c: Testing remind-rules timing${NC}"
# Clear log to check for new remind-rules
echo "" > "$AI_MONITOR_LOG"

# Should not see remind-rules immediately
sleep 10
if grep -q "remind-rules" "$AI_MONITOR_LOG"; then
    echo -e "  ${RED}✗ Remind-rules sent too early${NC}"
else
    echo -e "  ${GREEN}✓ No premature remind-rules${NC}"
fi

# Step 4: Test path independence
echo -e "\n${YELLOW}Step 4: Testing path independence${NC}"

# Change to different directory
cd /tmp

# Send command from different path
screen -S "$SCREEN_SESSION" -X stuff "echo 'Testing from /tmp directory'\n"
sleep 6

# Check if monitor still works
if tail -n 20 "$AI_MONITOR_LOG" | grep -q "Testing from /tmp directory"; then
    echo -e "${GREEN}✓ Monitor works from different directory${NC}"
else
    echo -e "${RED}✗ Monitor failed from different directory${NC}"
fi

# Step 5: Check gemini logs
echo -e "\n${YELLOW}Step 5: Checking Gemini logs${NC}"

# Find ai-monitor-cli installation
AI_MONITOR_DIR=$(dirname $(which ai-monitor-cli))/../lib/node_modules/ai-monitor-cli
if [ ! -d "$AI_MONITOR_DIR" ]; then
    # Try local installation
    AI_MONITOR_DIR="$(pwd)/cli_tools/ai-monitor-cli"
fi

GEMINI_LOG_DIR="$AI_MONITOR_DIR/logs/gemini"
if [ -d "$GEMINI_LOG_DIR" ]; then
    GEMINI_LOGS=$(find "$GEMINI_LOG_DIR" -name "gemini-${TEST_PROJECT}-*.json" -mmin -5 | wc -l)
    if [ $GEMINI_LOGS -gt 0 ]; then
        echo -e "${GREEN}✓ Found $GEMINI_LOGS Gemini log files${NC}"
        
        # Check log format
        LATEST_LOG=$(find "$GEMINI_LOG_DIR" -name "gemini-${TEST_PROJECT}-*.json" -mmin -5 | head -1)
        if [ ! -z "$LATEST_LOG" ]; then
            if jq -e '.prompt.terminal | type == "array"' "$LATEST_LOG" >/dev/null 2>&1; then
                echo -e "${GREEN}✓ Gemini logs properly formatted with arrays${NC}"
            else
                echo -e "${RED}✗ Gemini logs not properly formatted${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ No Gemini logs found (API key might not be set)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Gemini log directory not found${NC}"
fi

# Step 6: Test monitor-all command
echo -e "\n${YELLOW}Step 6: Testing monitor-all command${NC}"

# Run monitor-all briefly
timeout 5 ai-monitor-cli monitor-all || true

echo -e "${GREEN}✓ monitor-all command executed${NC}"

# Final summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Screen session: $SCREEN_SESSION"
echo "Monitor PID: $MONITOR_PID"
echo "Test completed successfully"

# Show last few lines of monitor log
echo -e "\n${YELLOW}Last monitor log entries:${NC}"
tail -n 10 "$AI_MONITOR_LOG"

exit 0