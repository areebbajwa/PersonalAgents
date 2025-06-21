# Screen Terminal Workflow

## How It Works Now

### On Mac:
- **Each terminal window** gets its own screen session automatically
- Sessions are named after the **current directory** + unique ID
- Examples: `PersonalAgents-9284`, `frontend-1234`, `backend-5678`
- Close terminal = session persists in background
- Reopen terminal = new session (old one still available)

### From iOS:
- SSH in and see all available sessions
- Use `sa` (or `sl`) to list sessions
- Use `sa <partial-name>` to attach to any session

## Example Workflow

**On Mac:**
1. Open Terminal in `~/projects/frontend` → Creates `frontend-1234`
2. Open Terminal in `~/projects/backend` → Creates `backend-5678`  
3. Open Terminal in `~/PersonalAgents` → Creates `PersonalAgents-9284`

**From iOS:**
```bash
ssh areeb2@7.tcp.ngrok.io -p 21775

# You'll see:
📺 Available screen sessions:

  frontend-1234              [Detached]
  backend-5678               [Detached]
  PersonalAgents-9284        [Attached]

💡 Use 'sa <name>' to attach to a session

# Connect to any:
sa front      # Connects to frontend-1234
sa back       # Connects to backend-5678
sa Personal   # Connects to PersonalAgents-9284
```

## Quick Commands

- `sl` or `sa` - List all sessions
- `sa term` - Attach to session (partial match)
- `Ctrl-a d` - Detach from session
- `sk term-XXX` - Kill a session

## Benefits

- **Every terminal is persistent** - Close window, work continues
- **Access any terminal from iOS** - All sessions available
- **No confusion** - Each terminal = separate session
- **Easy switching** - Just `sa` and pick

## Tips

- Name your sessions for clarity:
  ```bash
  DISABLE_AUTO_SCREEN=1 zsh  # Skip auto
  sn frontend                # Named session
  sn backend                 # Another named session
  ```

- From iOS, you can jump between all Mac terminals:
  ```bash
  sa term-717   # Terminal 1
  Ctrl-a d      # Detach
  sa term-86B   # Terminal 2
  ```

## Disable Auto-Screen

If you want to disable automatic screen:
```bash
export DISABLE_AUTO_SCREEN=1  # Add to .zshrc
```