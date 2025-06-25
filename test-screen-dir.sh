#!/bin/bash
# Test script to verify screen working directory behavior

echo "=== Testing Screen Working Directory ==="
echo "1. Current directory: $(pwd)"
echo "2. PWD variable: $PWD"

# Test 1: Basic screen with command
echo -e "\n--- Test 1: Basic screen with cd command ---"
screen -dmS test1 bash -c "pwd > /tmp/screen-test1.txt"
sleep 1
echo "Screen test1 working dir: $(cat /tmp/screen-test1.txt 2>/dev/null || echo 'FAILED')"
screen -S test1 -X quit 2>/dev/null

# Test 2: Screen with chdir in temp config
echo -e "\n--- Test 2: Screen with chdir in config ---"
TEMP_RC="/tmp/test-screenrc"
cp ~/.screenrc "$TEMP_RC" 2>/dev/null || touch "$TEMP_RC"
echo "chdir $PWD" >> "$TEMP_RC"
screen -c "$TEMP_RC" -dmS test2 bash -c "pwd > /tmp/screen-test2.txt"
sleep 1
echo "Screen test2 working dir: $(cat /tmp/screen-test2.txt 2>/dev/null || echo 'FAILED')"
screen -S test2 -X quit 2>/dev/null
rm -f "$TEMP_RC"

# Test 3: Screen with explicit cd
echo -e "\n--- Test 3: Screen with explicit cd ---"
TEST_DIR="$PWD"
screen -dmS test3 bash -c "cd '$TEST_DIR' && pwd > /tmp/screen-test3.txt"
sleep 1
echo "Screen test3 working dir: $(cat /tmp/screen-test3.txt 2>/dev/null || echo 'FAILED')"
screen -S test3 -X quit 2>/dev/null

# Test 4: What the current .zshrc does
echo -e "\n--- Test 4: Current .zshrc approach ---"
STARTUP_DIR="$PWD"
screen -dmS test4 bash -c "cd '$STARTUP_DIR' && exec bash -c 'pwd > /tmp/screen-test4.txt'"
sleep 1
echo "Screen test4 working dir: $(cat /tmp/screen-test4.txt 2>/dev/null || echo 'FAILED')"
screen -S test4 -X quit 2>/dev/null

# Clean up
rm -f /tmp/screen-test*.txt

echo -e "\n=== Test Complete ==="