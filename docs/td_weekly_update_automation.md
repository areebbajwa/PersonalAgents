# TD Bank Weekly Data Update Automation

## Overview
This automation synchronizes TD Bank transaction data from Google Sheets to the personal.db database on a weekly schedule.

## Components

### 1. Weekly Update Script
- **Location**: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py`
- **Purpose**: Fetches latest TD transactions from Google Sheets and imports them into personal.db
- **Features**:
  - Uses the sheets-cli tool for Google Sheets access
  - Handles all TD accounts (CAD and USD)
  - Prevents duplicate entries using unique constraints
  - Logs all operations for monitoring
  - Runs categorization script after import to:
    - Update missing currency fields
    - Fix transfer and accounting entries
    - Correct credit card amount signs
    - Categorize all uncategorized transactions

### 2. Google Sheets Source
- **Sheet ID**: `1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE`
- **Sheets**:
  - `Accounts`: Contains TD account names, balances, and currencies
  - `Transactions`: Contains all TD transaction data
- **Service Account**: `firebase-adminsdk-lod63@kalaam-25610.iam.gserviceaccount.com`

### 3. Cron Job Configuration
- **Schedule**: Every Sunday at 2:00 AM
- **Setup Script**: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/setup_td_weekly_cron.sh`
- **Log Location**: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/logs/weekly_td_update.log`

## TD Accounts Tracked
All TD accounts including:
- Mpyre CAD chequing (7807)
- Shared family credit card (9705)
- Areeb personal CAD chequing (1459)
- Areeb CAD Investment Account (FL1A)
- Mariam Metropolis CAD credit card (7409)
- TD BUSINESS TRAVEL VISA (5082)
- AutoOptimize CAD credit card (1147)
- Mariam USD Investment Account (LB7B)
- AutoOptimize USD chequing (6838)

## Manual Execution
To run the update manually:
```bash
python3 /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py
```

## Monitoring
- Check cron jobs: `crontab -l`
- View logs: `tail -f /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/logs/weekly_td_update.log`
- Verify last update in database:
```sql
SELECT MAX(Date) FROM transactions 
WHERE "Account Name" LIKE '%TD%' 
   OR "Account Name" LIKE '%Mpyre%'
   OR "Account Name" LIKE '%Areeb%';
```

## Dependencies
- Python 3.12+
- Required Python packages: gspread, oauth2client, pandas, python-dateutil
- Service account key file symlinked at: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/config/serviceAccountKey.json`
- Spending overrides configuration at: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/config/spending_overrides.json`

## Troubleshooting
1. **Script fails to run**: Check that the script has execute permissions
2. **No new data imported**: Verify Google Sheet has been updated with new transactions
3. **Authentication errors**: Ensure service account file exists and has proper permissions
4. **Cron not running**: Check system cron service is active with `sudo launchctl list | grep cron`
5. **Categorization fails**: Check Python dependencies are installed with `python3 -m pip list | grep -E "gspread|oauth2client|pandas"`

## Maintenance
- The Google Sheet is automatically updated by TD's systems
- No manual intervention required unless errors occur
- Monitor logs weekly to ensure successful execution