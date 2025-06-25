#!/bin/bash
# Debug screen's actual behavior

echo "=== DEBUGGING SCREEN BEHAVIOR ==="
echo ""

# Clean up any test screens
screen -ls | grep -E "(config-test|behavior-test)" | cut -d. -f1 | awk '{print $1}' | xargs -I {} screen -S {} -X quit 2>/dev/null

# Test 1: Check what shell screen is actually using
echo "1. Testing shell invocation..."
screen -dmS behavior-test
sleep 1

# Send command to check shell
screen -S behavior-test -p 0 -X stuff "echo \$0 > /tmp/behavior-shell.txt\n"
sleep 1
echo "   Shell type: $(cat /tmp/behavior-shell.txt 2>/dev/null || echo 'UNKNOWN')"

# Check pwd
screen -S behavior-test -p 0 -X stuff "pwd > /tmp/behavior-pwd.txt\n"
sleep 1
echo "   Working dir: $(cat /tmp/behavior-pwd.txt 2>/dev/null || echo 'UNKNOWN')"

# Check if it's a login shell
screen -S behavior-test -p 0 -X stuff "shopt -q login_shell && echo 'login' > /tmp/behavior-login.txt || echo 'non-login' > /tmp/behavior-login.txt\n"
sleep 1
echo "   Shell mode: $(cat /tmp/behavior-login.txt 2>/dev/null || echo 'UNKNOWN')"

screen -S behavior-test -X quit 2>/dev/null

# Test 2: Try with explicit directory in screen command
echo ""
echo "2. Testing with explicit directory..."
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
(cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents && screen -dmS behavior-test2)
sleep 1

screen -S behavior-test2 -p 0 -X stuff "pwd > /tmp/behavior-pwd2.txt\n"
sleep 1
echo "   Working dir: $(cat /tmp/behavior-pwd2.txt 2>/dev/null || echo 'UNKNOWN')"

screen -S behavior-test2 -X quit 2>/dev/null

# Test 3: Check screen's interpretation of our config
echo ""
echo "3. Checking screen config..."
screen -c ~/.screenrc -h | head -5 2>&1 || echo "   (screen -h doesn't show config info)"

# Cleanup
rm -f /tmp/behavior-*.txt

echo ""
echo "=== END DEBUG ==="