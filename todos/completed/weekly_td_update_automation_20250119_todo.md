# Weekly TD Data Update Automation TODO

## Task: Create automated weekly script to update personal.db with latest TD data from Google Sheets

### Task Details:
- [x] Identify the Google Sheet containing TD bank data
  - Google Sheet ID: 1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE
  - Contains sheets: Quickstart, Accounts, Transactions, Recurring
  - All accounts are TD accounts (CAD and USD)
  - Data is automatically synced to this sheet
- [x] Analyze existing import script structure and adapt for TD-specific data
  - Existing script at: /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/may_26_2025_import_google_sheet_transactions.py
  - Uses gspread library and service account authentication
  - Imports transactions with categorization
- [x] Create a new script for weekly TD data updates
  - Created weekly_td_update_v2.py that uses sheets-cli tool
  - Script location: /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py
- [x] Configure the script to handle TD-specific accounts and transactions
  - Script fetches from Accounts and Transactions sheets
  - Handles all TD accounts with proper currency mapping
  - Uses unique constraints to prevent duplicates
- [x] Set up cron job for weekly execution
  - Cron job runs every Sunday at 2:00 AM
  - Setup script: /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/setup_td_weekly_cron.sh
  - Logs saved to: /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/logs/weekly_td_update.log
- [x] Test the automation thoroughly
  - Successfully imported 5,512 transactions in test run
  - Verified duplicate prevention works
  - Confirmed transaction counts before and after
  - Categorization script now runs successfully:
    - Fixed missing dependencies (gspread, oauth2client, pandas)
    - Created symlink for service account key
    - Categorized 5,108 uncategorized transactions
    - Updated 2,613 transactions with missing currency
- [x] Document the setup and configuration
  - Created comprehensive documentation at: /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/docs/td_weekly_update_automation.md
  - Includes troubleshooting and maintenance guides

### Pre-Task Analysis Notes:
- Found existing Google Sheets CLI tool at: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/google-sheets-cli/sheets-cli.py`
- Found existing import script: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/may_26_2025_import_google_sheet_transactions.py`
- Google Sheet URL for transactions: `https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/`
- TD accounts found in database:
  - TD BUSINESS CASH BACK VISA
  - TD BUSINESS TRAVEL VISA
  - TD BASIC BUSINESS PLAN
- Service account for Google Sheets access: `firebase-adminsdk-lod63@kalaam-25610.iam.gserviceaccount.com`