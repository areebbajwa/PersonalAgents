# Screen Scrolling Quick Reference

## The Problem
When using GNU Screen, you can't use your terminal's normal scrolling because Screen manages its own buffer. You must use Screen's copy mode to scroll through previous output.

## Quick Solution: Copy Mode

### Auto-Scrolling (NEW!):
- `Ctrl+Up` - Automatically enters copy mode and pages up
- `Ctrl+Down` - Automatically enters copy mode and pages down

### Manual Copy Mode (Choose one):
- `Ctrl-a [` - Traditional method
- `Ctrl-a ESC` - Alternative method

### Navigate in Copy Mode:
- **Arrow Keys**: Move line by line (↑ ↓ ← →)
- **Page Up/Down**: Move by pages
- **Vi-style**: `h` (left), `j` (down), `k` (up), `l` (right)
- **Page Navigation**: `Ctrl-b` (page up), `Ctrl-f` (page down)
- **Jump to**: `g` (top), `G` (bottom)

### Exit Copy Mode:
- `ESC` or `q`

## Mouse Wheel Scrolling

Mouse scrolling may work depending on your terminal and configuration:
1. Works best with `altscreen off` in .screenrc
2. Requires terminal support
3. May conflict with copy mode

## Common Issues & Solutions

### Issue: Can't scroll at all
**Solution**: You're not in copy mode. Press `Ctrl-a [` first.

### Issue: Scrolling shows garbage from other windows
**Solution**: This is a known Screen limitation. Use copy mode instead of terminal scrolling.

### Issue: Mobile/iOS scrolling doesn't work
**Solution**: Edit ~/.screenrc and change `altscreen on` to `altscreen off`

## Testing Your Setup

1. Start screen: `screen`
2. Generate output: `seq 1 100`
3. Try scrolling: `Ctrl-a [` then use arrow keys
4. Exit copy mode: `ESC`

## Cheat Sheet
```
Ctrl+Up     → Auto-enter copy mode + page up
Ctrl+Down   → Auto-enter copy mode + page down
Ctrl-a [    → Manually enter copy mode
↑/↓         → Scroll line by line  
PgUp/PgDn   → Scroll by pages
ESC or q    → Exit copy mode
```

Remember: **Always enter copy mode first** before trying to scroll!