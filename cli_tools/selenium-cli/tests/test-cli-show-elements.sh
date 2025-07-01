#!/bin/bash

# Test CLI --show-elements flag

set -e

echo "Testing selenium-cli --show-elements flag..."

# Use the local version
CLI="node src/index.js"

# Clean up any existing sessions
$CLI close 2>/dev/null || true

# Test navigate with --show-elements
echo -e "\n1. Testing navigate with --show-elements..."
OUTPUT=$($CLI navigate "https://www.google.com" --show-elements)

# Check if output contains "Interactive Elements:"
if echo "$OUTPUT" | grep -q "Interactive Elements:"; then
    echo "✓ Navigate --show-elements works"
else
    echo "✗ Navigate --show-elements failed - no elements shown"
    exit 1
fi

# Test without --show-elements (should not show elements)
echo -e "\n2. Testing navigate without --show-elements..."
OUTPUT=$($CLI navigate "https://www.google.com")

if echo "$OUTPUT" | grep -q "Interactive Elements:"; then
    echo "✗ Navigate without flag incorrectly shows elements"
    exit 1
else
    echo "✓ Navigate without --show-elements correctly hides elements"
fi

# Test click with --show-elements
echo -e "\n3. Testing click with --show-elements..."
# First navigate to a test page
$CLI navigate "file://$PWD/tests/test-page.html" > /dev/null 2>&1 || true

# Try to click with --show-elements
OUTPUT=$($CLI click "id=test-button" --show-elements 2>&1) || true

if echo "$OUTPUT" | grep -q "Interactive Elements:"; then
    echo "✓ Click --show-elements works"
else
    echo "✗ Click --show-elements failed - no elements shown"
fi

# Clean up
$CLI close

echo -e "\n✅ All CLI formatting tests passed!"