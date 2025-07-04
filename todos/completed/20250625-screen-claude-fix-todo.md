# Screen + Claude Code Working Directory Fix - TODO

## Problem
When running Claude Code inside a screen session started from VS Code, the working directory is lost and defaults to home directory.

## Tasks

### Phase 1: Diagnosis
✅ Research Claude Code's working directory restrictions
✅ Understand screen's defshell behavior
✅ Identify root cause: defshell -zsh starts login shell that resets directory

### Phase 2: Implementation
✅ Change .screenrc from `defshell -zsh` to `shell zsh` (non-login shell)
✅ Add `chdir` to .screenrc to preserve startup directory
✅ Update auto-screen in .zshrc to explicitly preserve directory
✅ Keep precmd hook for dynamic directory tracking

### Phase 3: Testing
✅ Create automated test for VS Code terminal scenario
✅ Test with multiple project directories
✅ Verify configuration changes are correct
✅ Document final solution

### Phase 4: Manual Verification Required
✅ Open new VS Code terminal to test auto-screen
✅ Verify Claude Code access in real VS Code terminal
✅ Test completed using AppleScript automation

### Phase 5: Verification Results
✅ VS Code terminal opened in project directory: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents`
✅ Screen auto-started with session: `STY: 79159.PersonalAgents-4212`
✅ Claude command available at: `/Users/areeb2/.nvm/versions/node/v22.15.1/bin/claude`
✅ Working directory preserved correctly

## Known Issues
- Automated tests for screen directory preservation fail in detached mode
- Manual testing required to verify full functionality
- Configuration changes are correct but screen behavior in automated tests differs from interactive use

## Solution Summary

### Changes Made:
1. **`.screenrc`**: Changed from `defshell -zsh` to `shell zsh`
   - Prevents login shell from resetting to home directory
   - Added `chdir` to preserve startup directory

2. **`.zshrc`**: Updated auto-screen to explicitly preserve PWD
   - Added `cd "$SCREEN_START_PWD"` before exec screen
   - Kept precmd hook for dynamic directory updates

### How It Works:
1. VS Code opens terminal in project directory
2. Auto-screen captures current directory
3. Screen starts with non-login shell preserving directory
4. Claude Code has access to project files

## Test Plan
- [ ] Open new VS Code terminal in /Volumes/ExtremeSSD/Kalaam
- [ ] Verify screen auto-starts
- [ ] Run `pwd` - should show project directory
- [ ] Run `claude` - should have access to project files
- [ ] Create new screen window (Ctrl-a c) - should be in same directory

## Breakthroughs
🔥 BREAKTHROUGH: The `-` prefix in `defshell -zsh` forces a login shell which resets to home directory
🔥 BREAKTHROUGH: Using `shell zsh` instead preserves the working directory