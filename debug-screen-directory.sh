#!/bin/bash
# Comprehensive debugging script for screen directory issue

echo "=== SCREEN DIRECTORY DEBUG ==="
echo "Date: $(date)"
echo ""

echo "1. Current Environment:"
echo "   PWD: $PWD"
echo "   SHELL: $SHELL"
echo "   STY: $STY"
echo "   TERM_PROGRAM: $TERM_PROGRAM"
echo ""

echo "2. Shell Configuration:"
echo "   defshell in .screenrc:"
grep "defshell" ~/.screenrc | grep -v "^#"
echo ""

echo "3. Test VS Code Terminal Simulation:"
echo "   Starting from: $(pwd)"
echo ""

# Simulate VS Code starting a terminal
export TERM_PROGRAM="vscode"
STARTUP_DIR="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents"
cd "$STARTUP_DIR"

echo "4. Auto-screen Trigger Test:"
echo "   Simulating .zshrc auto-screen logic..."
echo "   Would start screen in: $PWD"
echo ""

echo "5. Screen Session Test:"
# Create a test screen session
TEST_SESSION="debug-$$"
echo "   Creating test session: $TEST_SESSION"
screen -dmS "$TEST_SESSION"
sleep 1

# Check initial directory
echo "   Checking initial directory..."
screen -S "$TEST_SESSION" -p 0 -X stuff "pwd > /tmp/debug-initial-pwd.txt\n"
sleep 1
echo "   Initial pwd: $(cat /tmp/debug-initial-pwd.txt 2>/dev/null || echo 'FAILED')"

# Check if precmd is defined
echo "   Checking if precmd is defined..."
screen -S "$TEST_SESSION" -p 0 -X stuff "type precmd > /tmp/debug-precmd.txt 2>&1\n"
sleep 1
echo "   precmd status: $(cat /tmp/debug-precmd.txt 2>/dev/null || echo 'FAILED')"

# Test chdir command
echo "   Testing screen chdir command..."
screen -S "$TEST_SESSION" -X chdir "$STARTUP_DIR"
screen -S "$TEST_SESSION" -X screen  # Create new window
sleep 1
screen -S "$TEST_SESSION" -p 1 -X stuff "pwd > /tmp/debug-chdir-pwd.txt\n"
sleep 1
echo "   New window pwd after chdir: $(cat /tmp/debug-chdir-pwd.txt 2>/dev/null || echo 'FAILED')"

# Cleanup
screen -S "$TEST_SESSION" -X quit 2>/dev/null
rm -f /tmp/debug-*.txt

echo ""
echo "6. Checking .zshrc auto-screen code:"
echo "   Line numbers where auto-screen starts:"
grep -n "Auto-start screen" ~/.zshrc
echo ""
echo "   Current auto-screen implementation:"
sed -n '/Auto-start screen/,/^fi$/p' ~/.zshrc | head -20

echo ""
echo "7. Testing Manual Screen Start:"
echo "   To test manually:"
echo "   1. cd $STARTUP_DIR"
echo "   2. screen -S manual-test"
echo "   3. pwd (should show $STARTUP_DIR)"
echo ""

echo "=== END DEBUG ==="