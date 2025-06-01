#!/bin/bash

# Setup Global Cursor Rules
# This script creates a symlink from ~/.cursor/rules/ to this project's rules

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RULES_FILE="$PROJECT_ROOT/.cursor/rules/dev-mode.mdc"
GLOBAL_RULES_DIR="$HOME/.cursor/rules"
GLOBAL_RULES_FILE="$GLOBAL_RULES_DIR/dev-mode.mdc"

echo "Setting up global Cursor rules..."

# Create global rules directory if it doesn't exist
if [ ! -d "$GLOBAL_RULES_DIR" ]; then
    echo "Creating global rules directory: $GLOBAL_RULES_DIR"
    mkdir -p "$GLOBAL_RULES_DIR"
fi

# Check if the project rules file exists
if [ ! -f "$RULES_FILE" ]; then
    echo "Error: Rules file not found at $RULES_FILE"
    exit 1
fi

# Remove existing symlink or file if it exists
if [ -L "$GLOBAL_RULES_FILE" ] || [ -f "$GLOBAL_RULES_FILE" ]; then
    echo "Removing existing global rules file/symlink"
    rm "$GLOBAL_RULES_FILE"
fi

# Create symlink
echo "Creating symlink: $GLOBAL_RULES_FILE -> $RULES_FILE"
ln -sf "$RULES_FILE" "$GLOBAL_RULES_FILE"

# Verify symlink was created successfully
if [ -L "$GLOBAL_RULES_FILE" ]; then
    echo "✅ Global Cursor rules setup complete!"
    echo "📁 Project rules: $RULES_FILE"
    echo "🔗 Global symlink: $GLOBAL_RULES_FILE"
    echo ""
    echo "Your development rules are now accessible globally and tracked in git."
    echo "Any updates to the rules file will be automatically available globally."
else
    echo "❌ Failed to create symlink"
    exit 1
fi 