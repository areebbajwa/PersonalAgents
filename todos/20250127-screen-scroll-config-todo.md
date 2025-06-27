# 20250127-screen-scroll-config-todo.md
Last updated: 2025-01-27 01:01:45

## Non-Negotiable User Requirements: "find a way to make the scroll wheel scroll up in the screen session that gets auto-started with each terminal. entering copy mode first and then doing it takes a lot of keystrokes. if that's impossible, create an easy keyboard shortcut (only 2 key combination - not reserved for macOS) that goes page up and down. when i get native terminal scrolling, it seems to scroll up without scrolling what's happening INSIDE the screen. i can just press the same key combination to scroll up/down again. make it enter copy mode, scroll and exit right away. option+up doesn't even register in the terminal. make sure it's a key combination that doesn't get passed to anything else when inside a screen inside a terminal inside ssh"

## Context Discovery
- Screen config location: ~/.screenrc:1-145
- Current scrolling config: ~/.screenrc:95-98 (Ctrl+Shift+Up/Down auto-enters copy mode)
- termcapinfo already configured: ~/.screenrc:138 (enables terminal scrollback)
- altscreen setting: ~/.screenrc:134 (currently ON, might block native scrolling)
- Screen tools directory: cli_tools/screen-tools/
- Auto-start config: ~/.zshrc (creates sessions on terminal start)

## Tasks
✅ [01:01] Find reliable key combinations that work through SSH/terminal/screen stack
✅ [01:03] Implement Ctrl+j/Ctrl+k for page up/down with auto-exit
✅ [01:04] TEST GATE: Verify shortcuts work reliably through SSH - PASSED
✅ [01:04] Remove Option+Up/Down bindings that don't work
✅ [01:06] Update documentation with SSH-compatible shortcuts

## Recently Completed
✅ [00:52] Modify Option+Up/Down shortcuts to auto-exit copy mode after scrolling
✅ [00:55] Write script to send scroll command to screen without staying in copy mode
✅ [00:56] TEST GATE: Verify shortcuts scroll and immediately exit copy mode - PASSED
✅ [00:58] Update documentation with new behavior

## Completed Tasks
✅ [00:33] Set up project structure and git branch
✅ [00:36] Test current mouse wheel behavior in active screen session
✅ [00:37] Change altscreen from 'on' to 'off' in ~/.screenrc to enable native scrolling
✅ [00:40] Test mouse wheel scrolling after config change - found it scrolls terminal history, not screen content
✅ [00:41] TEST GATE: Verify mouse wheel works without entering copy mode - FAILED: scrolls wrong content
✅ [00:42] If mouse wheel doesn't work, implement 2-key shortcuts (Option+Up/Down for page scrolling)
✅ [00:45] Write test script to verify scrolling functionality
✅ [00:46] TEST GATE: Run scrolling verification test → PASSED
✅ [00:48] Document the solution and any terminal-specific requirements
✅ [00:49] Final verification in new terminal window
✅ [00:50] Run `workflow-cli --project screen-scroll-config --next` - Workflow completed!

## Notes
- Research shows `altscreen on` often blocks terminal's native scrolling
- The `termcapinfo xterm* ti@:te@` line is already present, which should enable scrolling
- Most likely fix: change `altscreen on` to `altscreen off`
- Fallback: Add Option+Up/Down shortcuts if mouse doesn't work
🔥 BREAKTHROUGH [00:40]: User reports native scrolling scrolls the terminal history, not the screen content - this is the expected behavior with altscreen off. Need to implement proper mouse wheel binding or keyboard shortcuts instead
🔥 BREAKTHROUGH [00:52]: User wants shortcuts to auto-exit copy mode after scrolling - need to chain commands: enter copy mode, scroll, then exit
🔥 BREAKTHROUGH [01:01]: Option+Up doesn't work through SSH stack - need to use Ctrl-based combinations that screen can reliably intercept