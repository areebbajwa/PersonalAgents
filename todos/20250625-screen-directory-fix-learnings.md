# Screen Working Directory Fix - Learnings

## Problem Summary
When starting GNU Screen sessions from terminals (especially VS Code), the working directory would reset to home directory instead of preserving the current directory. This made Claude Code unable to access project files.

## Root Cause
The issue was caused by `defshell -zsh` in `.screenrc`:
- The `-` prefix starts a **login shell**
- Login shells reset to home directory as part of initialization
- This overrides any `chdir` commands in screenrc

## Failed Attempts

### 1. ❌ Using chdir in main .screenrc
```bash
chdir $PWD  # Doesn't work with login shells
defshell -zsh
```
**Why it failed**: Login shell initialization happens AFTER chdir, resetting to home

### 2. ❌ Using bash -c with cd
```bash
screen -S name bash -c "cd '$PWD' && exec $SHELL -l"
```
**Why it failed**: Complex shell invocation had issues with screen's process model

### 3. ❌ Using wrapper scripts
```bash
# Create wrapper that changes directory
echo "cd $PWD && exec $SHELL" > wrapper.sh
screen -S name ./wrapper.sh
```
**Why it failed**: Screen didn't execute the wrapper properly

### 4. ❌ Using screen eval commands
```bash
screen -dmS name
screen -S name -X eval "chdir $PWD" "screen -t bash 0 bash"
```
**Why it failed**: Complex multi-step process was fragile

### 5. ❌ Environment variables
```bash
SCREEN_START_DIR="$PWD" screen -S name
```
**Why it failed**: Environment variables don't affect screen's internal chdir

## Working Solution ✅

Create a minimal temporary screenrc with directory set:
```bash
TEMP_RC="/tmp/.screenrc-session-$$"
cat > "$TEMP_RC" << EOF
shell zsh        # Non-login shell
chdir $PWD       # Set directory BEFORE shell starts
EOF

screen -c "$TEMP_RC" -S "session-name"
```

## Why This Works
1. **Minimal config**: Only includes what's needed
2. **Non-login shell**: `shell zsh` instead of `defshell -zsh` 
3. **Order matters**: `chdir` happens before shell initialization
4. **Clean override**: `-c` option completely replaces default screenrc

## Key Learnings

### 1. Login vs Non-Login Shells
- `defshell -zsh` → login shell → resets to home
- `shell zsh` → non-login shell → preserves directory
- Login shells are meant to start fresh, not preserve state

### 2. Screen's Config Loading Order
1. Screen reads config file
2. Executes commands like `chdir`
3. Starts shell process
4. Shell initialization runs (login shells reset directory)

### 3. Debugging Techniques
- Add logging to scripts to trace execution
- Check `/tmp/` for leftover files
- Use `screen -ls` to see orphaned sessions
- Web search for specific error patterns

### 4. Simple Solutions Win
- Started with complex eval chains
- Ended with simple temp config file
- Less moving parts = more reliable

## Implementation Details

### For Auto-Screen (.zshrc)
```bash
TEMP_RC="/tmp/.screenrc-auto-${SESSION_NAME}-$$"
cat > "$TEMP_RC" << EOF
shell zsh
chdir $STARTUP_DIR
EOF
exec screen -c "$TEMP_RC" -S "${SESSION_NAME}"
```

### For Manual Commands (sq, sn)
Same approach - create temp config with current directory

### Cleanup
Temp files in `/tmp/.screenrc-*` can be cleaned periodically
They're small and get cleared on reboot

## Best Practices
1. Always test with actual use case (VS Code terminal)
2. Don't assume complex = better
3. Understand the tool's initialization order
4. Keep logs when debugging
5. Search for similar issues - this was a known problem

## References
- GNU Screen manual on chdir command
- Stack Overflow: "How can I change default directory in screen when I have defshell set to bash?"
- Understanding login vs non-login shells