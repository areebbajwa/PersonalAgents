# TD Weekly Update Cron Fix Documentation

## Issue
The weekly TD Bank data update cron job was failing with "returned non-zero exit status 1" errors when calling google-sheets-cli.

## Root Cause
- Cron was using `/usr/bin/python3` (Python 3.9.6) which lacks required Google API modules
- Manual runs worked because they used `/usr/local/bin/python3` (Python 3.12.8) with all modules installed

## Solution
Updated the cron setup script to use `/usr/local/bin/python3` instead of `/usr/bin/python3`.

## Files Changed
- `finances/scripts/setup_td_weekly_cron.sh` - Updated Python interpreter path on line 13

## Verification Steps
1. Updated setup script with correct Python path
2. Removed old cron job with incorrect path
3. Ran setup script to create new cron job
4. Verified cron now uses `/usr/local/bin/python3`
5. Tested manual execution - successfully imported transactions
6. Simulated cron environment - script runs without errors

## Future Prevention
- Always verify Python module dependencies are available in the interpreter used by cron
- Test scripts in cron-like environment before deploying: `env -i PATH=/usr/local/bin:/usr/bin:/bin python3 script.py`