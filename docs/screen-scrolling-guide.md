# GNU Screen Scrolling Configuration Guide

## Overview
This guide documents the configuration changes made to enable easier scrolling in GNU Screen sessions without manually entering copy mode first.

## Problem
- Default GNU Screen requires entering copy mode (Ctrl-a [) before scrolling
- Mouse wheel scrolling doesn't work by default within screen sessions
- Native terminal scrolling (with `altscreen off`) scrolls terminal history, not screen content

## Solution: SSH-Compatible 2-Key Shortcuts with Auto-Exit

### Primary Shortcuts (Added to ~/.screenrc)
- **Ctrl+k**: Scroll up by page and automatically return to normal mode
- **Ctrl+j**: Scroll down by page and automatically return to normal mode
- **Ctrl+p**: Alternative - scroll up (previous)
- **Ctrl+n**: Alternative - scroll down (next)
- **No ESC needed**: Shortcuts automatically exit copy mode after scrolling

### Why These Keys?
- Work reliably through SSH/terminal/screen stack
- Don't conflict with common terminal functions
- Single modifier + letter (easy 2-key combination)
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
# Ctrl+j/k for SSH-compatible page scrolling with auto-exit
bindkey "^K" eval "copy" "stuff ^B^["  # Ctrl+k = scroll up + auto-exit
bindkey "^J" eval "copy" "stuff ^F^["  # Ctrl+j = scroll down + auto-exit

# Alternative: Ctrl+p/n (previous/next)
bindkey "^P" eval "copy" "stuff ^B^["  # Ctrl+p = scroll up + auto-exit
bindkey "^N" eval "copy" "stuff ^F^["  # Ctrl+n = scroll down + auto-exit
```

## Terminal Compatibility

### Tested Terminal Emulators
- macOS Terminal.app
- iTerm2
- Most modern terminal emulators that support Option/Alt key modifiers

### Key Sequence Notes
- `^K` and `^J` are standard control sequences that work across all terminals
- These bypass terminal-specific key mappings and SSH interpretation
- Work reliably even through multiple SSH hops or different terminal emulators

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
2. Check terminal emulator's Option/Alt key handling
3. Try the alternative Ctrl+Shift+Up/Down shortcuts

### Mouse Wheel Still Not Working
- Mouse wheel scrolling in screen is limited by design
- Use the keyboard shortcuts for reliable scrolling
- Consider tmux as an alternative if mouse support is critical

## Related Configuration

Other relevant settings in ~/.screenrc:
- `defscrollback 10000` - 10,000 lines of scrollback buffer
- `mousetrack on` - Basic mouse support enabled
- `altscreen on` - Preserves screen content separation