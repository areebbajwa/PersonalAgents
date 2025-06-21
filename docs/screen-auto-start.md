# Screen Auto-Start Configuration

## Overview
Every terminal window (including VS Code terminals) now automatically connects to a shared screen session called "main".

## How It Works

1. **First terminal opened**: Creates a new screen session called "main"
2. **Subsequent terminals**: Automatically attach to the existing "main" session
3. **All terminals share the same session**: You see the same content in every window
4. **Multi-display mode**: Multiple terminals can be attached simultaneously

## Benefits

- **Universal access**: Same session from Mac Terminal, VS Code, or iOS SSH
- **No setup needed**: Just open a terminal and you're in screen
- **Persistent state**: Close terminals without losing your work
- **Unified workspace**: All terminals show the same session

## Usage

### Normal Operation
Just open any terminal - you're automatically in the screen session!

### Creating Additional Sessions
If you need a separate session:
```bash
sn project1    # Creates new session "project1"
```

### Switching Between Sessions
```bash
sl            # List all sessions
sa project1   # Switch to "project1" session
```

### Temporarily Disable Auto-Start
```bash
DISABLE_AUTO_SCREEN=1 zsh    # Opens terminal without screen
```

### Permanently Disable
Add to your .zshrc:
```bash
export DISABLE_AUTO_SCREEN=1
```

## Important Notes

- **Detaching**: Use `Ctrl-a d` to detach (terminal will close)
- **New window in screen**: Use `Ctrl-a c` instead of opening new terminal
- **Switch windows**: `Ctrl-a n` (next) or `Ctrl-a p` (previous)
- **Window list**: `Ctrl-a w`

## Workflow Example

1. Open Terminal/VS Code → Automatically in "main" session
2. Work on your project
3. SSH from iOS → Type `sl` → Already see "main" (Attached)
4. Just continue working - same session!

No more worrying about starting screen or finding sessions!