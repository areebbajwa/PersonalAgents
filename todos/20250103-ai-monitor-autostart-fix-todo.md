# 20250103-ai-monitor-autostart-fix-todo.md
Last updated: [15:15]

## Non-Negotiable User Requirements
- Fix AI monitor auto-start functionality so it automatically detects and monitors newly spawned dev/task mode sessions like dev-selenium-cli-improvements
- State file MUST be created when workflow starts
- AI monitor MUST detect spawned workflows and be able to send guidance to them automatically

## Context Discovery
- Found the root cause: When spawn-cli creates a new tmux window, workflow-cli detects the PARENT tmux session instead of the NEW window
- The tmux session detection in start_ai_monitor() happens before the spawned process has switched to its new tmux context
- This causes the AI monitor to monitor the wrong tmux session (parent instead of child)

## Tasks
🕒 [15:15] Debug tmux session detection timing issue
🕒 [15:15] Add proper tmux context detection for spawned workflows
🕒 [15:15] Write test to verify spawned workflows get correct tmux session
🕒 [15:15] TEST GATE: Run test - MUST PASS
🕒 [15:15] Mark test passed: workflow-cli --project ai-monitor-autostart-fix --sub-task-next
🕒 [15:15] Commit fix with test status: git commit -m "fix: tmux session detection for spawned workflows - tests: 1/1 passed"
🕒 [15:15] Test with real spawn-cli spawn command
🕒 [15:15] TEST GATE: Verify AI monitor auto-starts for spawned workflows
🕒 [15:15] Mark test passed: workflow-cli --project ai-monitor-autostart-fix --sub-task-next
🕒 [15:15] Clean up test workflows
🕒 [15:15] Final commit: git commit -m "test: verify AI monitor auto-start for spawned workflows - tests: 2/2 passed"
🕒 [15:15] Run workflow-cli --project ai-monitor-autostart-fix --next

## Notes
- The issue is in workflow-cli.py start_ai_monitor() method around line 456-476
- When called from a spawned workflow, it detects the parent session not the new window
- Need to ensure tmux context is properly set before detection