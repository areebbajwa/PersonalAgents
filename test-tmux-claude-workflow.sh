#!/bin/bash
# Test script for tmux + Claude Code logging workflow

echo "🧪 Testing Tmux + Claude Code Workflow Implementation"
echo "===================================================="

# Test 1: Check if tmux is installed
echo -e "\n1️⃣ Checking tmux installation..."
if command -v tmux &> /dev/null; then
    echo "✅ tmux is installed: $(tmux -V)"
else
    echo "❌ tmux is not installed. Please run: brew install tmux"
    exit 1
fi

# Test 2: Check tmux configuration
echo -e "\n2️⃣ Checking tmux configuration..."
if [[ -f ~/.tmux.conf ]]; then
    echo "✅ ~/.tmux.conf exists"
    grep -q "set -g mouse on" ~/.tmux.conf && echo "✅ Mouse support configured" || echo "❌ Mouse support not found"
else
    echo "❌ ~/.tmux.conf not found"
fi

# Test 3: Check zshrc modifications
echo -e "\n3️⃣ Checking .zshrc modifications..."
if grep -q "DISABLE_AUTO_TMUX" ~/.zshrc; then
    echo "✅ Tmux auto-start code found in .zshrc"
else
    echo "❌ Tmux auto-start code not found in .zshrc"
fi

if grep -q "yolo()" ~/.zshrc; then
    echo "✅ Enhanced yolo function found"
else
    echo "❌ Enhanced yolo function not found"
fi

# Test 4: Test yolo function (dry run)
echo -e "\n4️⃣ Testing yolo function (dry run)..."
echo "Would execute: yolo test-project"
echo "Expected behavior:"
echo "  - Create worktree: worktrees/test-project-$(date +%Y%m%d)"
echo "  - Change to worktree directory"
echo "  - Start Claude Code"

# Test 5: Check AI monitor modifications
echo -e "\n5️⃣ Checking AI monitor modifications..."
MONITOR_FILE="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/ai-monitor-cli/src/screen-monitor.js"
if [[ -f "$MONITOR_FILE" ]]; then
    echo "✅ screen-monitor.js exists"
    grep -q "useClaudeLogs" "$MONITOR_FILE" && echo "✅ useClaudeLogs option found" || echo "❌ useClaudeLogs option not found"
    grep -q "readClaudeLogs" "$MONITOR_FILE" && echo "✅ readClaudeLogs method found" || echo "❌ readClaudeLogs method not found"
    grep -q "tmux send-keys" "$MONITOR_FILE" && echo "✅ tmux injection support found" || echo "❌ tmux injection support not found"
else
    echo "❌ screen-monitor.js not found"
fi

# Test 6: Check workflow files
echo -e "\n6️⃣ Checking workflow files..."
DEV_MODE="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/workflow-cli/workflows/dev-mode.yaml"
if grep -q "if_in_worktree" "$DEV_MODE" 2>/dev/null; then
    echo "✅ dev-mode.yaml updated for worktree handling"
else
    echo "❌ dev-mode.yaml not updated"
fi

# Test 7: Test Claude log directory detection
echo -e "\n7️⃣ Testing Claude log directory detection..."
CLAUDE_DIR="$HOME/.claude/projects"
if [[ -d "$CLAUDE_DIR" ]]; then
    echo "✅ Claude projects directory exists"
    echo "   Found $(find "$CLAUDE_DIR" -name "*.jsonl" 2>/dev/null | wc -l) JSONL files"
else
    echo "⚠️  Claude projects directory not found (normal if Claude hasn't been run yet)"
fi

# Test 8: Syntax check
echo -e "\n8️⃣ Checking JavaScript syntax..."
if command -v node &> /dev/null; then
    node -c "$MONITOR_FILE" 2>/dev/null && echo "✅ screen-monitor.js syntax is valid" || echo "❌ screen-monitor.js has syntax errors"
else
    echo "⚠️  Node.js not found, skipping syntax check"
fi

echo -e "\n📊 Test Summary"
echo "==============="
echo "Run this script to verify all components are properly configured."
echo "After verification, test the actual workflow:"
echo "  1. Open a new terminal (should start tmux)"
echo "  2. Run: yolo test-project"
echo "  3. Start workflow: workflow-cli --project test-project --mode dev --step 1"
echo "  4. In another pane: ai-monitor-cli monitor --project test-project --session <tmux-session> --use-claude-logs"