#!/bin/bash
# Test the shell fix

echo "=== TESTING SHELL FIX ==="
echo "Current directory: $(pwd)"
echo ""

# Kill any existing test screens
screen -ls | grep "test-shell" | cut -d. -f1 | awk '{print $1}' | xargs -I {} screen -S {}.test-shell -X quit 2>/dev/null

# Test 1: Screen from project directory
echo "Test 1: Starting screen from project directory"
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
screen -dmS test-shell-1
sleep 1

# Check initial window
screen -S test-shell-1 -p 0 -X stuff "pwd > /tmp/shell-test1.txt\n"
sleep 1
echo "Initial window pwd: $(cat /tmp/shell-test1.txt 2>/dev/null || echo 'FAILED')"

# Create new window
screen -S test-shell-1 -X screen
sleep 1
screen -S test-shell-1 -p 1 -X stuff "pwd > /tmp/shell-test2.txt\n"
sleep 1
echo "New window pwd: $(cat /tmp/shell-test2.txt 2>/dev/null || echo 'FAILED')"

# Check environment
screen -S test-shell-1 -p 0 -X stuff "echo \$0 > /tmp/shell-test3.txt\n"
sleep 1
echo "Shell type: $(cat /tmp/shell-test3.txt 2>/dev/null || echo 'FAILED')"

# Cleanup
screen -S test-shell-1 -X quit 2>/dev/null

# Test 2: Verify precmd hook
echo ""
echo "Test 2: Testing with directory change"
screen -dmS test-shell-2
sleep 1

# Change directory and create new window
screen -S test-shell-2 -p 0 -X stuff "cd cli_tools\n"
sleep 0.5
screen -S test-shell-2 -p 0 -X stuff "pwd\n"
sleep 0.5
screen -S test-shell-2 -X screen
sleep 1
screen -S test-shell-2 -p 1 -X stuff "pwd > /tmp/shell-test4.txt\n"
sleep 1
echo "New window after cd: $(cat /tmp/shell-test4.txt 2>/dev/null || echo 'FAILED')"

# Cleanup
screen -S test-shell-2 -X quit 2>/dev/null
rm -f /tmp/shell-test*.txt

echo ""
echo "=== DONE ==="
echo ""
echo "The fix should:"
echo "1. Start screen windows in the directory where screen was launched"
echo "2. Use non-login shell (zsh not -zsh)"
echo "3. Work with VS Code terminals that start in project directories"