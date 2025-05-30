#!/bin/bash

# Setup Global CLI Tools
# This script creates symlinks from ~/.local/bin/ to this project's CLI tools
# Automatically discovers all executable CLI tools in cli_tools/ subdirectories

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_TOOLS_DIR="$PROJECT_ROOT/cli_tools"
GLOBAL_BIN_DIR="$HOME/.local/bin"

echo "Setting up global CLI tools..."
echo "🔍 Auto-discovering CLI tools in $CLI_TOOLS_DIR"

# Create global bin directory if it doesn't exist
if [ ! -d "$GLOBAL_BIN_DIR" ]; then
    echo "Creating global bin directory: $GLOBAL_BIN_DIR"
    mkdir -p "$GLOBAL_BIN_DIR"
fi

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "⚠️  WARNING: $HOME/.local/bin is not in your PATH!"
    echo "Add this line to your shell profile (.bashrc, .zshrc, etc.):"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
fi

# Auto-discover CLI tools by finding executable files in cli_tools subdirectories
echo "📂 Scanning for CLI tools..."
total_tools=0
successful_tools=0

# Find only direct executable files in each cli_tools subdirectory (not in nested dirs like node_modules)
for tool_dir in "$CLI_TOOLS_DIR"/*/; do
    [ -d "$tool_dir" ] || continue
    
    tool_name=$(basename "$tool_dir")
    echo "🔍 Checking $tool_name..."
    
    # Look for executable files directly in the tool directory (not in subdirectories)
    for executable_file in "$tool_dir"*; do
        [ -f "$executable_file" ] || continue
        [ -x "$executable_file" ] || continue
        
        filename=$(basename "$executable_file")
        
        # Skip common non-CLI files
        case "$filename" in
            *.md|*.txt|*.json|*.js|*.py|*.toml|*.lock|*.log|.*|package*|Cargo*|README*|node_modules|src|target|tmp) 
                continue ;;
        esac
        
        echo ""
        echo "🔧 Processing $tool_name/$filename..."
        
        source_file="$executable_file"
        target_file="$GLOBAL_BIN_DIR/$filename"
        
        # Remove existing symlink or file if it exists
        if [ -L "$target_file" ] || [ -f "$target_file" ]; then
            echo "  🔄 Removing existing symlink/file: $target_file"
            rm "$target_file"
        fi
        
        # Create symlink
        echo "  🔗 Creating symlink: $target_file -> $source_file"
        ln -sf "$source_file" "$target_file"
        
        # Verify symlink was created successfully
        if [ -L "$target_file" ]; then
            echo "  ✅ $filename is now globally available"
            ((successful_tools++))
        else
            echo "  ❌ Failed to create symlink for $filename"
        fi
        
        ((total_tools++))
    done
done

echo ""
echo "🎯 Global CLI tools setup summary:"
echo "📁 CLI tools directory: $CLI_TOOLS_DIR"
echo "🔗 Global bin directory: $GLOBAL_BIN_DIR"
echo "📊 Discovered: $total_tools tools, Successfully linked: $successful_tools tools"
echo ""
echo "Available commands:"

# List all successfully created symlinks
for symlink in "$GLOBAL_BIN_DIR"/*; do
    if [ -L "$symlink" ] && [[ "$(readlink "$symlink")" == "$CLI_TOOLS_DIR"* ]]; then
        tool_name=$(basename "$symlink")
        echo "  ✅ $tool_name"
    fi
done

echo ""
echo "💡 Usage examples:"
echo "  Use 'toolname --help' to see capabilities for any tool"
echo "  All tools work from any directory globally"
echo ""
echo "🔄 To discover new tools, just run this script again!"
echo "🔍 To see all CLI tools: find cli_tools/ -maxdepth 2 -type f -perm +111 -not -path '*/node_modules/*' -not -path '*/src/*' -not -path '*/target/*'" 