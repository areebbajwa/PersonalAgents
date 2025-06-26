# Complete GNU Screen & Remote Access Guide

## Quick Start

### SSH Remote Access
```bash
ssh areeb2@7.tcp.ngrok.io -p 21775
```

### Essential Commands
- `sr` - Attach to most recent screen session
- `sl` - List all screen sessions
- `sa [name]` - Attach to specific session (partial match works)
- `sn [name]` - Create new named session
- `Ctrl-a d` - Detach from current session

## Screen Configuration

### Auto-Features
1. **Auto-Sessions**: Every terminal creates a screen session automatically
2. **Auto-Logging**: All sessions log to `~/.screen-logs/`
3. **Auto-Naming**: Sessions named after current directory (e.g., `PersonalAgents-1234`)

### Disable Auto-Screen
```bash
# Temporarily
DISABLE_AUTO_SCREEN=1 zsh

# Permanently (add to .zshrc)
export DISABLE_AUTO_SCREEN=1
```

## Scrolling in Screen

### Quick Methods
1. **Auto-Scrolling** (Recommended):
   - `Ctrl+Shift+Up` - Auto-enter copy mode + page up
   - `Ctrl+Shift+Down` - Auto-enter copy mode + page down

2. **Manual Copy Mode**:
   - `Ctrl-a [` or `Ctrl-a ESC` - Enter copy mode
   - Navigate with arrow keys, PgUp/PgDn, or vi keys (hjkl)
   - `ESC` or `q` - Exit copy mode

### iOS/Mobile Scrolling Fix
Edit `~/.screenrc` and change:
```bash
altscreen off  # Enables natural scrolling on mobile
```

## Screen Commands Reference

### Session Management
- `sl` - List sessions with status
- `sr` - Attach to most recent
- `sa [name]` - Attach to session
- `sn [name]` - New session
- `sk [name]` - Kill session
- `sd` - Detach current session
- `sq` - Quick session in current directory

### Window Management
- `Ctrl-a c` - Create new window
- `Ctrl-a n/p` - Next/previous window
- `Ctrl-a [0-9]` - Switch to window number
- `Ctrl-a "` - Window list
- `Ctrl-a A` - Rename window
- `Ctrl-a k` - Kill window

### Copy & Paste
- `Ctrl-a [` - Enter copy mode
- `Space` - Start selection (in copy mode)
- `Enter` - Copy selection
- `Ctrl-a ]` - Paste

### Logging
- `screen-log-view` - View session logs
- `screen-log-view -f` - Follow latest log
- `screen-log-view -l` - List all logs
- `screen-log-cleanup` - Clean old logs (30+ days)

## Remote Access Setup

### ngrok SSH Tunnel
The system uses ngrok for SSH access from anywhere:
- **Fixed address**: `7.tcp.ngrok.io:21775`
- **Auto-starts on boot** via LaunchAgent
- **Logs**: `~/Library/Logs/ngrok-ssh.log`

### Manage Tunnel
```bash
# Check status
~/manage-ngrok-tunnel.sh status

# Restart if needed
~/manage-ngrok-tunnel.sh restart

# View logs
~/manage-ngrok-tunnel.sh logs
```

### iOS SSH Clients
1. **Termius** - User-friendly, good UI
2. **Blink Shell** - Powerful, mosh support
3. **Prompt** - Clean interface

## Workflow Examples

### Local Mac Usage
```bash
# Terminal 1: Frontend work
cd ~/projects/frontend
# Auto-creates: frontend-1234

# Terminal 2: Backend work  
cd ~/projects/backend
# Auto-creates: backend-5678

# List all sessions
sl
```

### Remote iOS Access
```bash
# Connect
ssh areeb2@7.tcp.ngrok.io -p 21775

# See available sessions
📺 Available screen sessions:
  frontend-1234    [Detached]
  backend-5678     [Detached]

# Attach to frontend
sa front

# Work and scroll with Ctrl+Shift+Up/Down
# Detach with Ctrl-a d
```

## Troubleshooting

### SSH Issues
- **"Operation not permitted"**: Screen tools work from `~/screen-tools-local/` for SSH
- **Connection refused**: Check ngrok is running with `~/manage-ngrok-tunnel.sh status`
- **Command not found**: PATH includes `~/bin` via `.zshenv`

### Screen Issues
- **Can't scroll**: Enter copy mode first with `Ctrl-a [` or use `Ctrl+Shift+Up/Down`
- **Lost session**: Use `sl` to find it
- **Wrong bash version**: Uses bash 3.2 compatible scripts

### Logs & Debugging
- Screen logs: `~/.screen-logs/`
- ngrok logs: `~/Library/Logs/ngrok-ssh.log`
- Session usage stats: `~/.screen_usage_stats`

## Configuration Files

### Key Files
- `~/.screenrc` - Screen configuration with logging, scrollback, keybindings
- `~/.zshrc` - Auto-screen setup, aliases
- `~/.zshenv` - PATH configuration for SSH
- `~/screen-tools-local/` - Local copy of tools for SSH access
- `~/bin/` - Symlinks to screen commands

### Features Enabled
- 10,000 line scrollback buffer
- UTF-8 support
- 256 color support
- Vi-style navigation in copy mode
- Mouse support (when compatible)
- Auto-logging with timestamps
- Activity monitoring

## Quick Reference Card

```bash
# Connect remotely
ssh areeb2@7.tcp.ngrok.io -p 21775

# Session commands
sr              # Recent session
sl              # List all
sa proj         # Attach to "proj*"
sn mywork       # New "mywork" session
Ctrl-a d        # Detach

# Scrolling
Ctrl+Shift+Up   # Page up (auto copy mode)
Ctrl+Shift+Down # Page down (auto copy mode)
Ctrl-a [        # Manual copy mode
ESC             # Exit copy mode

# Windows
Ctrl-a c        # New window
Ctrl-a n/p      # Next/previous
Ctrl-a 0-9      # Switch to number

# Logs
screen-log-view -f  # Follow current log
screen-log-view -l  # List all logs
```