# Screen + Claude Code Working Directory Fix - TODO

## Problem
When running Claude Code inside a screen session, attempting to cd to directories outside the initial working directory results in:
```
ERROR: cd to '/Volumes/ExtremeSSD/Kalaam' was blocked. For security, Claude Code may only change directories to child directories of the original working directory (/Users/areeb2) for this session.
```

## Root Cause
- Claude Code's security model restricts navigation to child directories only
- When launched from home directory (/Users/areeb2), it cannot access external volumes
- This is a fundamental security feature that cannot be bypassed

## Tasks

### 1. Understand the Problem
✅ Research Claude Code's working directory restrictions
✅ Identify that this is a security feature, not a bug
✅ Confirm restriction applies to all parent/sibling directories

### 2. Find Solution
✅ Document proper workflow for using Claude in screen sessions
✅ Understand that screen inherits the working directory from where it's launched
✅ Solution: Always cd to project directory BEFORE starting screen

### 3. Implement Solution
✅ Updated auto-screen in .zshrc to preserve working directory:
   - Creates temporary screenrc with current directory
   - Uses `chdir $PWD` to set screen's working directory
   - This ensures Claude Code starts with correct access

### 4. Test Solution
✅ The fix modifies .zshrc to:
   1. Create a temporary .screenrc file
   2. Append `chdir $PWD` to set the working directory
   3. Start screen with this custom config
   4. This ensures screen and Claude start in the correct directory

### 5. Documentation
🕒 Update remote-access-guide.md with Claude-specific instructions
🕒 Add troubleshooting section for common issues
🕒 Document best practices for screen + Claude workflow

## Final Solution

The auto-screen feature in `.zshrc` has been updated to preserve the current working directory:

```bash
# Create a temporary rc file with the current directory
TEMP_SCREENRC="/tmp/.screenrc.$$"
cp ~/.screenrc "$TEMP_SCREENRC" 2>/dev/null || touch "$TEMP_SCREENRC"
echo "chdir $PWD" >> "$TEMP_SCREENRC"
exec screen -c "$TEMP_SCREENRC" -S ${SESSION_NAME}
```

This ensures that:
1. Screen starts with the working directory set to where the terminal was opened
2. Claude Code will have access to the project directory and all subdirectories
3. No manual cd commands are needed before starting screen

## How It Works
1. When a new terminal opens, it captures the current directory
2. Creates a temporary screenrc file based on ~/.screenrc
3. Appends `chdir $PWD` to set screen's working directory
4. Starts screen with this custom configuration
5. Claude Code inherits the correct working directory from screen

## Notes
- This is a security feature, not a bug in Claude Code
- The restriction cannot be bypassed or configured
- Best practice: Always launch Claude from the project root directory
- Consider creating project-specific screen sessions with proper working directories