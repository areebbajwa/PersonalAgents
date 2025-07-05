# 20250105-monitor-test-todo.md

## Non-Negotiable User Requirements: "print hello world every 20 seconds for 1 minute"

## Context Discovery
- Similar timer implementations found in:
  - Bash scripts with sleep loops: scripts/chrome_health_monitor.sh:60
  - JavaScript with setInterval: cli_tools/workflow/src/monitor-worker.js:45
- Key pattern: while loop with sleep command for simple bash timing

## Tasks
✅ [15:54] Research existing timer/loop implementations in the codebase
🕒 Create a simple bash script that prints hello world every 20 seconds for 1 minute
🕒 Test the script to ensure it runs correctly
🕒 Run workflow continue monitor-test

## Notes
- Will use bash with sleep command for simplicity
- Total runtime: 1 minute with 3 prints (at 0s, 20s, 40s)