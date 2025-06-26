# Remove Auto-Screen and Simplify Screen Management - TODO

## Objective
Remove the problematic auto-screen feature and make screen commands work from any directory.

## Tasks

### Phase 1: Remove Auto-Screen
✅ Remove auto-screen functionality from .zshrc
✅ Revert .screenrc to use login shell (defshell -zsh)
✅ Keep simple screen session list on terminal start

### Phase 2: Add Quick Screen Command
✅ Create `sq` alias for quick screen in current directory
✅ Implement screen-quick script that names session after current directory
✅ Ensure it preserves the working directory properly

### Phase 3: Move to Git-Tracked Location
✅ Move all screen commands from ~/bin to cli_tools/screen-tools
✅ Update aliases in .zshrc to point to new location
✅ Create E2E tests for screen commands
✅ Verify all commands work from new location

## Solution Summary

### Changes Made:
1. **Removed auto-screen** - No more automatic screen sessions on terminal start
2. **Added `sq` command** - Quick way to start screen named after current directory
3. **Moved to cli_tools** - All screen commands now git-tracked in:
   `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/screen-tools/`

### Available Commands:
- `sq` - Quick screen in current directory (names session after dir)
- `sn` - Start new named screen session
- `sl` - List all screen sessions
- `sa` - Attach to screen session (interactive)
- `sr` - Attach to most recent screen session
- `sd` - Detach from current session
- `sk` - Kill a screen session
- `ska` - Kill all screen sessions except current

### How It Works:
1. Open terminal in any directory (e.g., VS Code terminal)
2. Run `sq` to start screen session named after that directory
3. Screen preserves the working directory
4. Claude Code has access to project files

## Tests
- All screen commands exist: ✅
- Commands accessible from any directory: ✅
- E2E tests pass: 6/6 ✅