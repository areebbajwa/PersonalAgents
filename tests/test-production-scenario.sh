#!/bin/bash

# Production scenario test
# Tests the actual workflow-cli integration

echo "🧪 Testing AI Monitor Production Scenario"
echo "========================================"

# Create a test screen session
TEST_SESSION="prod-test-$$"
# macOS screen doesn't support -Logfile, use -L instead
screen -dmS "$TEST_SESSION" -L bash
# The log file will be created as screenlog.0 in current directory

# Give it a moment to start
sleep 1

# Start workflow with AI monitor
echo "Starting workflow with AI monitor..."
screen -S "$TEST_SESSION" -X stuff "cd $PWD && workflow-cli --project test-prod --mode dev --step 1\n"

# Wait for AI monitor to start
sleep 3

# Check if AI monitor started
if workflow-cli --project test-prod --mode dev --start-ai-monitor 2>&1 | grep -q "already running\|started"; then
    echo "✅ AI Monitor integration working"
else
    echo "❌ AI Monitor failed to start with workflow"
fi

# Test sending content to screen
echo "Testing screen interaction..."
screen -S "$TEST_SESSION" -X stuff "echo 'Test message for AI monitor'\n"
sleep 2

# Check log file
if [ -f "/tmp/screen_output_${TEST_SESSION}.log" ]; then
    echo "✅ Screen log file created"
    echo "Log contents:"
    cat "/tmp/screen_output_${TEST_SESSION}.log" | tail -10
else
    echo "❌ Screen log file not found"
fi

# Stop AI monitor
workflow-cli --stop-ai-monitor --project test-prod

# Cleanup
screen -S "$TEST_SESSION" -X quit 2>/dev/null || true

echo -e "\n✅ Production test completed"