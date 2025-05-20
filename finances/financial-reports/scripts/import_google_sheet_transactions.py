import argparse
import gspread
import sqlite3
import os
from oauth2client.service_account import ServiceAccountCredentials
from oauth2client.file import Storage
from datetime import datetime
import subprocess # Added for system call

# --- CONFIG ---
DEFAULT_DB_PATH = 'finances/financial-reports/data/categorized_transactions.db'
DEFAULT_SHEET_NAME = 'Transactions'
# DEFAULT_WORKSHEET_NAME = 'Sheet1' # Default worksheet is 'Transactions' itself
# --- SPREADSHEET URL (same as get_accounts_info.py) ---
SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit?gid=460839481#gid=460839481'

# --- AUTH ---
def get_gspread_client():
    # Use credentials from config/serviceAccountKey.json
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive',
    ]
    # Use absolute path for service account key
    creds_path = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/financial-reports/config/serviceAccountKey.json'
    if not os.path.exists(creds_path):
        print(f"Error: Credentials file '{creds_path}' not found.")
        # Fallback to relative path if absolute not found (for flexibility)
        creds_path = os.path.join('config', 'serviceAccountKey.json') 
        print(f"Attempting fallback to relative path: {creds_path}")
        if not os.path.exists(creds_path):
             raise FileNotFoundError(f"Service account key not found at absolute or relative path: {creds_path}")
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
    return gspread.authorize(creds)

# --- DB ---
def ensure_transactions_table(conn):
    conn.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            "Date" DATE,
            "Account Name" TEXT,
            "Amount" REAL,
            "Description" TEXT,
            "SourceFile" TEXT,
            "PrimaryCategory" TEXT,
            "Currency" TEXT,
            "RawData" TEXT,
            "SheetTransactionID" TEXT,
            UNIQUE("SourceFile", "SheetTransactionID", "RawData")
        );
    ''')
    conn.commit()

# Map sheet columns to DB columns
COLUMN_MAPPING = {
    '⚡ Date': 'Date',
    '⚡ Account': 'Account Name', # This is the key from 'Transactions' sheet
    '⚡ Amount': 'Amount',
    '⚡ Description': 'Description',
    '⚡ Category': 'PrimaryCategory',
    '⚡ Raw Data': 'RawData',
    '⚡ Transaction ID': 'SheetTransactionID'
}
DB_COLUMNS = ["Date", "Account Name", "Amount", "Description", "PrimaryCategory", "SourceFile", "Currency", "RawData", "SheetTransactionID"]

def insert_rows(conn, rows, sheet_columns, account_currency_map):
    placeholders = ','.join(['?'] * len(DB_COLUMNS))
    sql = f'INSERT OR IGNORE INTO transactions ({", ".join([f'\"{col}\"' for col in DB_COLUMNS])}) VALUES ({placeholders})'
    
    sheet_data_dicts = [dict(zip(sheet_columns, row)) for row in rows]

    initial_total_changes = conn.total_changes # Get current total changes on the connection

    for item in sheet_data_dicts:
        values = []
        current_transaction_account_name = item.get('⚡ Account') 

        for db_col in DB_COLUMNS:
            if db_col == "SourceFile":
                values.append("Google Sheet - Transactions")
            elif db_col == "PrimaryCategory": # Always set to NULL for sheet imports
                values.append(None)
            elif db_col == "Currency":
                currency = account_currency_map.get(current_transaction_account_name)
                values.append(currency)
            elif db_col == "Date":
                sheet_col_name = None
                for s_col, d_col in COLUMN_MAPPING.items():
                    if d_col == db_col:
                        sheet_col_name = s_col
                        break
                date_val = item.get(sheet_col_name)
                if date_val:
                    parsed_date = None
                    # Attempt to parse common date formats
                    for fmt in ('%m/%d/%Y', '%m/%d/%y', '%-m/%-d/%Y', '%-m/%-d/%y'): # Added %-m and %-d for single digit month/day
                        try:
                            parsed_date = datetime.strptime(date_val, fmt)
                            break 
                        except ValueError:
                            continue
                    if parsed_date:
                        values.append(parsed_date.strftime('%Y-%m-%d'))
                    else:
                        print(f"Warning: Could not parse date string \'{date_val}\' for transaction. Inserting NULL for Date. Raw row: {item}")
                        values.append(None) # Insert NULL if parsing fails
                else:
                    values.append(None) # Insert NULL if original date is empty
            else:
                sheet_col_name = None
                for s_col, d_col in COLUMN_MAPPING.items():
                    if d_col == db_col:
                        sheet_col_name = s_col
                        break
                values.append(item.get(sheet_col_name))
        
        conn.execute(sql, tuple(values))
    
    conn.commit() # Commit all operations

    final_total_changes = conn.total_changes # Get total changes after commit
    newly_inserted_count = final_total_changes - initial_total_changes

    print(f"Processed {len(sheet_data_dicts)} rows from the sheet.")
    print(f"Newly inserted rows into the database: {newly_inserted_count}")

def main():
    parser = argparse.ArgumentParser(description='Download data from Google Sheet and insert into SQLite DB.')
    # --sheet argument is not really used if we hardcode the URL, but keep for consistency or future use
    parser.add_argument('--sheet_name', type=str, default=DEFAULT_SHEET_NAME, help='Google Sheet name (for opening by name - not used if URL is hardcoded)')
    parser.add_argument('--worksheet', type=str, default=DEFAULT_SHEET_NAME, help='Worksheet name for transactions (e.g., "Transactions")')
    parser.add_argument('--accounts_worksheet', type=str, default='Accounts', help='Worksheet name for account details (e.g., "Accounts")')
    parser.add_argument('--db', type=str, default=DEFAULT_DB_PATH, help='SQLite DB path')
    args = parser.parse_args()

    print(f"Connecting to Google Sheet URL: {SPREADSHEET_URL}")
    gc = get_gspread_client()
    sh = gc.open_by_url(SPREADSHEET_URL) # Open the entire spreadsheet by URL

    # 1. Fetch data from the "Transactions" worksheet (or as specified by --worksheet)
    print(f"Fetching data from worksheet: '{args.worksheet}'...")
    transactions_ws = sh.worksheet(args.worksheet)
    trans_data = transactions_ws.get_all_values()
    if not trans_data:
        print(f"No data found in '{args.worksheet}' worksheet.")
        return
    trans_columns = trans_data[0]
    trans_rows = trans_data[1:]
    print(f"Found {len(trans_rows)} rows in '{args.worksheet}'.")
    print(f"Columns from '{args.worksheet}': {trans_columns}")

    # 2. Fetch data from the "Accounts" worksheet to build currency map
    account_currency_map = {}
    print(f"Fetching currency data from worksheet: '{args.accounts_worksheet}'...")
    try:
        accounts_ws = sh.worksheet(args.accounts_worksheet)
        accounts_records = accounts_ws.get_all_records() # Returns list of dicts
        if accounts_records:
            print(f"Successfully fetched {len(accounts_records)} account records from '{args.accounts_worksheet}'.")
            # Column names in 'Accounts' sheet are '⚡ Account Name' and '⚡ Currency'
            for record in accounts_records:
                acc_name = record.get('⚡ Account Name') # Key from 'Accounts' sheet
                curr = record.get('⚡ Currency')
                if acc_name and curr:
                    account_currency_map[acc_name] = curr
            print(f"Created currency map for {len(account_currency_map)} accounts.")
        else:
            print(f"No data found in '{args.accounts_worksheet}'.")
    except gspread.exceptions.WorksheetNotFound:
        print(f"Error: Worksheet '{args.accounts_worksheet}' not found.")
    except Exception as e:
        print(f"An error occurred while fetching from '{args.accounts_worksheet}': {e}")

    # 3. Insert into DB
    print(f"Connecting to SQLite DB: {args.db}")
    conn = sqlite3.connect(args.db)
    ensure_transactions_table(conn)
    # Pass trans_rows, trans_columns (from 'Transactions' sheet) and the map
    insert_rows(conn, trans_rows, trans_columns, account_currency_map)
    conn.close()

    print("\n--- Google Sheet import finished ---")
    print("Attempting to run categorization script...")
    try:
        categorize_script_path = os.path.join(os.path.dirname(__file__), 'categorize_db_transactions.py')
        process = subprocess.run(['python', categorize_script_path], capture_output=True, text=True, check=True)
        print("Categorization script output:")
        print(process.stdout)
        if process.stderr:
            print("Categorization script errors (if any):")
            print(process.stderr)
        print("Categorization script completed.")
    except subprocess.CalledProcessError as e:
        print(f"Error running categorization script: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
    except FileNotFoundError:
        print(f"Error: categorize_db_transactions.py not found at {categorize_script_path}")

if __name__ == '__main__':
    main() 