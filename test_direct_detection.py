#!/usr/bin/env python3
"""Direct test of project detection in workflow-cli context"""

import os
import sys
from pathlib import Path

# Test from current directory
print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {__file__}")

# Simulate the detection logic
cwd = Path.cwd()
cwd_str = str(cwd)
project = None

if '/worktrees/' in cwd_str:
    try:
        worktree_parent = cwd_str.split('/worktrees/')[1]
        project = worktree_parent.split('/')[0]
        print(f"✅ Auto-detected project: {project}")
    except IndexError:
        print("❌ Failed to parse worktree path")
else:
    print("❌ Not in a worktree directory")

# Test what workflow-cli would do
if project:
    safe_project = ''.join(c for c in project if c.isalnum() or c in '-_').lower()
    state_file = f"workflow_state_{safe_project}.json"
    print(f"State file would be: {state_file}")
else:
    print("State file would be: workflow_state_default.json")