# AI Monitor Workflow Guide - Tmux + Claude Code Logs

## Overview
The AI Monitor now exclusively uses tmux for terminal management and Claude Code's native JSONL logs for monitoring. No fallbacks, no special flags - just simple, clean operation.

## Quick Start

### Complete Workflow Example

1. **Open new terminal** (automatically starts tmux session)
   ```bash
   # Terminal opens with tmux session like "PersonalAgents-5678"
   ```

2. **Start Claude with worktree**
   ```bash
   yolo my-feature
   # Creates worktree: worktrees/my-feature-20250630
   # Changes to worktree directory
   # Starts Claude Code
   ```

3. **Start your workflow**
   ```bash
   workflow-cli --project my-feature --mode dev --step 1
   ```

4. **AI Monitor starts automatically!**
   ```bash
   # No need to do anything - AI Monitor auto-starts with workflow
   # To manually control:
   workflow-cli --stop-ai-monitor   # Stop monitoring
   workflow-cli --start-ai-monitor  # Start monitoring
   ```

That's it! The AI Monitor will:
- Read Claude Code's clean JSONL logs
- Check workflow compliance every minute
- Inject guidance directly into your tmux session when needed

## How It Works

### 1. Terminal Auto-Start
When you open a terminal, it automatically:
- Creates a tmux session named after your directory
- Adds a unique ID to prevent conflicts
- Example: Working in `/PersonalAgents` creates session `PersonalAgents-5678`

### 2. YOLO Command
```bash
yolo [project-name]
```
- Creates a git worktree for isolation
- Changes to the worktree directory
- Starts Claude Code
- Claude logs are automatically saved per-project

### 3. AI Monitor
- **Auto-starts** when you run a workflow!
- **Auto-detects** project, mode, and tmux session
- **Zero configuration** - just use these commands:
  ```bash
  workflow-cli --start-ai-monitor  # Start (auto-detects everything)
  workflow-cli --stop-ai-monitor   # Stop (auto-detects project)
  ```
- Reads Claude Code JSONL logs (no terminal parsing needed!)
- Monitors your workflow compliance
- Sends guidance via tmux when violations detected
- Reminds you of workflow rules every 10 minutes

## Key Benefits

✅ **Clean Logs** - Claude JSONL has no terminal control characters  
✅ **Better Scrolling** - Tmux supports mouse scrolling (great for SSH)  
✅ **Per-Project Isolation** - Each worktree gets separate logs  
✅ **Simple Commands** - No special flags or fallback options  

## Common Commands

### Check tmux sessions
```bash
tmux ls
```

### Attach to existing session
```bash
tmux attach -t session-name
```

### Split panes in tmux
- Horizontal split: `Ctrl-b %`
- Vertical split: `Ctrl-b "`
- Navigate panes: `Ctrl-b arrow-keys`

### Kill tmux session
```bash
tmux kill-session -t session-name
```

## Troubleshooting

**"Tmux session name is required"**
- You must provide the session name with `-s` or `--session`
- Use `tmux ls` to find your session name

**"No recent Claude Code logs"**
- Make sure you're running Claude in a worktree
- Claude needs to be actively running to generate logs

**Guidance not appearing**
- Verify tmux session name is correct
- Check that tmux session is still active

## Example Full Session

```bash
# That's it! Just these 3 commands:
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
yolo fix-auth-bug
workflow-cli --project fix-auth-bug --mode dev --step 1

# AI Monitor starts automatically!
# To control it:
workflow-cli --stop-ai-monitor   # Stop
workflow-cli --start-ai-monitor  # Restart
```

## Migration Notes

If you're coming from the old screen-based system:
- No more `--use-claude-logs` flag (it's the only option now)
- No more terminal log files or `tlog` command needed
- Screen aliases still exist but AI monitor requires tmux
- Mouse scrolling now works in SSH sessions!