# AI Monitor Workflow Guide - Tmux + Claude Code Logs

## Overview
The AI Monitor now exclusively uses tmux for terminal management and Claude Code's native JSONL logs for monitoring. No fallbacks, no special flags - just simple, clean operation.

## Quick Start

### Complete Workflow Example

1. **Open new terminal** (automatically starts tmux session)
   ```bash
   # Terminal opens with tmux session like "PersonalAgents-5678"
   ```

2. **Start Claude**
   ```bash
   yolo my-feature
   # Starts Claude Code (workflow will create worktree)
   ```

3. **Start your workflow**
   ```bash
   workflow-cli --project my-feature --mode dev --step 1
   # Or with a task description:
   workflow-cli --project my-feature --mode dev --step 1 --task "implement OAuth2 authentication"
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
- Starts Claude Code in current directory
- If project name provided, workflow will create worktree with proper symlinks
- Claude logs are automatically saved per-project
- Note: yolo no longer creates worktrees - workflows handle that

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
✅ **Auto-Cleanup** - Old detached sessions (24+ hours) are automatically removed on shell startup  

## Common Commands

### Check tmux sessions
```bash
tmux ls
```

### Attach to existing session
```bash
tmux attach -t session-name
```

### Quick attach to most recent session
```bash
tr
```
The `tr` shortcut automatically finds and attaches to your most recently used tmux session. If you're already in a tmux session, it will tell you how to switch instead.

### Tmux window management
- Create new window: `Ctrl-b c`
- Next window: `Ctrl-b n`
- Previous window: `Ctrl-b p`
- Select window by number: `Ctrl-b 0-9`
- List all windows: `Ctrl-b w`

### Split panes in tmux
- Horizontal split: `Ctrl-b %`
- Vertical split: `Ctrl-b "`
- Navigate panes: `Ctrl-b arrow-keys`

### VSCode Terminal Configuration
If tmux shortcuts don't work in VSCode's integrated terminal (Ctrl-b is intercepted):

1. **Add to VSCode settings.json:**
   ```json
   {
     "terminal.integrated.sendKeybindingsToShell": true
   }
   ```

2. **Alternative solutions:**
   - Disable chord shortcuts: `"terminal.integrated.allowChords": false`
   - Remove conflicting VSCode keybindings (Cmd+Shift+P → "Preferences: Open Keyboard Shortcuts")
   - Use external terminal (Terminal.app or iTerm2)
   - Change tmux prefix in ~/.tmux.conf to avoid conflicts

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

## Spawning Workflows from Task Mode

Task mode can spawn independent dev mode workflows for building tools:

```bash
# From within task mode, use the spawn script:
~/PersonalAgents/scripts/spawn-workflow-with-task.sh tool-name dev "create a CLI tool that does X"

# This will:
# - Create a new tmux window with Claude
# - Start the workflow with your task description
# - Run independently while task mode continues
# - Auto-close the window when complete

# Check if spawned workflow is still running:
ls ~/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_tool-name*.json
```

The spawned workflow runs in a completely separate Claude instance, allowing task mode to continue working on other tasks in parallel.

## Migration Notes

If you're coming from the old screen-based system:
- No more `--use-claude-logs` flag (it's the only option now)
- No more terminal log files or `tlog` command needed
- Screen aliases still exist but AI monitor requires tmux
- Mouse scrolling now works in SSH sessions!
- Yolo no longer creates worktrees - workflows handle that with proper symlinks