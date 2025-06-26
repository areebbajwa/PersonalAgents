# Screen Commands Enhancement - TODO

## Objective
Add two new screen commands:
1. `sr` - Connect to the most recent screen session
2. Enhance `sl` - List screens in order of most frequently used

## Tasks

### 1. Analyze Current Implementation
✅ Study existing screen utilities in ~/bin/
✅ Understand current screen-list implementation
✅ Check how screen sessions are tracked

### 2. Design Solution for `sr` Command
✅ Determine how to identify "most recent" screen
✅ Consider options: last attached, last created, or last active
✅ Design implementation approach

🔥 BREAKTHROUGH: Use socket file modification time (atime) to determine most recently accessed screen session

### 3. Design Solution for Enhanced `sl` Command
✅ Determine how to track screen usage frequency
✅ Design storage mechanism for usage stats
✅ Plan sorting algorithm

🔥 BREAKTHROUGH: Store usage stats in ~/.screen_usage_stats as JSON. Track attachment count and last access time per session name pattern.

### 4. Implement `sr` Command
✅ Create screen-recent script in ~/bin/
✅ Add logic to find most recent screen
✅ Handle edge cases (no screens, already attached)
✅ Add alias to ~/.zshrc

### 5. Implement Enhanced `sl` Command
✅ Create or modify screen-list to track usage
✅ Implement usage tracking mechanism
✅ Sort screens by frequency
✅ Maintain backward compatibility

🔥 BREAKTHROUGH: Enhanced sl command now sorts sessions by a combined score of usage frequency (70%) and recency (30%). Usage stats are tracked in ~/.screen_usage_stats as JSON.

### 6. Testing
✅ Test sr command with various scenarios
✅ Test enhanced sl command
✅ Verify integration with existing screen workflow

### 7. Documentation
✅ Update remote-access-guide.md if needed
✅ Add inline documentation to scripts

## Additional Tasks Completed
✅ Fixed PATH issue in screen sessions by installing claude CLI globally
✅ Updated .screenrc to use zsh as login shell with defshell -zsh
✅ Created symlink from ~/.claude/settings.json to project's mcp.json

## Notes
- Existing screen utilities are in ~/bin/
- Current aliases are defined in ~/.zshrc
- Should integrate seamlessly with auto-screen feature