# 20250630-selenium-fix-todo.md
Last updated: 2025-06-30T20:14:00Z

## Non-Negotiable User Requirements
- selenium-cli command seems to be a mess. it's not able to automate any task
- make sure it can run from any directory (it's a global cli tool)
- can automate the task: go to suno.com and generate a song
- make sure it uses the latest firefox profile (i have already logged into suno)
- after each action it should show the screenshot location, full html location and the html diff that was caused by the action (if any)
- make sure you're not logging into suno again in a new profile
- remove any unnecessary commands like start or launch. just navigating should automatically launch the browser if needed, or use existing browser session
- we only want one browser session at this time
- this workflow is not complete until we can successfully generate a suno song from start to finish with the existing logged in account using selenium-cli

## Context Discovery
- selenium-cli already exists in cli_tools/selenium-cli/
- It uses Selenium WebDriver with Firefox
- Already supports using existing Firefox profile (for logged-in sessions)
- Commands are non-blocking (exit immediately)
- Browser stays open between commands
- Currently shows screenshot and HTML after actions
- Has debug output that should be cleaned up
- Navigate command already auto-launches browser if needed

## Tasks (with timestamps and status icons)

### Phase 1: Clean up output and remove debug logs
✅ [20:15] Remove [DEBUG] output from normal command output
✅ [20:15] Clean up output format to show only screenshot, HTML, and diff
✅ [20:15] Remove unnecessary launch/start commands from help text
✅ [20:16] Test that navigate still auto-launches browser

### Phase 2: Implement HTML diff tracking  
✅ [20:16] Store previous HTML state after each action - Already implemented in session-server
✅ [20:16] Calculate and display HTML diff after each action - Already implemented but not showing
✅ [20:24] Fix HTML diff display issue - diff is calculated but shows as null on first action (expected)
✅ [20:24] Ensure Firefox profile is being used correctly - Fixed to use profile by default
🔥 [20:31] ISSUE: Multiple Firefox instances being created, need to fix session management

### Phase 3: Test Suno.com automation end-to-end
✅ [20:37] Navigate to suno.com - Works!
✅ [20:37] Take screenshot to verify logged-in state - Confirmed logged in as Areeb Bajwa
🔥 [20:51] Find and click on song generation UI elements - Click works but type command crashes session
🔥 [21:10] Enter song prompt/details - TYPE COMMAND FUNDAMENTALLY BROKEN - crashes all sessions
🔥 [21:10] Submit song generation request - BLOCKED by broken type command  
🔥 [21:10] Verify song generation started - BLOCKED by broken type command
✅ [21:10] Document the exact commands used - Working commands documented below

### Phase 4: Final verification and cleanup
🔥 [20:52] Ensure all commands work from any directory - TYPE COMMAND FAILS
🔥 [20:52] Clean up any remaining issues - MULTIPLE FIREFOX PROCESSES, TYPE COMMAND CRASHES
🔥 [20:52] Run full end-to-end test again - BLOCKED by type command failure  
🔥 [20:52] Document final state and move to next step - NOT READY

## Notes (with breakthrough markers)
- 💡 selenium-cli already has most required functionality
- 💡 Navigate already auto-launches browser - no changes needed there
- 💡 Firefox profile support already implemented correctly
- 🔍 Main issues: debug output pollution, missing HTML diff, need to verify Suno automation works
- ✅ Successfully navigated to Suno.com with logged-in session
- ✅ Profile copying implemented to use existing Firefox profile
- 🔥 CRITICAL ISSUE: Multiple Firefox instances being created, causing "session lost" errors
- 📝 **WORKING commands:**
  ```bash
  selenium-cli navigate https://suno.com  # ✅ Works, uses Firefox profile, maintains login
  selenium-cli screenshot               # ✅ Works, saves timestamped files  
  selenium-cli click "css=a[href='/create']"  # ✅ Works with simple CSS selectors
  selenium-cli status                  # ✅ Works, shows session info
  selenium-cli close                   # ✅ Works, cleans up properly
  ```

- 🔥 **BROKEN commands:**
  ```bash
  selenium-cli type "css=textarea" "text"  # ❌ CRASHES SESSION EVERY TIME
  # Any type command with any selector crashes the session server
  ```

- 📊 **Success Rate:**
  - Navigate: ✅ 100% working
  - Screenshot: ✅ 100% working  
  - Click (simple selectors): ✅ 100% working
  - Type: ❌ 0% working (always crashes)
  - Session management: ✅ Mostly working (some Firefox process leaks)