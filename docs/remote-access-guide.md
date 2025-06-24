# Complete Remote Access & Terminal Workflow Guide

## Quick Start - iOS Remote Access

### Connection Details
- **Host**: `7.tcp.ngrok.io`
- **Port**: `21775`
- **Username**: `areeb2`
- **Command**: `ssh areeb2@7.tcp.ngrok.io -p 21775`

### Start SSH Tunnel on Mac
```bash
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
./scripts/start-ssh-tunnel.sh

# Or run directly:
ngrok tcp --region=us --remote-addr=7.tcp.ngrok.io:21775 22
```

### iOS SSH Client Recommendations
1. **Termius** - User-friendly with good UI
2. **Blink Shell** - Powerful terminal emulator  
3. **Prompt** - Clean interface from Panic

## Screen Terminal Workflow

### How It Works
**On Mac:**
- Each terminal window gets its own screen session automatically
- Sessions named after current directory + unique ID (e.g., `PersonalAgents-9284`)
- Close terminal = session persists in background
- Reopen terminal = new session (old one still available)

**From iOS:**
- SSH in and see all available sessions
- Use `sa` or `sl` to list sessions
- Use `sa <partial-name>` to attach to any session

### Essential Screen Commands
- `sl` or `sa` - List all sessions (sorted by usage frequency)
- `sr` - Attach to most recent screen session
- `sa term` - Attach to session (partial match works)
- `Ctrl-a d` - Detach from session
- `sk term-XXX` - Kill a session
- `sn project1` - Create new named session

### Screen Key Bindings
- `Ctrl-a c` - Create new window
- `Ctrl-a n` - Next window
- `Ctrl-a p` - Previous window
- `Ctrl-a w` - List windows
- `Ctrl-a [0-9]` - Switch to window number

### Screen Scrolling (Critical for iOS)
1. Enter copy mode: `Ctrl-a [` or `Ctrl-a ESC`
2. Navigate with:
   - `k` or `↑` - scroll up
   - `j` or `↓` - scroll down
   - `Ctrl-b` - page up
   - `Ctrl-f` - page down
   - `g` - go to beginning
   - `G` - go to end
3. Exit copy mode: `ESC` or `q`

### Fix iPhone Scrolling Issues
Edit `~/.screenrc` and change:
```bash
# Change this:
altscreen on

# To this:
altscreen off
```
This enables natural scrolling in iOS SSH clients while preserving the 10,000 line scrollback buffer.

## Mosh Setup (Advanced)

### Why Mosh?
- Better connection persistence than SSH
- Works well with intermittent connections
- Instant local echo for typing

### Installation
```bash
# macOS
brew install mosh

# Linux/Ubuntu
sudo apt-get update && sudo apt-get install -y mosh

# CentOS/RHEL
sudo yum install -y mosh
```

### Firewall Configuration
Mosh requires UDP ports 60000-61000:
```bash
# Linux iptables
sudo iptables -I INPUT -p udp --dport 60000:61000 -j ACCEPT

# Linux ufw
sudo ufw allow 60000:61000/udp
```

### Important: Mosh + ngrok Limitation
**Mosh does NOT work with ngrok** because:
- Mosh requires UDP ports 60000-61000
- ngrok only supports TCP tunneling, not UDP

### Alternative Solutions for Persistent Connections
1. **Tailscale** (Recommended for Mosh):
   ```bash
   brew install tailscale
   tailscale up
   # Then from iOS: mosh user@your-mac-name
   ```

2. **Continue using SSH + Screen** (Current setup):
   - SSH through ngrok works perfectly
   - Screen provides session persistence
   - Use screen's copy mode for scrolling

## Complete Workflow Example

### On Mac:
1. Open Terminal in `~/projects/frontend` → Creates `frontend-1234`
2. Open Terminal in `~/projects/backend` → Creates `backend-5678`
3. Work normally in each terminal

### From iOS:
```bash
# Connect
ssh areeb2@7.tcp.ngrok.io -p 21775

# You'll see:
📺 Available screen sessions:
  frontend-1234              [Detached]
  backend-5678               [Detached]
  PersonalAgents-9284        [Attached]

# Attach to any session
sa front      # Connects to frontend-1234
sa back       # Connects to backend-5678

# Work in the session
# Use Ctrl-a [ for scrolling
# Use Ctrl-a d to detach
```

## Auto-Screen Configuration

### Default Behavior
Every terminal automatically connects to a screen session. First terminal creates "main", subsequent terminals attach to it.

### Disable Auto-Screen
```bash
# Temporarily
DISABLE_AUTO_SCREEN=1 zsh

# Permanently (add to .zshrc)
export DISABLE_AUTO_SCREEN=1
```

## Troubleshooting

### Connection Issues
- **Connection refused**: Ensure ngrok tunnel is running on Mac
- **Permission denied**: Check username and password
- **Host unreachable**: Verify Mac is online and ngrok is running

### Screen Issues
- **Can't scroll on iPhone**: Set `altscreen off` in ~/.screenrc
- **Lost in screen**: Press `Ctrl-a ?` for help
- **Session disappeared**: Use `sl` to list all sessions

### Security Considerations
- ngrok exposes SSH to internet - use strong passwords
- Consider SSH key authentication for better security
- Monitor access logs if needed
- SSH (Remote Login) must remain enabled in System Settings

## Quick Reference Card

```bash
# Start tunnel (Mac)
./scripts/start-ssh-tunnel.sh

# Connect (iOS)
ssh areeb2@7.tcp.ngrok.io -p 21775

# List sessions
sl

# Attach session
sa PersonalAgents

# Screen scrolling
Ctrl-a [  # Enter copy mode
k/j       # Up/down
ESC       # Exit

# Detach
Ctrl-a d
```