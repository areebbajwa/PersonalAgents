# 20250130-td-update-fix-todo.md

Last updated: 02:00

## Non-Negotiable User Requirements
- Fix issue in /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/logs/weekly_td_update.log

## Context Discovery
- Weekly TD update cron job failing with "returned non-zero exit status 1" when calling google-sheets-cli
- Root cause: Cron uses /usr/bin/python3 (3.9.6) which lacks required Google API modules
- Manual runs work because they use /usr/local/bin/python3 (3.12.8) with all modules installed
- Fix: Update cron setup script to use correct Python interpreter path

## Tasks

### Phase 1: Fix Python Path
- 🕒 [02:01] Update setup_td_weekly_cron.sh to use /usr/local/bin/python3
- 🕒 [02:01] TEST GATE: Verify the script runs without module errors
- 🕒 [02:01] Update existing cron job with correct Python path
- 🕒 [02:01] TEST GATE: Run weekly_td_update_v2.py manually to confirm it works
- 🕒 [02:01] Commit fix with test results

### Phase 2: Verify Fix
- 🕒 [02:01] Check current cron configuration
- 🕒 [02:01] TEST GATE: Simulate cron execution to verify fix
- 🕒 [02:01] Clear error entries from log file
- 🕒 [02:01] Document the fix for future reference
- 🕒 [02:01] Final commit and merge

### Final Task
- 🕒 Run workflow-cli --project td-update-fix --next

## Notes
- Simple one-line fix: Change Python interpreter path in cron setup
- No code changes needed - scripts work correctly with proper Python version
- Test by running the actual weekly update to ensure it imports transactions successfully