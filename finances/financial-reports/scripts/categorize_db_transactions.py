import pandas as pd
import os
import json
import traceback
import sqlite3
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# --- Configuration ---
# Updated file paths for the new directory structure
INPUT_CSV_FILE = os.path.join('data', 'categorized_transactions.csv')
OUTPUT_SQLITE_FILE = os.path.join('..', 'data', 'categorized_transactions.db') # Adjusted path
TABLE_NAME = 'transactions'
SPENDING_OVERRIDES_FILE = os.path.join('..', 'config', 'spending_overrides.json') # Added path
SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit?gid=460839481#gid=460839481' # Added
ACCOUNTS_WORKSHEET_NAME = 'Accounts' # Added

# Global variable to store spending_overrides
SPENDING_OVERRIDES = []

# --- AUTH (for Google Sheets) ---
def get_gspread_client():
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive',
    ]
    # Use absolute path for service account key, consistent with other script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    creds_path = os.path.join(script_dir, '..', 'config', 'serviceAccountKey.json') 
    if not os.path.exists(creds_path):
        print(f"Error: Credentials file '{creds_path}' not found for categorize_db_transactions.py.")
        # Fallback for flexibility if someone runs it from a different relative location, though discouraged.
        # This primarily ensures it finds config/serviceAccountKey.json relative to the script itself.
        alt_creds_path = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/financial-reports/config/serviceAccountKey.json'
        if os.path.exists(alt_creds_path):
            creds_path = alt_creds_path
            print(f"Using absolute fallback credential path: {creds_path}")
        else:
             raise FileNotFoundError(f"Service account key not found at {creds_path} or {alt_creds_path}")
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
    return gspread.authorize(creds)

def load_spending_overrides(overrides_file_path):
    """Loads spending overrides from a JSON file."""
    global SPENDING_OVERRIDES
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        overrides_full_path = os.path.join(script_dir, overrides_file_path)
        with open(overrides_full_path, 'r') as f:
            SPENDING_OVERRIDES = json.load(f)
        print(f"Successfully loaded {len(SPENDING_OVERRIDES)} spending overrides from {overrides_full_path}")
    except Exception as e:
        print(f"Error loading spending_overrides.json: {e}")
        SPENDING_OVERRIDES = []

def get_column_type(col_data):
    """
    Determine the appropriate SQLite column type based on data content
    """
    if col_data.dtype in ['int64', 'int32']:
        return 'INTEGER'
    elif col_data.dtype in ['float64', 'float32']:
        return 'REAL'
    else:
        # Check if it looks like a date
        try:
            sample = col_data.dropna().iloc[0] if not col_data.dropna().empty else None
            if sample and isinstance(sample, str):
                datetime.strptime(sample, '%Y-%m-%d')
                return 'DATE'
        except (ValueError, TypeError):
            pass
        return 'TEXT'

def create_table_schema(conn, df, table_name):
    """
    Create a SQLite table schema based on a DataFrame's structure
    """
    # Determine column types from DataFrame
    column_defs = []
    for col in df.columns:
        col_type = get_column_type(df[col])
        # SQLite column names with spaces or special chars need quotes
        column_defs.append(f'"{col}" {col_type}')
    
    # Create the table
    schema_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(column_defs)})"
    
    conn.execute(schema_sql)
    conn.commit()
    
    return schema_sql

def connect_db(db_file_path):
    """Connects to the SQLite database."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_full_path = os.path.join(script_dir, db_file_path)
    conn = sqlite3.connect(db_full_path)
    conn.row_factory = sqlite3.Row # To access columns by name
    return conn

def get_uncategorized_transactions(conn, table_name):
    """Fetches transactions with no PrimaryCategory."""
    cursor = conn.cursor()
    query = f"SELECT * FROM {table_name} WHERE PrimaryCategory IS NULL OR PrimaryCategory = ''"
    cursor.execute(query)
    transactions = cursor.fetchall()
    print(f"Found {len(transactions)} uncategorized transactions.")
    return transactions

def categorize_transaction(description, account_name):
    """
    Categorizes a transaction based on predefined rules.
    Uses the global SPENDING_OVERRIDES.
    """
    description = str(description).upper() if description else ''
    account_name = str(account_name).upper() if account_name else ''

    # 1. Manual Overrides
    for override in SPENDING_OVERRIDES:
        if override.get('fragment', '').upper() in description:
            return override.get('category', 'Personal') # Default to Personal if category missing

    # 2. Specific Description Keywords (Hardcoded)
    if 'WPS BILLING' in description:
        return 'MPYRE Software Inc.'
    if 'PAYPAL MSP' in description:
        return 'MPYRE Software Inc.'
    if any(keyword in description for keyword in ['PENNYAPPEAL CANADA', 'ALLSTATE', 'HWY407 ETR BPY']):
        return 'Personal'

    # 3. General Cloud Service Keyword (NEW)
    if 'CLOUD' in description:
        return 'Kalaam Foundation'

    # 4. Description Keywords for Specific Entities (was 3)
    # Kalaam Foundation
    kalaam_desc_keywords = ['KALAAM', 'UPWORK', 'PURRWEB', 'OPENAI', 'ANAS', 'FIREBASE', 'VIMEO', 'JAHANZAIB', 'ISHAAQ', 'FRAMER', 'ANTHROPIC']
    if any(keyword in description for keyword in kalaam_desc_keywords):
        return 'Kalaam Foundation'

    # 5. Account Name / Identifier Matching (Moved down)
    # Kalaam Foundation
    kalaam_account_keywords = ['COMMUNITY PLAN', 'BUSINESS INVESTOR ACCOUNT', 'KALAAM DONATIONS', 'TD BASIC BUSINESS PLAN']
    if any(keyword in account_name for keyword in kalaam_account_keywords):
        return 'Kalaam Foundation'

    # MPYRE Software Inc.
    mpyre_account_keywords = ['MPYRE', 'TD BUSINESS TRAVEL VISA', 'CANADIAN MARGIN', 'US MARGIN']
    if any(keyword in account_name for keyword in mpyre_account_keywords):
        return 'MPYRE Software Inc.'

    # Metropolis
    metropolis_account_keywords = ['METROPOLIS', 'US DOLLAR CARD', 'TD BUSINESS CASH BACK VISA', 'US DOLLAR CREDIT CARD']
    if any(keyword in account_name for keyword in metropolis_account_keywords):
        return 'Metropolis'

    # AutoOptimize Inc.
    autooptimize_account_keywords = ['AUTOOPTIMIZE']
    if any(keyword in account_name for keyword in autooptimize_account_keywords):
        return 'AutoOptimize Inc.'
        
    # 6. Default Category
    return 'Personal'

def update_transaction_category(conn, table_name, category, date, account_name, description, amount, currency):
    """
    Updates the PrimaryCategory for all transactions matching the composite key.
    """
    try:
        cursor = conn.cursor()
        
        # Construct the base UPDATE query
        update_query_base = f'''UPDATE "{table_name}" SET PrimaryCategory = ?
                               WHERE "Date" = ? AND
                                     "Account Name" = ? AND
                                     "Description" = ? AND
                                     "Amount" = ?'''
        
        params = [
            category, # First parameter is the new category
            date,
            account_name,
            description,
            str(amount) if amount is not None else None
        ]
        
        # Dynamically add currency condition
        if currency is None:
            update_query = update_query_base + ' AND "Currency" IS NULL'
        else:
            update_query = update_query_base + ' AND "Currency" = ?'
            params.append(currency)
        
        # Add condition to only update if PrimaryCategory is currently NULL or empty
        update_query += " AND (PrimaryCategory IS NULL OR PrimaryCategory = '')"

        cursor.execute(update_query, tuple(params))
        updated_rows = cursor.rowcount # Get the number of rows affected

        if updated_rows > 0:
            conn.commit()
            # print(f"Successfully updated {updated_rows} transaction(s) to category '{category}' for: Date='{date}', Account='{account_name}', Desc='{description}', Amt='{amount}', Curr='{currency}'")
            return True
        else:
            # This case might occur if the transaction was already categorized by another concurrent process or a previous run
            # or if it simply wasn't found with the "PrimaryCategory IS NULL" condition.
            # Consider if specific logging is needed here, but for now, it's not an error if 0 rows were updated.
            # It simply means no uncategorized transactions matched the criteria.
            # print(f"No uncategorized transactions found/updated for: Date='{date}', Account='{account_name}', Desc='{description}', Amt='{amount}', Curr='{currency}'")
            return True # Still return True as it's not a failure of this specific update attempt

    except sqlite3.InterfaceError as e:
        print(f"SQLite InterfaceError updating transaction(s) (Category='{category}', Date='{date}', Account='{account_name}', Desc='{description}', Amt='{amount}', Curr='{currency}'): {e}")
        print(f"Parameters used: {params}")
        return False
    except Exception as e:
        print(f"Error updating transaction(s) (Category='{category}', Date='{date}', Account='{account_name}', Desc='{description}', Amt='{amount}', Curr='{currency}'): {e}")
        return False

def process_and_categorize_transactions(conn, table_name):
    """
    Connects to the DB, fetches uncategorized transactions,
    categorizes them, and updates the DB.
    """
    try:
        print(f"Connected to database: {conn}")
        
        uncategorized_transactions = get_uncategorized_transactions(conn, table_name)
        
        if not uncategorized_transactions:
            print("No uncategorized transactions to process.")
            return

        updated_count = 0
        failed_count = 0
        
        for row in uncategorized_transactions:
            # Extract fields for the composite key and categorization
            # Normalize column name lookup (case-insensitive)
            row_keys_lower = {k.lower(): k for k in row.keys()}

            date = row[row_keys_lower.get('date')] if row_keys_lower.get('date') else None
            account_name = row[row_keys_lower.get('account name')] if row_keys_lower.get('account name') else None
            description = row[row_keys_lower.get('description')] if row_keys_lower.get('description') else None
            amount = row[row_keys_lower.get('amount')] if row_keys_lower.get('amount') else None
            currency = row[row_keys_lower.get('currency')] if row_keys_lower.get('currency') else None
            
            if description is None: # Primary field for categorization
                # Construct an identifier for logging, even if some parts are None
                log_id_parts = [str(f) for f in [date, account_name, amount, currency] if f is not None]
                log_id = ", ".join(log_id_parts)
                print(f"Skipping transaction ({log_id}) due to missing 'Description' field.")
                failed_count += 1 # Count as failed as it cannot be processed
                continue

            category = categorize_transaction(description, account_name)
            
            # Pass all necessary fields for the composite key
            if update_transaction_category(conn, table_name, category, date, account_name, description, amount, currency):
                updated_count += 1
            else:
                failed_count += 1
        
        print(f"Categorization complete. Updated: {updated_count}, Failed: {failed_count}")

    except sqlite3.Error as e:
        print(f"SQLite error during categorization: {e}")
        print(traceback.format_exc())
    except Exception as e:
        print(f"An unexpected error occurred during categorization: {e}")
        print(traceback.format_exc())

def fetch_account_currency_map():
    """Fetches account names and their currencies from the Google Sheet."""
    account_currency_map = {}
    try:
        print(f"Connecting to Google Sheet URL: {SPREADSHEET_URL} to fetch account currencies...")
        gc = get_gspread_client()
        sh = gc.open_by_url(SPREADSHEET_URL)
        accounts_ws = sh.worksheet(ACCOUNTS_WORKSHEET_NAME)
        accounts_records = accounts_ws.get_all_records() # Returns list of dicts

        if accounts_records:
            print(f"Successfully fetched {len(accounts_records)} account records from '{ACCOUNTS_WORKSHEET_NAME}'.")
            for record in accounts_records:
                acc_name = record.get('⚡ Account Name')
                curr = record.get('⚡ Currency')
                if acc_name and curr:
                    # Normalize account name from sheet for broader matching
                    # This should ideally match how account names might appear in the DB from PDFs
                    # For now, we store it as is from the sheet, matching will need to be robust
                    account_currency_map[acc_name.upper()] = curr.upper()
            print(f"Created currency map for {len(account_currency_map)} accounts.")
            # Print a sample of the map
            print("Sample of the account_currency_map (first 5 entries):")
            for i, (key, value) in enumerate(account_currency_map.items()):
                if i < 5:
                    print(f"  '{key}': '{value}'")
                else:
                    break
        else:
            print(f"No data found in '{ACCOUNTS_WORKSHEET_NAME}' for currency mapping.")
    except Exception as e:
        print(f"An error occurred while fetching account currency map: {e}")
        print(traceback.format_exc())
        # Return empty map if error, so script can proceed with categorization if GSheet is unavailable
    return account_currency_map

def update_missing_currencies(conn, table_name, account_currency_map):
    """Updates transactions with NULL currency using the account_currency_map."""
    if not account_currency_map:
        print("Account currency map is empty. Skipping currency update.")
        return

    cursor = conn.cursor()
    # Select transactions where currency is NULL
    # We need to be careful about matching 'Account Name' from transactions table
    # with the keys in account_currency_map (which are from '⚡ Account Name' in sheet)
    # The account names in the DB might be slightly different (e.g. from PDF filenames)
    query = f'SELECT rowid, "Account Name" AS AccountName FROM {table_name} WHERE Currency IS NULL OR Currency = \'\''
    cursor.execute(query)
    transactions_to_update = cursor.fetchall()

    if not transactions_to_update:
        print("No transactions with missing currency found.")
        return

    print(f"Found {len(transactions_to_update)} transactions with missing currency. Attempting to update...")
    updated_count = 0
    for i, row in enumerate(transactions_to_update): # Add enumerate
        # Try accessing by index as a fallback/test
        try:
            rowid = row[0]  # Assuming rowid is the first column selected
            account_name_from_db = row[1]  # Assuming aliased AccountName is the second
        except IndexError:
            # if i < 30: # Limit printing
            #     print(f"Debug (Tx {i+1}): Error accessing row columns by index. Row data: {row}")
            continue # Skip this row if we can't access its data
        except TypeError: # If row is not subscriptable as expected
            # if i < 30: # Limit printing
            #     print(f"Debug (Tx {i+1}): Error: row is not a list or tuple as expected. Row type: {type(row)}, Row data: {row}")
            continue

        if not account_name_from_db:
            # if i < 30: # Limit printing
            #     print(f"Debug (Tx {i+1}): Skipping rowid {rowid} due to missing account_name_from_db.")
            continue
        
        account_name_db_upper = account_name_from_db.upper()
        found_currency = None

        # if i < 30: # Limit printing for detailed logs
        #     print(f"\nDebug (Tx {i+1}): Processing rowid {rowid}, DB Account Name: '{account_name_from_db}', Uppercase: '{account_name_db_upper}'")

        # Attempt to find a match in the currency map.
        # 1. Direct match
        found_currency = account_currency_map.get(account_name_db_upper) # Direct match
        # if found_currency:
        #     if i < 30: # Limit printing
        #         print(f"Debug (Tx {i+1}):   Direct match found: '{account_name_db_upper}' -> Currency '{found_currency}'")
        # else:
        #     if i < 30: # Limit printing
        #         print(f"Debug (Tx {i+1}):   No direct match for '{account_name_db_upper}'. Attempting partial match...")
        if not found_currency: # Only attempt partial if direct match failed
            # 2. Try partial matching: if a key from the map is contained in the DB account name
            for map_key_account_name, map_currency in account_currency_map.items():
                # map_key_account_name is already upper from fetch_account_currency_map
                
                # Refined partial match: Take sheet name part before '(' if it exists
                core_map_key = map_key_account_name.split('(')[0].strip()

                # if i < 30: # Limit printing comparisons
                #     print(f"Debug (Tx {i+1}):     Comparing core map key '{core_map_key}' with DB name '{account_name_db_upper}'")
                
                # Check if the core part of the sheet name is in the DB account name
                if core_map_key and core_map_key in account_name_db_upper: # Ensure core_map_key is not empty
                    found_currency = map_currency
                    # if i < 30: # Limit printing
                    #     print(f"Debug (Tx {i+1}):       Partial match! DB Account '{account_name_from_db}' (contains core '{core_map_key}' from map key '{map_key_account_name}') -> Currency {found_currency}")
                    break # Found a partial match, use this currency
        
        if found_currency:
            try:
                # if i < 30: # Limit printing
                #     print(f"Debug (Tx {i+1}):   Attempting to update rowid {rowid} with currency '{found_currency}'")
                update_sql = f'UPDATE "{table_name}" SET Currency = ? WHERE rowid = ?'
                cursor.execute(update_sql, (found_currency, rowid))
                updated_count += 1
                # if i < 30: # Limit printing
                #      print(f"Debug (Tx {i+1}):   Successfully updated rowid {rowid}.")
            except Exception as e:
                # if i < 30: # Limit printing
                #     print(f"Debug (Tx {i+1}):   Error updating currency for rowid {rowid} (Account: {account_name_from_db}): {e}")
                # Keep original error print for actual errors
                print(f"Error updating currency for rowid {rowid} (Account: {account_name_from_db}): {e}")
        # else:
        #     if i < 30: # Limit printing
        #         print(f"Debug (Tx {i+1}):   No currency mapping found for account: '{account_name_from_db}' after direct and partial checks.")

    if updated_count > 0:
        conn.commit()
    print(f"Currency update complete. Updated: {updated_count} transactions.")

def csv_to_sqlite(csv_file_path, db_file_path, table_name='transactions', overwrite=True):
    """
    Converts a CSV file to a SQLite database table.
    
    Args:
        csv_file_path: Path to CSV file
        db_file_path: Path to SQLite database file
        table_name: Name of the table to create
        overwrite: If True, drops existing table; if False, appends to it
    """
    try:
        # Get full paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        csv_full_path = os.path.join(script_dir, '..', csv_file_path)
        db_full_path = os.path.join(script_dir, '..', db_file_path)
        
        # Ensure database directory exists
        os.makedirs(os.path.dirname(db_full_path), exist_ok=True)
        
        print(f"Reading CSV file: {csv_full_path}")
        # Use error_bad_lines=False (renamed to on_bad_lines='skip' in newer pandas) to skip problematic rows
        try:
            # For newer pandas versions
            df = pd.read_csv(csv_full_path, on_bad_lines='skip')
        except TypeError:
            # For older pandas versions
            df = pd.read_csv(csv_full_path, error_bad_lines=False)
        
        print(f"Successfully read CSV with {len(df)} rows and {len(df.columns)} columns.")
        print(f"Column headers: {df.columns.tolist()}")
        
        if df.empty:
            print("CSV file is empty. No data to transfer.")
            return False
        
        # Process data for SQLite compatibility
        # Convert date columns to proper format
        date_cols = [col for col in df.columns if 'date' in col.lower()]
        for col in date_cols:
            try:
                df[col] = pd.to_datetime(df[col]).dt.strftime('%Y-%m-%d')
            except:
                pass  # If conversion fails, keep as is
        
        # Connect to database
        print(f"Connecting to SQLite database: {db_full_path}")
        conn = sqlite3.connect(db_full_path)
        
        # Drop table if it exists and overwrite is True
        if overwrite:
            conn.execute(f"DROP TABLE IF EXISTS {table_name}")
            conn.commit()
            print(f"Dropped existing table: {table_name}")
        
        # Create table schema
        schema_sql = create_table_schema(conn, df, table_name)
        print(f"Created table with schema: {schema_sql}")
        
        # Insert data
        print(f"Inserting {len(df)} rows into {table_name}...")
        df.to_sql(table_name, conn, if_exists='append', index=False)
        
        # Verify count
        cursor = conn.cursor()
        count = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        conn.close()
        
        print(f"Successfully transferred {count} rows to SQLite database table: {table_name}")
        print(f"Database file saved at: {db_full_path}")
        return True
        
    except Exception as e:
        print(f"Error converting CSV to SQLite: {e}")
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    print("--- Starting Categorization Script ---") # Changed script title
    # Ensure spending overrides are loaded first
    load_spending_overrides(SPENDING_OVERRIDES_FILE)

    db_path_for_processing = OUTPUT_SQLITE_FILE 
    conn = None
    try:
        conn = connect_db(db_path_for_processing)
        print(f"Connected to database for currency update & categorization: {db_path_for_processing}")

        # Step 1: Fetch currency map and update missing currencies
        account_map = fetch_account_currency_map()
        if account_map: # Only attempt update if map was successfully fetched
            update_missing_currencies(conn, TABLE_NAME, account_map)
        else:
            print("Skipping currency update due to issues fetching the account map.")

        # Step 2: Categorize transactions
        print("\nRunning categorization for existing uncategorized transactions...")
        process_and_categorize_transactions(conn, TABLE_NAME) # Pass connection directly
    
    except Exception as e:
        print(f"An error occurred in the main processing block: {e}")
        print(traceback.format_exc())
    finally:
        if conn:
            conn.close()
            print("Database connection closed after main processing.")
    
    print("--- Script Finished ---") 