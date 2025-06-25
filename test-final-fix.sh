#!/bin/bash
# Test if the fix works

echo "=== TESTING FINAL FIX ==="
echo "Current directory: $(pwd)"
echo ""

# Test 1: Basic screen session
echo "Test 1: Basic screen session"
screen -dmS fix-test
sleep 1
screen -S fix-test -p 0 -X stuff "pwd > /tmp/fix-test-pwd.txt\n"
sleep 1
echo "Result: $(cat /tmp/fix-test-pwd.txt 2>/dev/null || echo 'FAILED')"
screen -S fix-test -X quit 2>/dev/null

# Test 2: Screen with chdir
echo ""
echo "Test 2: Screen with chdir"
screen -dmS fix-test2
sleep 0.5
screen -S fix-test2 -X chdir "$(pwd)"
screen -S fix-test2 -X screen  # New window
sleep 0.5
screen -S fix-test2 -p 1 -X stuff "pwd > /tmp/fix-test2-pwd.txt\n"
sleep 1
echo "New window result: $(cat /tmp/fix-test2-pwd.txt 2>/dev/null || echo 'FAILED')"
screen -S fix-test2 -X quit 2>/dev/null

# Test 3: Simulate auto-screen
echo ""
echo "Test 3: Simulating auto-screen from VS Code"
STARTUP_DIR="$(pwd)"
SESSION_NAME="test-vscode-$$"
echo "Starting screen session '$SESSION_NAME' from $STARTUP_DIR"
exec screen -S "$SESSION_NAME" << EOF
pwd > /tmp/fix-test3-pwd.txt
exit
EOF

echo "Auto-screen result: $(cat /tmp/fix-test3-pwd.txt 2>/dev/null || echo 'Check manually')"

# Cleanup
rm -f /tmp/fix-test*.txt

echo ""
echo "=== DONE ==="
echo ""
echo "To verify manually:"
echo "1. Open a new VS Code terminal in a project directory"
echo "2. It should auto-start screen AND preserve the directory"
echo "3. Run 'pwd' to confirm"