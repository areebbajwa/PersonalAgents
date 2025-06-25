#!/bin/bash
# Trace what happens during shell startup

echo "=== TRACING SHELL STARTUP ==="
echo ""

echo "1. Testing login shell behavior:"
echo "   Current directory: $(pwd)"
echo "   Starting zsh login shell..."
echo ""

# Create a test script that traces directory changes
cat > /tmp/trace-zsh.sh << 'EOF'
#!/bin/zsh
echo "TRACE: Initial PWD: $PWD"
echo "TRACE: Loading /etc/zprofile..." >&2
[ -f /etc/zprofile ] && source /etc/zprofile
echo "TRACE: After /etc/zprofile PWD: $PWD"

echo "TRACE: Loading ~/.zprofile..." >&2
[ -f ~/.zprofile ] && source ~/.zprofile
echo "TRACE: After ~/.zprofile PWD: $PWD"

echo "TRACE: Loading ~/.zshrc..." >&2
[ -f ~/.zshrc ] && source ~/.zshrc
echo "TRACE: After ~/.zshrc PWD: $PWD"

echo "TRACE: Final PWD: $PWD"
EOF

chmod +x /tmp/trace-zsh.sh

echo "2. Running trace..."
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
/tmp/trace-zsh.sh 2>&1 | grep "TRACE:"

echo ""
echo "3. Checking for cd commands in startup files:"
echo "   In /etc/zprofile:"
sudo grep -n "cd " /etc/zprofile 2>/dev/null || echo "   (No cd commands or cannot read)"
echo ""
echo "   In ~/.zprofile:"
grep -n "cd " ~/.zprofile 2>/dev/null || echo "   (No cd commands or file doesn't exist)"
echo ""
echo "   In ~/.zshrc:"
grep -n "cd " ~/.zshrc 2>/dev/null | grep -v "^#" | head -5

echo ""
echo "4. Testing screen with different shell options:"
echo "   Testing with non-login shell..."
screen -dmS test-nonlogin zsh
sleep 1
screen -S test-nonlogin -p 0 -X stuff "pwd > /tmp/test-nonlogin-pwd.txt\n"
sleep 1
echo "   Non-login shell pwd: $(cat /tmp/test-nonlogin-pwd.txt 2>/dev/null || echo 'FAILED')"
screen -S test-nonlogin -X quit 2>/dev/null

echo ""
echo "   Testing with login shell..."
screen -dmS test-login zsh -l
sleep 1
screen -S test-login -p 0 -X stuff "pwd > /tmp/test-login-pwd.txt\n"
sleep 1
echo "   Login shell pwd: $(cat /tmp/test-login-pwd.txt 2>/dev/null || echo 'FAILED')"
screen -S test-login -X quit 2>/dev/null

# Cleanup
rm -f /tmp/trace-zsh.sh /tmp/test-*.txt

echo ""
echo "=== END TRACE ==="