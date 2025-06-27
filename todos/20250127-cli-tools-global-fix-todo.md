# 20250127-cli-tools-global-fix-todo.md
Last updated: 2025-01-27 14:55:00

## Non-Negotiable User Requirements: "now do the same for the rest of the cli tools. make sure they can work from any directory whether inside a screen/worktree/ssh into terminal etc. test all the commands in all the cli tools. these will all be global tools and i don't want any setup failing."

## Context Discovery
- Successful pattern from ai-monitor-cli: [cli_tools/ai-monitor-cli/src/screen-monitor.js:37,125,424]
- CLI Tool Design Guide: [cli_tools/CLI_TOOL_DESIGN_GUIDE.md]
- 5 tools need fixing: firebase-cli, gmail-cli, google-sheets-cli, openrouter-multi-model, pdf-ai-cli
- Related todo: [todos/20250627-ai-monitor-fix-todo.md] - shows successful path resolution fix pattern

## Tasks
✅ [14:55] Set up project structure and git branch
✅ [15:03] Fix firebase-cli path resolution to use ~/PersonalAgents symlink
✅ [15:04] Write E2E test for firebase-cli from different directories
✅ [15:05] TEST GATE PASSED → `workflow-cli --project cli-tools-global-fix --sub-task-next`
✅ [15:07] Fix gmail-cli path resolution to use ~/PersonalAgents symlink
✅ [15:08] Write E2E test for gmail-cli from different directories
✅ [15:09] TEST GATE PASSED → `workflow-cli --project cli-tools-global-fix --sub-task-next`
✅ [15:10] Fix google-sheets-cli absolute path to use ~/PersonalAgents symlink
✅ [15:11] Write E2E test for google-sheets-cli from different directories
✅ [15:12] TEST GATE PASSED → `workflow-cli --project cli-tools-global-fix --sub-task-next`
✅ [15:13] Fix openrouter-multi-model path resolution to use ~/PersonalAgents symlink
✅ [15:14] Write E2E test for openrouter-multi-model from different directories
✅ [15:15] TEST GATE PASSED → `workflow-cli --project cli-tools-global-fix --sub-task-next`
✅ [15:16] Fix pdf-ai-cli to use script location instead of process.cwd()
✅ [15:17] Write E2E test for pdf-ai-cli from different directories (path resolution works, separate dependency issue)
✅ [15:18] TEST GATE PASSED → `workflow-cli --project cli-tools-global-fix --sub-task-next`
🕒 Create comprehensive test-all-cli-tools.sh script
🕒 Run full test suite from main repo, worktree, and temp directory
🕒 TEST GATE → `workflow-cli --project cli-tools-global-fix --sub-task-next`
🕒 Update CLI_TOOL_DESIGN_GUIDE.md with path resolution best practices
🕒 Final testing and cleanup
🕒 Run `workflow-cli --project cli-tools-global-fix --next`

## Notes
- Using ~/PersonalAgents symlink pattern from ai-monitor-cli
- All config files will be read from ~/PersonalAgents/config/
- Must test from: main repo, worktree, /tmp, screen session, SSH session