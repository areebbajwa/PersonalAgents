# 20250128-ai-monitor-feed-todo.md
Last updated: [10:45]

## Non-Negotiable User Requirements:
- Modify ai monitor to simply be a running feed of updates anytime the ai monitor provides feedback on anything
- I just want one line per update
- Prefix it with time and project name followed by exactly what the issue was and what the feedback was
- Show a list of all active projects at the top, one per line
- Don't divide updates by project
- Just show a long running feed in chronological order

## Context Discovery
- Found ai-monitor-cli at cli_tools/ai-monitor-cli/src/index.js
- Current monitor-all command shows grouped display by project
- Need to simplify to chronological feed format
- NotificationManager already provides getRecentNotifications method

## Tasks
- ✅ [10:45] Modify monitor-all command to show simple chronological feed
- ✅ [10:46] Add active projects list at top (one per line)
- ✅ [10:46] Format updates as: [HH:MM:SS] [ProjectName] Issue: <issue> | Feedback: <feedback>
- ✅ [10:47] Test the new feed display with multiple projects
- ✅ [10:47] Commit changes with test status
- ✅ [10:48] Create new devmode workflow yaml for ai-monitor-feed (already using devmode workflow)
- ✅ [10:48] Start the new devmode workflow (already started)
- ✅ [10:49] Run workflow-cli --project ai-monitor-feed --next

## Notes
- Keep implementation simple - just reformat existing data
- Reuse existing notification infrastructure
- One line per update for clarity

## Final Status
✅ ALL REQUIREMENTS MET - Successfully implemented chronological feed format for AI Monitor