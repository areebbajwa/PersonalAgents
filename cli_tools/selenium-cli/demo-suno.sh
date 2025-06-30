#!/bin/bash

echo "=== Selenium CLI Suno.com Demo ==="
echo "This demonstrates the working selenium-cli functionality"
echo ""

# Clean up any existing sessions
echo "Cleaning up existing sessions..."
killall firefox 2>/dev/null || true
pkill -f selenium-cli 2>/dev/null || true  
rm -f ~/.selenium-cli-sessions/*.json

sleep 2

echo ""
echo "1. Navigating to Suno.com..."
selenium-cli navigate https://suno.com

echo ""
echo "2. Waiting for page to load..."
sleep 10

echo ""
echo "3. Taking screenshot of home page..."
selenium-cli screenshot

echo ""
echo "4. Navigating to create page..."
selenium-cli navigate https://suno.com/create

echo ""
echo "5. Waiting for create page to load..."
sleep 8

echo ""
echo "6. Taking screenshot of create page..."
SCREENSHOT=$(selenium-cli screenshot 2>&1 | grep "Path:" | cut -d' ' -f2)
echo "Screenshot saved to: $SCREENSHOT"

echo ""
echo "7. Checking session status..."
selenium-cli status

echo ""
echo "=== Demo Complete ==="
echo ""
echo "Key features demonstrated:"
echo "✅ Navigation to URLs"
echo "✅ Automatic browser launch"
echo "✅ Firefox profile usage (maintains login)"
echo "✅ Screenshot capture"
echo "✅ Session persistence between commands"
echo ""
echo "Known limitations:"
echo "⚠️  Complex CSS selectors may cause session crashes"
echo "⚠️  Type command may have stability issues"
echo ""
echo "Working commands:"
echo "- selenium-cli navigate <url>"
echo "- selenium-cli screenshot"
echo "- selenium-cli status"
echo "- selenium-cli close"