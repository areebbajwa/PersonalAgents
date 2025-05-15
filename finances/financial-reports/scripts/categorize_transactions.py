import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
import traceback
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

# --- Configuration (Partially from main.py) ---
# Updated file paths for the new directory structure
CREDENTIALS_FILE = os.path.join('config', 'serviceAccountKey.json')
SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit?gid=460839481#gid=460839481'
TRANSACTIONS_WORKSHEET_NAME = 'Transactions' 
ACCOUNTS_WORKSHEET_NAME = 'Accounts'
MANUAL_OVERRIDES_FILE = os.path.join('config', 'spending_overrides.json')
OUTPUT_CSV_FILE = os.path.join('data', 'categorized_transactions.csv')

# Column Names (Ensure these match your sheet)
DATE_COLUMN = '⚡ Date'
AMOUNT_COLUMN = '⚡ Amount'
DESCRIPTION_COLUMN = '⚡ Description'
ACCOUNT_COLUMN = '⚡ Account' # Used for account name matching from TD data
ACCOUNT_NAME_COLUMN = '⚡ Account Name' # Expected in Accounts sheet
RAW_DATA_COLUMN = '⚡ Raw Data'

# --- Utility Functions (Adapted from main.py) ---

def authenticate_gsheets():
    """Authenticates with Google Sheets API using service account."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    creds_path = os.path.join(script_dir, CREDENTIALS_FILE)

    if not os.path.exists(creds_path):
        print(f"Error: Credentials file '{CREDENTIALS_FILE}' not found in the script directory: {script_dir}")
        alt_creds_path = '/etc/secrets/serviceAccountKey.json'
        if os.path.exists(alt_creds_path):
            creds_path = alt_creds_path
            print(f"Found credentials at alternative path: {alt_creds_path}")
        else:
            return None
            
    try:
        credentials = ServiceAccountCredentials.from_json_keyfile_name(creds_path)
        return gspread.authorize(credentials)
    except Exception as e:
        print(f"Error loading credentials from '{creds_path}': {e}")
        return None

def get_worksheet_df(gspread_client, spreadsheet_url, worksheet_name):
    """Fetches a DataFrame from a Google Sheets worksheet using its name."""
    try:
        print(f"Attempting to open spreadsheet: {spreadsheet_url}")
        sheet_object = gspread_client.open_by_url(spreadsheet_url)
        print(f"Successfully opened spreadsheet: '{sheet_object.title}'")
        worksheet = sheet_object.worksheet(worksheet_name)
        print(f"Accessing worksheet: '{worksheet.title}'")
        data = worksheet.get_all_records()
        if not data:
            print(f"Warning: No data found in worksheet '{worksheet_name}'.")
            return pd.DataFrame() # Return empty DataFrame instead of None
        df = pd.DataFrame(data)
        print(f"Successfully fetched {len(df)} records from '{worksheet_name}'. Columns: {list(df.columns)}")
        return df
    except gspread.exceptions.SpreadsheetNotFound:
        print(f"Error: Spreadsheet not found at URL: {spreadsheet_url}")
        return None
    except gspread.exceptions.WorksheetNotFound:
        print(f"Error: Worksheet named '{worksheet_name}' not found.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred fetching '{worksheet_name}': {e}")
        print(traceback.format_exc())
        return None

def load_manual_overrides(filename):
    """Loads manual categorization overrides from a JSON file. Assumes case-insensitive."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    override_path = os.path.join(script_dir, filename)
    
    if not os.path.exists(override_path):
        print(f"Info: Manual overrides file '{override_path}' not found. No overrides applied.")
        return []
    
    try:
        with open(override_path, 'r', encoding='utf-8') as f:
            overrides = json.load(f)
        if not isinstance(overrides, list):
             print(f"Warning: Content of '{override_path}' is not a JSON list. Overrides ignored.")
             return []
        
        valid_overrides = []
        # Update valid categories based on our discussion
        valid_categories = {'Kalaam', 'Personal', 'Metropolis', 'AutoOptimize', 'MPYRE Software Inc.', 'Kalaam Foundation'} 
        seen_fragments = set()

        for i, rule in enumerate(overrides):
            # Check if category exists and is valid, otherwise default to None or skip
            category = rule.get('category')
            if category not in valid_categories:
                 print(f"Warning: Rule {i+1} in '{filename}' has invalid or missing category '{category}'. Skipping rule.")
                 continue # Skip rules with invalid categories
            
            fragment = rule.get('fragment')
            if not fragment or not isinstance(fragment, str):
                 print(f"Warning: Rule {i+1} in '{filename}' has invalid or missing fragment. Skipping rule.")
                 continue # Skip rules with invalid fragments

            # Check for duplicates (case-insensitive)
            if fragment.lower() in seen_fragments:
                print(f"Warning: Skipping duplicate override fragment (case-insensitive): '{fragment}' in rule {i+1} in '{filename}'.")
                continue
                
            valid_overrides.append({'fragment': fragment, 'category': category})
            seen_fragments.add(fragment.lower())
                
        print(f"Loaded {len(valid_overrides)} valid manual override rules from '{filename}'.")
        return valid_overrides
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from '{override_path}'. Check format. Error: {e}")
        return []
    except Exception as e:
        print(f"Error loading overrides from '{override_path}': {e}")
        return []

def parse_raw_data(raw_data_str):
    """Safely parses the JSON string from the Raw Data column."""
    if not isinstance(raw_data_str, str) or not raw_data_str.strip():
        return None, None
    try:
        data = json.loads(raw_data_str)
        merchant = data.get('merchant_name') or data.get('name')
        category_info = data.get('personal_finance_category', {})
        sub_category = category_info.get('detailed') if isinstance(category_info, dict) else None
        if not sub_category and isinstance(category_info, dict):
             sub_category = category_info.get('primary')
        return merchant, sub_category
    except (json.JSONDecodeError, Exception):
        return None, None

# --- END OF PIECE 1 ---
# (Categorization function and main logic will be added next) 

# --- START OF PIECE 2 ---

# --- New Categorization Logic --- 

# Define keywords and identifiers based on categorization_rules.md
KALAAM_FOUNDATION_ACCOUNTS = [
    'COMMUNITY PLAN', 'BUSINESS INVESTOR ACCOUNT', 'Kalaam Donations', 
    'TD BASIC BUSINESS PLAN',
    '5244162', '5244952', '7303538', '2695', '1389', '2065' # Add IDs
]
MPYRE_SOFTWARE_ACCOUNTS = [
    'Mpyre', 'TD BUSINESS TRAVEL VISA', 'CANADIAN MARGIN', 'US MARGIN',
    '5217807', '7301012', '5082', '561HR0E', '561HR0F', '81J687A', '81J687B', '56J6Y7E', '56J6Y7F' # Add IDs
]
METROPOLIS_ACCOUNTS = [
    'Metropolis', 'US DOLLAR CARD', 'TD BUSINESS CASH BACK VISA',
    '5250184', '5253361', '7306877', '7307237', '7409', '4839', '2631' # Add IDs
]
AUTOOPTIMIZE_ACCOUNTS = [
    'AutoOptimize',
    '5246040', '7306838', '1147' # Add IDs
]

KALAAM_FOUNDATION_KEYWORDS = [
    'UPWORK', 'PURRWEB', 'OPENAI', 'ANAS', 'FIREBASE', 
    'VIMEO', 'JAHANZAIB', 'ISHAAQ', 'FRAMER'
]

# Specific Description Keywords (Hardcoded)
HARDCODED_DESC_MAP = {
    'Metropolis': ['WPS BILLING'],
    'Personal': ['PENNYAPPEAL CANADA', 'ALLSTATE', 'HWY407 ETR BPY']
}

def categorize_primary_v2(row, manual_overrides):
    """Applies the refined categorization logic based on categorization_rules.md"""
    account_name_field = row.get(ACCOUNT_COLUMN, '') # This field contains the name like "Mpyre CAD chequing (7807)"
    description = str(row.get(DESCRIPTION_COLUMN, '')).upper()
    
    account_identifier = str(account_name_field).upper() # Match against the full string

    # 1. Manual Overrides
    for override in manual_overrides:
        fragment = override['fragment']
        target_category = override['category']
        if fragment.upper() in description:
            return target_category 

    # 2. Specific Description Keywords
    for category, keywords in HARDCODED_DESC_MAP.items():
        for keyword in keywords:
            if keyword in description:
                return category

    # 3. Account Name / Identifier Matching
    # Use account_identifier which contains the full name + number string
    for identifier in KALAAM_FOUNDATION_ACCOUNTS:
        if identifier.upper() in account_identifier:
            return 'Kalaam Foundation'
    for identifier in MPYRE_SOFTWARE_ACCOUNTS:
        if identifier.upper() in account_identifier:
            return 'MPYRE Software Inc.'
    for identifier in METROPOLIS_ACCOUNTS:
        if identifier.upper() in account_identifier:
            return 'Metropolis'
    for identifier in AUTOOPTIMIZE_ACCOUNTS:
        if identifier.upper() in account_identifier:
            return 'AutoOptimize'

    # 4. Description Keywords for Kalaam Foundation
    for keyword in KALAAM_FOUNDATION_KEYWORDS:
        if keyword in description:
            return 'Kalaam Foundation'

    # 5. Default Category
    return 'Personal'

# --- New Data Processing Function --- 
def process_transactions_v2(df_trans, df_accounts, manual_overrides):
    """Processes transactions using the REFINED categorization logic (categorize_primary_v2).
       Does not apply the final date filter.
    """
    if df_trans is None or df_trans.empty:
        print("Cannot process transactions, DataFrame is empty or invalid.")
        return None
    if df_accounts is None or df_accounts.empty:
         print("Warning: Accounts DataFrame is empty or invalid. Cannot map currencies.")
         df_accounts = pd.DataFrame(columns=[ACCOUNT_NAME_COLUMN])

    # --- Find Currency Column --- (Same as main.py)
    currency_col_name = next((name for name in ['⚡ Currency', 'Currency'] if name in df_accounts.columns), None)
    if not currency_col_name:
         print(f"Warning: Currency column not found in Accounts sheet. Defaulting to USD.")
         df_accounts['DerivedCurrency'] = 'USD'
    else:
         df_accounts['DerivedCurrency'] = df_accounts[currency_col_name].fillna('USD').astype(str).str.upper()
    account_currency_map = df_accounts.set_index(ACCOUNT_NAME_COLUMN)['DerivedCurrency'].to_dict()

    # --- Deduplication --- (Same as main.py, includes safety checks)
    initial_rows = len(df_trans)
    subset_cols = [DATE_COLUMN, AMOUNT_COLUMN, DESCRIPTION_COLUMN, ACCOUNT_COLUMN]
    if all(col in df_trans.columns for col in subset_cols):
        try:
            df_trans[AMOUNT_COLUMN] = pd.to_numeric(df_trans[AMOUNT_COLUMN], errors='coerce')
            df_trans.dropna(subset=[AMOUNT_COLUMN], inplace=True)
            # Ensure other key columns are strings before dropping duplicates
            for col in [DATE_COLUMN, DESCRIPTION_COLUMN, ACCOUNT_COLUMN]:
                if col in df_trans.columns:
                     df_trans[col] = df_trans[col].astype(str)
            df_trans.drop_duplicates(subset=subset_cols, keep='first', inplace=True)
            print(f"Removed {initial_rows - len(df_trans)} duplicate rows.")
        except Exception as e:
             print(f"Warning: Error during deduplication ({e}). Skipping.")
    else:
        print(f"Warning: Columns missing for deduplication ({subset_cols}). Skipping.")

    # --- Data Cleaning & Preparation --- (Same as main.py)
    df = df_trans.copy()
    required_cols = [DATE_COLUMN, AMOUNT_COLUMN, DESCRIPTION_COLUMN, RAW_DATA_COLUMN, ACCOUNT_COLUMN]
    if not all(col in df.columns for col in required_cols):
         print(f"Error: Missing required columns for processing: {required_cols}. Available: {list(df.columns)}")
         return None
    
    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN], errors='coerce')
    # Ensure Amount is numeric after potential string conversion during dedupe
    df[AMOUNT_COLUMN] = pd.to_numeric(df[AMOUNT_COLUMN], errors='coerce') 
    df[DESCRIPTION_COLUMN] = df[DESCRIPTION_COLUMN].astype(str).fillna('')
    df[ACCOUNT_COLUMN] = df[ACCOUNT_COLUMN].astype(str).fillna('')
    df[RAW_DATA_COLUMN] = df[RAW_DATA_COLUMN].astype(str).fillna('')
    df.dropna(subset=[DATE_COLUMN, AMOUNT_COLUMN], inplace=True)
    if df.empty: return None

    # --- Map Currency --- (Same as main.py)
    df['Currency'] = df[ACCOUNT_COLUMN].map(account_currency_map).fillna('USD')

    # --- Filter Exclusions (Simplified - focus on transfers, payments) ---
    # User requested to KEEP these transactions, so this section is commented out.
    # def should_exclude_v2(description):
    #     if not description: return False
    #     upper_desc = description.upper()
    #     # Basic transfer/payment keywords
    #     exclude_keywords = [
    #         'TFR-TO', 'TFR-FR', 'TRANSFER TO', 'TRANSFER FROM',
    #         'TD VISA PREAUTH PYMT', 'PYT TO', 'PYMT TO', 'PYMT FR',
    #         'TD VISA PYMT MSP', 'PAYMENT RECEIVED', 'THANK YOU/MERCI', 
    #         'CREDIT CARD PAYMENT', 'ONLINE PAYMENT', 'AUTOMATIC PAYMENT',
    #         'RTN NSF' 
    #         # Add more specific patterns if needed, e.g., related to specific accounts
    #     ]
    #     # Exclude if ANY keyword is present
    #     return any(keyword in upper_desc for keyword in exclude_keywords)
    
    # exclude_mask = df[DESCRIPTION_COLUMN].apply(should_exclude_v2)
    # print(f"Filtered out {exclude_mask.sum()} transactions based on exclusion keywords.")
    # df_filtered = df[~exclude_mask].copy()
    # if df_filtered.empty: return None

    # All transactions are kept as per user request.
    df_filtered = df.copy()
    print("Transaction exclusion step bypassed as per user request. All transactions will be processed.")
    if df_filtered.empty: 
        print("DataFrame is empty before transaction type identification. This might be unexpected.")
        return None

    # --- Identify Transaction Type --- (Same as main.py)
    df_filtered['TransactionType'] = df_filtered[AMOUNT_COLUMN].apply(lambda x: 'Income' if x > 0 else 'Expense') # Removed 'Zero' check as we drop NAs

    # --- Parse Raw Data JSON --- (Same as main.py)
    parsed_data = df_filtered[RAW_DATA_COLUMN].apply(parse_raw_data)
    df_filtered['Merchant'] = parsed_data.apply(lambda x: x[0])
    df_filtered['SubCategory'] = parsed_data.apply(lambda x: x[1])
    df_filtered['Merchant'].fillna(df_filtered[DESCRIPTION_COLUMN], inplace=True)
    df_filtered['SubCategory'].fillna('Uncategorized', inplace=True)

    # --- Normalize E-Transfers --- (Same as main.py)
    etransfer_pattern = r'(E-TFR|E-TRANSFER|ETRANSFER|INTERAC)'
    is_etransfer = df_filtered[DESCRIPTION_COLUMN].str.contains(etransfer_pattern, case=False, regex=True, na=False)
    expense_etransfer_mask = is_etransfer & (df_filtered['TransactionType'] == 'Expense')
    df_filtered.loc[expense_etransfer_mask, 'Merchant'] = 'E-Transfer Expense' 
    income_etransfer_mask = is_etransfer & (df_filtered['TransactionType'] == 'Income')
    df_filtered.loc[income_etransfer_mask, 'Merchant'] = 'E-Transfer Income' 

    # --- *** APPLY NEW CATEGORIZATION *** ---
    print("Applying V2 categorization rules...")
    df_filtered['PrimaryCategory'] = df_filtered.apply(lambda row: categorize_primary_v2(row, manual_overrides), axis=1)
    print(f"Category distribution:\n{df_filtered['PrimaryCategory'].value_counts()}")

    # --- Add Absolute Amount --- 
    df_filtered['AbsAmount'] = df_filtered[AMOUNT_COLUMN].abs() 

    # --- Select and Reorder Columns for Output ---
    output_columns = [
        DATE_COLUMN, 
        ACCOUNT_COLUMN, 
        'Currency', 
        'PrimaryCategory', 
        'TransactionType', 
        'SubCategory', 
        'Merchant', 
        AMOUNT_COLUMN, 
        'AbsAmount',
        DESCRIPTION_COLUMN, 
        RAW_DATA_COLUMN # Keep raw data for reference
    ]
    # Ensure all desired columns exist before selecting
    final_columns = [col for col in output_columns if col in df_filtered.columns]
    df_final_categorized = df_filtered[final_columns].copy()

    print(f"Finished processing. {len(df_final_categorized)} transactions categorized.")
    return df_final_categorized

# --- END OF PIECE 2 ---
# (Main execution block will be added next) 

if __name__ == "__main__":
    print("--- Starting Transaction Categorization Script ---")
    
    # 1. Authenticate
    print("\nStep 1: Authenticating with Google Sheets...")
    gspread_client = authenticate_gsheets()
    if not gspread_client:
        print("Authentication failed. Exiting.")
        exit()
    print("Authentication successful.")

    # 2. Load Manual Overrides
    print(f"\nStep 2: Loading manual overrides from '{MANUAL_OVERRIDES_FILE}'...")
    manual_overrides = load_manual_overrides(MANUAL_OVERRIDES_FILE)
    # No exit needed if overrides fail, just proceeds without them

    # 3. Fetch Data
    print("\nStep 3: Fetching data from Google Sheets...")
    transactions_df = get_worksheet_df(gspread_client, SPREADSHEET_URL, TRANSACTIONS_WORKSHEET_NAME)
    accounts_df = get_worksheet_df(gspread_client, SPREADSHEET_URL, ACCOUNTS_WORKSHEET_NAME)

    if transactions_df is None or accounts_df is None:
        print("Failed to fetch required data from Google Sheets. Exiting.")
        exit()
    if transactions_df.empty:
         print("Transactions worksheet is empty. Nothing to process. Exiting.")
         exit()
    print("Data fetched successfully.")

    # 4. Process Transactions with V2 Logic
    print("\nStep 4: Processing transactions with V2 categorization logic...")
    categorized_df = process_transactions_v2(transactions_df, accounts_df, manual_overrides)

    # 5. Save Output
    if categorized_df is not None and not categorized_df.empty:
        print(f"\nStep 5: Saving categorized transactions to '{OUTPUT_CSV_FILE}'...")
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_path = os.path.join(script_dir, OUTPUT_CSV_FILE)
            # Ensure Date column is formatted nicely for CSV
            if DATE_COLUMN in categorized_df.columns:
                 categorized_df[DATE_COLUMN] = pd.to_datetime(categorized_df[DATE_COLUMN]).dt.strftime('%Y-%m-%d')
                 
            categorized_df.to_csv(output_path, index=False, encoding='utf-8')
            print(f"Successfully saved {len(categorized_df)} categorized transactions to {output_path}")
        except Exception as e:
            print(f"Error saving output CSV file: {e}")
    elif categorized_df is not None and categorized_df.empty:
        print("\nStep 5: No transactions remained after processing. Output file not saved.")
    else:
        print("\nStep 5: Processing failed. Output file not saved.")

    print("\n--- Transaction Categorization Script Finished ---") 