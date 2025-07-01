#!/bin/bash
# Test manual workflow: YOLO → workflow-cli without --project

echo "Testing manual workflow..."
echo "Current directory: $(pwd)"
echo

# Show that we're in a worktree
echo "Detected worktree project name:"
python3 -c "
import os
from pathlib import Path
cwd = Path.cwd()
cwd_str = str(cwd)
if '/worktrees/' in cwd_str:
    worktree_parent = cwd_str.split('/worktrees/')[1]
    project = worktree_parent.split('/')[0]
    print(f'  {project}')
"

echo
echo "Running workflow-cli without --project..."
/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/workflow-cli/workflow-cli.py --mode dev --step 1 --no-auto-monitor 2>&1 | head -5

echo
echo "Checking created state file..."
ls -la ~/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_yolo-workflow-fix-20250701.json 2>/dev/null && echo "✅ State file created with auto-detected project name!" || echo "❌ State file not found"

echo
echo "Cleaning up test state file..."
rm -f ~/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_yolo-workflow-fix-20250701.json