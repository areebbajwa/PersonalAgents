# GNU Screen Scrolling Configuration Guide

## Overview
This guide documents the configuration changes made to enable easier scrolling in GNU Screen sessions without manually entering copy mode first.

## Problem
- Default GNU Screen requires entering copy mode (Ctrl-a [) before scrolling
- Mouse wheel scrolling doesn't work by default within screen sessions
- Native terminal scrolling (with `altscreen off`) scrolls terminal history, not screen content

## Solution: Screen Command Sequences with Auto-Exit

### Primary Shortcuts (Added to ~/.screenrc)
- **Ctrl-a k**: Scroll up by page and automatically return to normal mode
- **Ctrl-a j**: Scroll down by page and automatically return to normal mode
- **No ESC needed**: Shortcuts automatically exit copy mode after scrolling

### How to Use
1. Press and release **Ctrl-a** (screen's command key)
2. Press **k** to scroll up or **j** to scroll down
3. Screen automatically enters copy mode, scrolls, and exits

### Why This Approach Works
- Uses screen's built-in command mode (always intercepted correctly)
- Bypasses terminal and shell key processing
- Works reliably through SSH connections
- Similar to vim navigation (j/k for down/up)

### Other Shortcuts (Already configured)
- **Ctrl+Shift+Up**: Enter copy mode + page up (stays in copy mode)
- **Ctrl+Shift+Down**: Enter copy mode + page down (stays in copy mode)

### Manual Method (Always available)
- **Ctrl-a [**: Enter copy mode manually
- Use arrow keys, Page Up/Down, or vi keys (hjkl) to navigate
- **ESC or q**: Exit copy mode

## Configuration Details

The following lines were added to `~/.screenrc`:

```bash
# Screen command key bindings for scrolling (Ctrl-a followed by key)
bind j eval "copy" "stuff ^F^["  # Ctrl-a j = scroll down + auto-exit
bind k eval "copy" "stuff ^B^["  # Ctrl-a k = scroll up + auto-exit

# Alternative direct key bindings (if terminal supports)
bindkey "^[[1;5A" eval "copy" "stuff ^B^["  # Ctrl+Up = scroll up + auto-exit
bindkey "^[[1;5B" eval "copy" "stuff ^F^["  # Ctrl+Down = scroll down + auto-exit
```

## Terminal Compatibility

### Tested Terminal Emulators
- macOS Terminal.app
- iTerm2
- Most modern terminal emulators that support Option/Alt key modifiers

### Key Sequence Notes
- `bind j/k` uses screen's command mode (accessed via Ctrl-a)
- This approach is most reliable as screen intercepts Ctrl-a before any other processing
- Works consistently through SSH, different terminals, and shells
- The `^F` and `^B` in the config represent page forward/backward commands

## Testing

Use the provided test scripts:
1. `./scripts/test-screen-scroll.sh` - Creates a test screen session with scrollable content
2. `./scripts/verify-screen-shortcuts.sh` - Verifies configuration is correct

## Important Notes

1. **New Sessions Only**: Configuration changes only apply to NEW screen sessions
2. **Active Sessions**: Existing screen sessions won't have the new shortcuts
3. **Auto-Exit Feature**: Option+Up/Down shortcuts automatically return to normal mode after scrolling
4. **Rapid Scrolling**: You can press Option+Up/Down multiple times quickly for continuous scrolling

## Troubleshooting

### Shortcuts Not Working
1. Ensure you're in a new screen session (detach and create new)
2. Remember to press and release Ctrl-a first, then press j or k
3. Try the alternative Ctrl+Shift+Up/Down shortcuts
4. If Ctrl-a j/k doesn't work, verify your screen command key (might be remapped)

### Mouse Wheel Still Not Working
- Mouse wheel scrolling in screen is limited by design
- Use the keyboard shortcuts for reliable scrolling
- Consider tmux as an alternative if mouse support is critical

## Related Configuration

Other relevant settings in ~/.screenrc:
- `defscrollback 10000` - 10,000 lines of scrollback buffer
- `mousetrack on` - Basic mouse support enabled
- `altscreen on` - Preserves screen content separation