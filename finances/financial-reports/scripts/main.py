import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import os
import traceback
import re
from flask import Flask, request, jsonify, render_template_string
import threading
import json
import html # Import html module for escaping

# --- Flask App Initialization ---
app = Flask(__name__)

# --- In-memory storage (Global variables - simplified approach) ---
# Warning: Data is lost on server restart/scaling. Use a database for persistence.
global_data = {
    "transactions": None, # Will store the processed DataFrame
    "overrides": [],      # Will store the current manual overrides
    "last_updated": None,
    "is_processing": False
}
data_lock = threading.Lock() # To prevent race conditions during updates

# --- Configuration ---
# Updated file paths for the new directory structure
CREDENTIALS_FILE = os.path.join('config', 'serviceAccountKey.json')
SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit?gid=460839481#gid=460839481'
TRANSACTIONS_WORKSHEET_NAME = 'Transactions' 
ACCOUNTS_WORKSHEET_NAME = 'Accounts'
DATE_COLUMN = '⚡ Date'
AMOUNT_COLUMN = '⚡ Amount'
DESCRIPTION_COLUMN = '⚡ Description'
ACCOUNT_COLUMN = '⚡ Account'
ACCOUNT_NAME_COLUMN = '⚡ Account Name'
RAW_DATA_COLUMN = '⚡ Raw Data'

# --- Keywords & Identifiers ---
KALAAM_KEYWORDS = [
    'UPWORK', 'PURRWEB', 'OPENAI', 'ANAS', 'FIREBASE', 
    'VIMEO', 'JAHANZAIB', 'ISHAAQ', 'FRAMER'
] 
# Account identifiers (case-insensitive check)
METROPOLIS_ACCOUNT_IDENTIFIERS = ['METROPOLIS']
AUTOOPTIMIZE_ACCOUNT_IDENTIFIERS = ['AUTOOPTIMIZE']
KALAAM_ACCOUNT_IDENTIFIERS = [
    '5244162', '5244952', '7303538', 'COMMUNITY PLAN', # Original Kalaam
    'MPYRE', '7807', '1012', '5082' # Added Mpyre identifiers
]

# --- Manual Override Configuration ---
# Updated path for the new directory structure
MANUAL_OVERRIDES_FILE = os.path.join('config', 'spending_overrides.json')

# --- End Configuration ---

# --- Helper Functions (authenticate_gsheets, get_worksheet_df, extract_account_ids) ---
def authenticate_gsheets():
    """Authenticates with Google Sheets API using service account."""
    # Check for local credentials file first, then fall back to deployment path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    creds_path = os.path.join(script_dir, CREDENTIALS_FILE)
    
    if not os.path.exists(creds_path):
        # Fall back to deployment path
        creds_path = '/etc/secrets/serviceAccountKey.json'
        
    if not os.path.exists(creds_path):
        print(f"Error: Credentials file not found at '{creds_path}'")
        return None

    credentials = ServiceAccountCredentials.from_json_keyfile_name(creds_path)
    return gspread.authorize(credentials)

def get_worksheet_df(gspread_client, spreadsheet_url, worksheet_name):
    """Fetches a DataFrame from a Google Sheets worksheet using its name."""
    try:
        print(f"Attempting to open spreadsheet URL: {spreadsheet_url}")
        sheet_object = gspread_client.open_by_url(spreadsheet_url)
        print(f"Successfully opened spreadsheet: '{sheet_object.title}'")
        worksheet = sheet_object.worksheet(worksheet_name)
        print(f"Accessing worksheet: '{worksheet.title}'")

        # Use get_all_records for robust header detection and data fetching
        data = worksheet.get_all_records()
        if not data:
            print(f"Warning: No data found in worksheet '{worksheet_name}'.")
            return None 
        df = pd.DataFrame(data)
        print(f"Successfully fetched {len(df)} records from '{worksheet_name}'. Available columns: {list(df.columns)}")
        return df
    except gspread.exceptions.SpreadsheetNotFound:
        print(f"Error: Spreadsheet not found at URL: {spreadsheet_url}")
        print("Please ensure the URL is correct and the service account has access.")
        return None
    except gspread.exceptions.WorksheetNotFound:
        print(f"Error: Worksheet named '{worksheet_name}' not found.")
        return None
    except gspread.exceptions.APIError as e:
        print(f"Google Sheets API Error: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while fetching data from '{worksheet_name}':")
        print(traceback.format_exc())
        return None

def extract_account_ids(df):
    """Extracts account IDs from a DataFrame."""
    if df is None or df.empty:
        return []
    return df[ACCOUNT_COLUMN].unique().tolist()

# --- Formatting Helper ---
def format_compact(amount):
    """Formats amount into compact string (e.g., 1.2k, 15.5k, 1.1M)."""
    abs_amount = abs(amount)
    sign = "+" if amount >= 0 else "-"
    if abs_amount < 1000:
        # Show 0-2 decimal places for small amounts if needed, or just int
        return f"{sign}{abs_amount:,.0f}" 
    elif abs_amount < 1000000:
        return f"{sign}{abs_amount/1000:,.1f}k"
    else:
        return f"{sign}{abs_amount/1000000:,.1f}M"

# --- JSON Parsing Helper ---
def parse_raw_data(raw_data_str):
    """Safely parses the JSON string from the Raw Data column."""
    if not isinstance(raw_data_str, str) or not raw_data_str.strip():
        return None, None # Return None for merchant and category if input is invalid
    try:
        data = json.loads(raw_data_str)
        merchant = data.get('merchant_name', None) # Plaid sometimes uses this
        if not merchant:
             merchant = data.get('name', None) # Fallback to general name field

        category_info = data.get('personal_finance_category', {})
        if isinstance(category_info, dict):
            sub_category = category_info.get('detailed', None)
            if not sub_category:
                sub_category = category_info.get('primary', None) # Fallback to primary
        else: # Handle cases where category_info might not be a dict
            sub_category = None
        
        return merchant, sub_category
    except json.JSONDecodeError:
        # print(f"Warning: Could not decode JSON: {raw_data_str[:100]}...") # Optional: for debugging
        return None, None
    except Exception as e:
        # print(f"Warning: Error parsing JSON ({e}): {raw_data_str[:100]}...") # Optional: for debugging
        return None, None

# --- Manual Override Loading --- 
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
        
        # Basic validation of override structure (simplified)
        valid_overrides = []
        valid_categories = {'Kalaam', 'Personal', 'Metropolis', 'AutoOptimize'}
        seen_fragments = set() # To check for duplicate fragments

        for i, rule in enumerate(overrides):
            if isinstance(rule, dict) and \
               'fragment' in rule and isinstance(rule['fragment'], str) and rule['fragment'] and \
               'category' in rule and rule['category'] in valid_categories:
                
                fragment = rule['fragment']
                # Check for duplicates (case-insensitive)
                if fragment.lower() in seen_fragments:
                    print(f"Warning: Skipping duplicate override fragment (case-insensitive): '{fragment}' in rule {i+1} in '{filename}'.")
                    continue
                    
                # Store only fragment and category, always treat as case-insensitive later
                valid_overrides.append({'fragment': fragment, 'category': rule['category']})
                seen_fragments.add(fragment.lower())
                # Ignore case_sensitive flag if present
            else:
                print(f"Warning: Skipping invalid rule {i+1} in '{filename}'. Needs 'fragment' (non-empty string) and 'category' (one of {valid_categories}).")
                
        print(f"Loaded {len(valid_overrides)} valid manual override rules from '{filename}'.")
        return valid_overrides
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from '{override_path}'. Check the file format. Error: {e}")
        return []
    except Exception as e:
        print(f"Error loading overrides from '{override_path}': {e}")
        return []

# --- Data Fetching and Processing Logic ---
def fetch_and_process_data(manual_overrides):
    """Fetches data from Google Sheets and processes it."""
    print("Starting data fetch and processing...")
    gspread_client = authenticate_gsheets()
    if not gspread_client:
        print("Authentication failed.")
        # Return None for data, keep existing overrides
        return None 

    transactions_df = get_worksheet_df(gspread_client, SPREADSHEET_URL, TRANSACTIONS_WORKSHEET_NAME)
    accounts_df = get_worksheet_df(gspread_client, SPREADSHEET_URL, ACCOUNTS_WORKSHEET_NAME)

    if transactions_df is None or accounts_df is None:
        print("Failed to fetch required worksheet data.")
        return None
    
    # Pass the current manual overrides to the processing function
    processed_data, _ = process_transactions(transactions_df, accounts_df, manual_overrides) 
    # process_transactions now returns (dataframe, overrides_used), we only need df here
    
    print("Finished data fetch and processing.")
    return processed_data # Return only the processed dataframe

# --- Main Data Processing Function (Modified to accept overrides as argument) ---
def process_transactions(df_trans, df_accounts, manual_overrides):
    """Processes transactions: cleans, filters, categorizes, parses JSON, adds currency, identifies income/expense.
       Accepts manual_overrides list as an argument.
    """
    if df_trans is None or df_trans.empty:
        print("Cannot process transactions, DataFrame is empty or invalid.")
        return None, manual_overrides # Return None and the overrides passed in
    if df_accounts is None or df_accounts.empty:
         print("Warning: Accounts DataFrame is empty or invalid. Cannot map currencies.")
         df_accounts = pd.DataFrame(columns=[ACCOUNT_NAME_COLUMN]) # Create empty to avoid merge error

    # --- Find Currency Column in Accounts ---
    currency_col_name = None
    possible_currency_names = ['⚡ Currency', 'Currency']
    for name in possible_currency_names:
        if name in df_accounts.columns:
            currency_col_name = name
            break

    if not currency_col_name:
         print(f"Warning: Currency column not found in Accounts sheet ({possible_currency_names}). Amounts will lack specific currency.")
         df_accounts['DerivedCurrency'] = 'USD' # Default if not found
    else:
         df_accounts['DerivedCurrency'] = df_accounts[currency_col_name].fillna('USD').astype(str).str.upper()

    account_currency_map = df_accounts.set_index(ACCOUNT_NAME_COLUMN)['DerivedCurrency'].to_dict()
    print(f"Created account-to-currency map for {len(account_currency_map)} accounts.")

    # --- Deduplication ---
    initial_rows = len(df_trans)
    subset_cols = [DATE_COLUMN, AMOUNT_COLUMN, DESCRIPTION_COLUMN, ACCOUNT_COLUMN] # Columns to identify duplicates
    if all(col in df_trans.columns for col in subset_cols):
        try:
            df_trans[AMOUNT_COLUMN] = pd.to_numeric(df_trans[AMOUNT_COLUMN], errors='coerce')
            df_trans.dropna(subset=[AMOUNT_COLUMN], inplace=True)
            df_trans[DESCRIPTION_COLUMN] = df_trans[DESCRIPTION_COLUMN].astype(str)
            df_trans[ACCOUNT_COLUMN] = df_trans[ACCOUNT_COLUMN].astype(str)
            df_trans.drop_duplicates(subset=subset_cols, keep='first', inplace=True)
            rows_after_dedup = len(df_trans)
            print(f"Removed {initial_rows - rows_after_dedup} duplicate rows based on Date, Amount, Description, Account.")
        except KeyError as e:
             print(f"Warning: Column {e} not found during pre-deduplication conversion. Skipping deduplication step.")
        except Exception as e:
             print(f"Warning: Error during pre-deduplication conversion ({e}). Skipping deduplication step.")
    else:
        print(f"Warning: One or more columns ({subset_cols}) needed for deduplication not found. Skipping deduplication step.")

    # --- Data Cleaning and Preparation ---
    required_cols = [DATE_COLUMN, AMOUNT_COLUMN, DESCRIPTION_COLUMN, RAW_DATA_COLUMN, ACCOUNT_COLUMN]
    for col in required_cols:
        if col not in df_trans.columns:
            print(f"Error: Required column '{col}' not found in Transactions. Cannot proceed.")
            print(f"Available columns: {list(df_trans.columns)}")
            return None, manual_overrides

    df = df_trans.copy()
    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN], errors='coerce')
    df[DESCRIPTION_COLUMN] = df[DESCRIPTION_COLUMN].astype(str).fillna('')
    df[ACCOUNT_COLUMN] = df[ACCOUNT_COLUMN].astype(str).fillna('') 
    df[RAW_DATA_COLUMN] = df[RAW_DATA_COLUMN].astype(str).fillna('')
    df.dropna(subset=[DATE_COLUMN, AMOUNT_COLUMN], inplace=True) 

    if df.empty:
        print("No valid data remaining after initial cleaning.")
        return None, manual_overrides

    # --- Map Currency to Transactions ---
    df['Currency'] = df[ACCOUNT_COLUMN].map(account_currency_map).fillna('USD') 
    print(f"Mapped currencies to transactions. Currency distribution:\n{df['Currency'].value_counts()}")

    # --- Filter Exclusions (Transfers & Payments - Updated) ---
    def should_exclude(description, account_name): 
        if description:
            upper_desc = description.upper()
            if 'GOOGLE PAYMENT MSP' in upper_desc:
                return False 
            exclude_keywords = [
                'PAYMENT', 'TFR-TO', 'TFR-FR', 'TRANSFER TO', 'TRANSFER FROM',
                'TD VISA PREAUTH PYMT', 'PYT TO', 'PYMT TO', 'PYMT FR',
                'TD VISA PYMT MSP', 'PAYMENT RECEIVED', 'THANK YOU/MERCI', 
                'CREDIT CARD PAYMENT', 'ONLINE PAYMENT', 'AUTOMATIC PAYMENT',
                'RTN NSF' 
            ]
            for keyword in exclude_keywords:
                if keyword in upper_desc:
                    return True 
        if account_name:
            if 'MARIAM' in str(account_name).upper():
                return True 
        return False 

    if DESCRIPTION_COLUMN in df.columns and ACCOUNT_COLUMN in df.columns:
        exclude_mask = df.apply(lambda row: should_exclude(row[DESCRIPTION_COLUMN], row[ACCOUNT_COLUMN]), axis=1)
        print(f"Filtered out {exclude_mask.sum()} transactions (Potential Transfers, Payments, Mariam accounts).")
        df_filtered = df[~exclude_mask].copy()
    else:
        print("Warning: Description or Account column missing, cannot apply full exclusion filter.")
        df_filtered = df.copy() 

    # --- Identify Transaction Type (Income/Expense) ---
    df_filtered['TransactionType'] = df_filtered[AMOUNT_COLUMN].apply(lambda x: 'Income' if x > 0 else ('Expense' if x < 0 else 'Zero'))
    df_filtered = df_filtered[df_filtered['TransactionType'] != 'Zero'].copy()
    print(f"Identified transaction types:\n{df_filtered['TransactionType'].value_counts()}")

    if df_filtered.empty:
        print("No valid income or expense transactions found after filtering exclusions.")
        return None, manual_overrides

    # --- Parse Raw Data JSON for Merchant & SubCategory ---
    parsed_data = df_filtered[RAW_DATA_COLUMN].apply(parse_raw_data)
    df_filtered['Merchant'] = parsed_data.apply(lambda x: x[0])
    df_filtered['SubCategory'] = parsed_data.apply(lambda x: x[1])

    if DESCRIPTION_COLUMN in df_filtered.columns:
        df_filtered['Merchant'].fillna(df_filtered[DESCRIPTION_COLUMN], inplace=True)
    else:
        df_filtered['Merchant'].fillna('Unknown Merchant', inplace=True)
        print(f"Warning: {DESCRIPTION_COLUMN} not found, cannot use as fallback for Merchant.")
    df_filtered['SubCategory'].fillna('Uncategorized', inplace=True)

    # --- Normalize E-Transfer Merchants ---
    if DESCRIPTION_COLUMN in df_filtered.columns:
        etransfer_pattern = r'(E-TFR|E-TRANSFER|ETRANSFER|INTERAC)'
        is_etransfer = df_filtered[DESCRIPTION_COLUMN].str.contains(etransfer_pattern, case=False, regex=True, na=False)
        expense_etransfer_mask = is_etransfer & (df_filtered['TransactionType'] == 'Expense')
        df_filtered.loc[expense_etransfer_mask, 'Merchant'] = 'E-Transfer Expense' 
        income_etransfer_mask = is_etransfer & (df_filtered['TransactionType'] == 'Income')
        df_filtered.loc[income_etransfer_mask, 'Merchant'] = 'E-Transfer Income' 
        normalized_count = expense_etransfer_mask.sum() + income_etransfer_mask.sum()
        if normalized_count > 0:
             print(f"Normalized {normalized_count} e-transfer transactions (Income/Expense).")
    else:
        print(f"Warning: {DESCRIPTION_COLUMN} not found, cannot normalize E-Transfer merchants.")

    # --- Categorize Primary Spending (Applied to all transactions) ---
    def categorize_primary(row, manual_overrides): 
        account_name = str(row[ACCOUNT_COLUMN]).upper() 
        desc_val = row[DESCRIPTION_COLUMN]
        description = str(desc_val) if pd.notna(desc_val) else ''

        # --- Priority -1: Manual Overrides (Check First!) ---
        for override in manual_overrides:
            fragment = override['fragment']
            target_category = override['category']
            # Always case-insensitive check now
            if fragment.lower() in description.lower():
                return target_category

        # --- Priority 0: Specific Description Overrides (Original Logic) ---
        upper_desc = description.upper() 
        if 'WPS BILLING' in upper_desc:
            return 'Metropolis'
        if any(keyword in upper_desc for keyword in ['PENNYAPPEAL CANADA', 'ALLSTATE', 'HWY407 ETR BPY']): # Use upper_desc here too
            return 'Personal'
        
        # Priority 1: Account Name checks 
        for identifier in METROPOLIS_ACCOUNT_IDENTIFIERS:
            if identifier in account_name: return 'Metropolis'
        if '2631' in account_name: return 'Metropolis' 
        for identifier in AUTOOPTIMIZE_ACCOUNT_IDENTIFIERS:
            if identifier in account_name: return 'AutoOptimize'
        if 'KALAAM' in account_name:
            return 'Kalaam'
        for identifier in KALAAM_ACCOUNT_IDENTIFIERS:
             if identifier in account_name: return 'Kalaam'

        # Priority 2: Description Keyword check for Kalaam
        for keyword in KALAAM_KEYWORDS:
            if keyword in upper_desc: return 'Kalaam' # Use upper_desc

        # Default
        return 'Personal'

    df_filtered['PrimaryCategory'] = df_filtered.apply(lambda row: categorize_primary(row, manual_overrides), axis=1)

    # --- Filter by Date (Last 11 Full Months + Current Month to Date) ---
    today = datetime.today()
    end_date = datetime(today.year, today.month, today.day) + timedelta(days=1)
    start_date = datetime(today.year, today.month, 1) - relativedelta(months=11)
    print(f"Processing transactions from {start_date.strftime('%Y-%m-%d')} up to {today.strftime('%Y-%m-%d')} (inclusive)")

    date_mask = (df_filtered[DATE_COLUMN] >= start_date) & (df_filtered[DATE_COLUMN] < end_date)
    df_final_report = df_filtered.loc[date_mask].copy()

    if df_final_report.empty:
        print("No transactions found in the specified date range.")
        return None, manual_overrides

    # Prepare final columns
    df_final_report['AbsAmount'] = df_final_report[AMOUNT_COLUMN].abs() 
    df_final_report['Month'] = df_final_report[DATE_COLUMN].dt.strftime('%Y-%m')

    print(f"Finished processing {len(df_final_report)} transactions (Income & Expense) for the report.")
    
    # Return DataFrame and the overrides that were actually used in THIS processing run
    return df_final_report[[
        'Month', DATE_COLUMN, ACCOUNT_COLUMN, 'Currency', 'PrimaryCategory', 
        'TransactionType', 'SubCategory', 'Merchant', 'AbsAmount', 
        DESCRIPTION_COLUMN, AMOUNT_COLUMN
    ]], manual_overrides # Return the overrides list passed in

# --- Recurring Subscription Identification (Revised Logic - Grouping Fix) ---
def identify_recurring(df_expenses, min_months=3):
    """
    Identifies potential recurring EXPENSES based on frequency and
    calculates the average monthly spend over the active period. Handles currency.
    Groups by PrimaryCategory, Merchant, Currency (ignoring SubCategory).
    """
    print(f"\nIdentifying potential recurring EXPENSES (appearing >= {min_months} months) using average spend...")

    if df_expenses is None or df_expenses.empty:
        print("No expense data provided to identify recurring subscriptions.")
        return pd.DataFrame()

    df_expenses_only = df_expenses[df_expenses['TransactionType'] == 'Expense'].copy()
    if df_expenses_only.empty:
        print("No expense transactions found in the data provided for recurrence check.")
        return pd.DataFrame()

    AMOUNT_COL_FOR_RECURRING = 'AbsAmount'
    group_cols_initial = ['PrimaryCategory', 'Merchant', 'Currency']
    grouped_initial = df_expenses_only.groupby(group_cols_initial)

    try:
        aggregated_data = grouped_initial.agg(
            DisplaySubCategory=('SubCategory', lambda x: x.mode()[0] if not x.mode().empty else 'Multiple/Uncategorized'),
            MonthCount=('Month', 'nunique'),
            MinMonth=('Month', 'min'),
            MaxMonth=('Month', 'max'),
            TotalSpend=(AMOUNT_COL_FOR_RECURRING, 'sum') 
        ).reset_index()
    except Exception as e:
        print(f"Error during recurring aggregation: {e}")
        return pd.DataFrame()

    recurring_candidates = aggregated_data[aggregated_data['MonthCount'] >= min_months].copy()

    if recurring_candidates.empty:
         print("No recurring expense candidates found after initial aggregation and month count filter.")
         return pd.DataFrame()

    recurring_list = []
    for index, row in recurring_candidates.iterrows():
        primary_cat = row['PrimaryCategory']
        sub_cat = row['DisplaySubCategory']
        merchant = row['Merchant']
        currency = row['Currency']
        month_count = row['MonthCount']
        min_month_str = row['MinMonth']
        max_month_str = row['MaxMonth']
        total_spend = row['TotalSpend'] 

        try:
            start_dt = datetime.strptime(min_month_str + '-01', '%Y-%m-%d')
            end_dt = datetime.strptime(max_month_str + '-01', '%Y-%m-%d')
            delta = relativedelta(end_dt, start_dt)
            months_in_period = delta.years * 12 + delta.months + 1
        except ValueError:
            print(f"Warning: Could not parse months '{min_month_str}', '{max_month_str}' for {primary_cat}/{merchant}/{currency}. Skipping recurring candidate.")
            continue

        if months_in_period <= 0: months_in_period = 1
        average_monthly_spend = total_spend / months_in_period
        
        # --- DEBUG LOGGING REMOVED FOR BREVITY ---

        recurring_list.append({
            'PrimaryCategory': primary_cat, 'SubCategory': sub_cat, 'Merchant': merchant,
            'AverageMonthlySpend': average_monthly_spend, 'TotalSpend': total_spend,
            'MonthCount': month_count, 'MonthsInPeriod': months_in_period,
            'FirstMonth': min_month_str, 'LastMonth': max_month_str, 'Currency': currency
        })

    recurring_df = pd.DataFrame(recurring_list)
    if not recurring_df.empty:
        recurring_df.sort_values(
            by=['PrimaryCategory', 'Currency', 'AverageMonthlySpend'],
            ascending=[True, True, False], inplace=True )

    print(f"Identified {len(recurring_df)} potential recurring expense entries (grouped by Primary, Merchant, Currency).")
    return recurring_df


# --- HTML Generation Function (Updated for Flask) ---
def generate_html_report(df_report, manual_overrides, last_updated_time):
    """Generates the full HTML report string for Flask, including data and override manager."""
    print(f"\nGenerating interactive HTML report string...")

    if df_report is None or df_report.empty:
        print("No data provided to generate_html_report.")
        # Return a minimal HTML indicating no data, using last_updated_time
        return f"""<!DOCTYPE html><html><head><title>Financial Report</title></head><body>
                   <h1>Financial Report</h1>
                   <p>No transaction data found for the specified period or an error occurred.</p>
                   <p>Last Attempted Update: {last_updated_time if last_updated_time else 'Never'}</p>
                   </body></html>"""

    # Ensure required columns exist
    if 'AbsAmount' not in df_report.columns or 'TransactionType' not in df_report.columns:
        print("Error: Required columns ('AbsAmount', 'TransactionType') missing in report data.")
        return f"Error: Report data is missing required columns. Last Updated: {last_updated_time if last_updated_time else 'Never'}"

    # --- Identify Recurring Expenses ---
    df_expenses_only = df_report[df_report['TransactionType'] == 'Expense'].copy()
    recurring_df = identify_recurring(df_expenses_only)

    # Define categories
    all_primary_categories = sorted(['Kalaam', 'Personal', 'Metropolis', 'AutoOptimize'])

    # --- Start HTML String ---
    # Use f-string for embedding Python variables directly. Escape curly braces used for CSS/JS with double braces {{ }}
    html_parts = []
    html_parts.append(f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Financial Report</title>
    <style>
        /* Base styles */
        html {{ font-size: 16px; /* Base font size */ }}\n        body {{ \
            font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n            margin: 1rem; \
            line-height: 1.5;\n            background-color: #f9f9f9;\n        }}\n        h1, h2, h3 {{ color: #333; margin-top: 1.5rem; margin-bottom: 0.5rem; }}\n        h1 {{ font-size: 2rem; }}\n        h2 {{ font-size: 1.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.3rem; }}\n        h3 {{ font-size: 1.2rem; margin-top: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.2rem; }}\n        hr {{ border: none; border-top: 1px solid #eee; margin: 1.5rem 0; }}\n\n        /* Layout & Spacing */\n        details {{ \
            border: 1px solid #ccc; \
            border-radius: 5px; \
            padding: 0; /* Remove default padding */\n            margin-bottom: 1rem; \
            background-color: #fff; \
            overflow: hidden; /* Ensure children fit */\n        }}\n        details > summary {{ \
            font-weight: bold; \
            cursor: pointer; \
            padding: 0.75rem 1rem; \
            margin: 0;\n            background-color: #f1f1f1; \
            border-bottom: 1px solid #ccc; \
            position: relative; \
            list-style: none; /* Remove default triangle */\n        }}\n        details > summary::-webkit-details-marker {{ display: none; }} /* Hide marker in Chrome/Safari */\n        details > summary::before {{ /* Custom marker */\n            content: '\\25B6'; /* Right-pointing triangle */\n            display: inline-block;\n            margin-right: 0.5rem;\n            font-size: 0.8em;\n            transition: transform 0.2s;\n        }}\n        details[open] > summary::before {{ \
            transform: rotate(90deg); \
        }}\n\n        .details-content {{ /* Wrapper for content inside details */\n            padding: 0.5rem 1rem 1rem 1rem;\n        }}\n\n        /* Specific Sections Styling */\n        .income-text {{ color: #28a745; }}\n        .expense-text {{ color: #dc3545; }}\n        .income-section h3, .income-section .category-details.income > summary {{ color: #155724; border-color: #c3e6cb; }}\n        .expense-section h3, .expense-section .category-details.expense > summary {{ color: #721c24; border-color: #f5c6cb; }}\n        .income-section .item-details.income > summary {{ background-color: #d4edda; }}\n        .expense-section .item-details.expense > summary {{ background-color: #f8d7da; }}\n\n        details.outer-recurring-details {{ border-color: #aaa; }}\n        details.outer-recurring-details > summary {{ background-color: #ddd; color: #333; }}\n        details.month-details > summary {{ font-size: 1.1rem; background-color: #e9ecef; color: #111; }}\n        details.month-details {{ border-color: #adb5bd; }}\n\n        details.category-details {{ margin-left: 0; margin-top: 0.75rem; border: 1px solid #dee2e6; }}\n        details.category-details > summary {{ font-weight: bold; background-color: #e9ecef; }}\n        \n        details.item-details {{ margin-left: 1rem; margin-top: 0.5rem; border: 1px solid #ddd; background-color: #f9f9f9; }}\n        details.item-details.income {{ border-color: #c3e6cb; }}\n        details.item-details.expense {{ border-color: #f5c6cb; }}\n        details.item-details > summary {{ font-size: 1rem; font-weight: normal; background-color: #f8f9fa; border-bottom: 1px solid #ddd; }}\n        details.item-details > summary > strong {{ \
            float: right; \
            margin-left: 1em; \
            font-weight: 600; /* Slightly bolder */\n        }}\n\n        details.subscription-item {{ margin-bottom: 0.5rem; border-color: #dde; background-color: #f7f7ff; margin-left: 1rem; }}\n        details.subscription-item > summary {{ font-size: 1rem; background-color: #eef; font-weight: normal; }}\n        details.subscription-item > summary > strong {{ float: right; margin-left: 1em; font-weight: 600; }}\n\n        /* Table Styles */\n        .table-container {{ overflow-x: auto; margin-top: 0.5rem; }} /* Allow horizontal scroll */\n        table.transaction-table {{ \
            width: 100%; \
            border-collapse: collapse; \
            font-size: 0.9rem; \
            min-width: 500px; /* Prevent extreme squishing */\n        }}\n        table.transaction-table th, table.transaction-table td {{ \
            border: 1px solid #ddd; \
            padding: 0.5rem 0.75rem; /* Increased padding */\n            text-align: left; \
            vertical-align: top; \
            white-space: nowrap; /* Prevent wrapping initially */\n        }}\n        table.transaction-table th {{ \
            background-color: #f8f9fa; \
            cursor: pointer; \
            position: sticky; /* Keep headers visible if table scrolls */\n            top: 0;\n            z-index: 1; \n        }}\n        table.transaction-table th.sort-asc::after {{ content: ' ▲'; }}\n        table.transaction-table th.sort-desc::after {{ content: ' ▼'; }}\n        /* Removed background colors on rows, use text color */\n        td.amount {{ text-align: right; }}\n        td.income-amount {{ color: #28a745; font-weight: bold; }}\n        td.expense-amount {{ color: #dc3545; font-weight: bold; }}\n        td.description-cell {{ white-space: normal; }} /* Allow description to wrap */\n        \n        /* Override Management Styles */\n        .override-manager {{ margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; background-color: #fdfdff; border-radius: 5px; }}\n        #override-json-output {{ width: 95%; min-height: 150px; font-family: monospace; font-size: 0.9em; margin-top: 0.5rem; border: 1px solid #ddd; padding: 5px; background-color: #fff; }} \n        .validation-message {{ margin-top: 0.5rem; font-weight: bold; }}\n        .error-message {{ color: #dc3545; }}\n        .success-message {{ color: #28a745; }}\n\n        /* Status Bar Styles */\n        .status-bar {{ margin-bottom: 1.5rem; padding: 0.75rem 1rem; background-color: #e9ecef; border-radius: 5px; font-size: 0.9rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }}\n        #refresh-btn {{ padding: 0.4rem 0.8rem; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; }}\n        #refresh-btn:hover {{ background-color: #0056b3; }}\n        #update-status {{ font-style: italic; color: #555; }}\n\n        /* Buttons */\n        .mark-personal-btn {{ \
             margin-left: 0.5rem; \
             padding: 1px 4px; \
             font-size: 0.8em; \
             cursor: pointer; \
             background-color: #e0e0e0; \
             border: 1px solid #ccc; \
             border-radius: 3px; \
             vertical-align: middle;\n        }}\n        .mark-personal-btn:hover {{ background-color: #d0d0d0; }}\n\n        /* Indicators */\n        .recent-indicator {{\n            color: #28a745; \
            font-size: 1.2em; \
            margin-left: 0.3rem;\n            display: inline-block; \
            vertical-align: middle; \
            line-height: 1; \
        }}\n\n        /* Mobile Responsiveness */\n        @media (max-width: 768px) {{\n            html {{ font-size: 14px; /* Slightly smaller base on mobile */ }}\n            body {{ margin: 0.5rem; }}\n            h1 {{ font-size: 1.8rem; }}\n            h2 {{ font-size: 1.4rem; }}\n            h3 {{ font-size: 1.1rem; }}\n\n            details > summary {{ padding: 0.6rem 0.8rem; }}\n            .details-content {{ padding: 0.5rem 0.8rem 0.8rem 0.8rem; }}\n            \n            details.item-details {{ margin-left: 0.5rem; }}\n            details.subscription-item {{ margin-left: 0.5rem; }}\n            \n            .status-bar {{ flex-direction: column; align-items: flex-start; }}\n\n            /* Make table cells display as blocks - UNCOMMENTED AND ENABLED */\n            table.transaction-table thead {{ display: none; }} \n            table.transaction-table tr {{ \
                display: block; \
                margin-bottom: 1rem; \
                border: 1px solid #ddd; /* Add border around the block */\n                border-radius: 4px; /* Optional: rounded corners */\n                padding: 0.5rem; \n                background-color: #fff; /* White background for each row block */\n            }} \n            table.transaction-table td {{ \
                display: block; 
                text-align: left; /* Align value to the left now */
                border: none; /* Remove individual cell borders */
                border-bottom: 1px dotted #eee; /* Light separator */
                /* Remove padding-left, add padding-top for label */
                padding-left: 0.5rem; /* Keep some left padding for the value */
                padding-top: 1.5em; /* Make space for the label above */ 
                position: relative; 
                white-space: normal; /* Allow wrapping */
                padding-bottom: 0.3rem;
                min-height: 2.5em; /* Ensure cell has enough height for label+value */
            }}
            table.transaction-table tr td:last-child {{ border-bottom: none; }} /* Remove border on last cell */
            table.transaction-table td::before {{ 
                content: attr(data-label); 
                position: absolute; 
                top: 0.3rem; /* Position label at the top */
                left: 0.5rem; /* Align label to the left padding */
                width: auto; /* Let label take natural width */
                padding-right: 0.5rem; 
                font-weight: bold; 
                font-size: 0.8em; /* Smaller label */
                color: #555; /* Grey label */
                text-align: left;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }}
        }}\n\n    </style>\n</head>\n<body>\n    <h1>Financial Report</h1>\n\n    <div class=\"status-bar\">\n        <span id=\"last-updated\">Last Updated: {last_updated_time if last_updated_time else 'Never'}</span>\n        <span>\n            <button id=\"refresh-btn\">Refresh Data from Sheets</button>\n            <span id=\"update-status\"></span>\n        </span>\n    </div>\n\n    <hr>\n""")

    # --- Recurring Section HTML ---
    html_parts.append("""
    <details class="outer-recurring-details">
        <summary>Potential Recurring Expenses (Avg Monthly Spend over Active Period)</summary>
        <div class="recurring-section-content">
""")
    table_id_counter = 0 # Reset counter for this report generation
    if not recurring_df.empty:
        # Define today's date once before the loop for efficiency
        today = pd.Timestamp.today().normalize() 
        thirty_one_days_ago = today - pd.Timedelta(days=31)

        for _, sub_row in recurring_df.iterrows():
            primary_cat = sub_row['PrimaryCategory']
            merchant = sub_row['Merchant']
            avg_spend = sub_row['AverageMonthlySpend']
            currency = sub_row['Currency']
            symbol = '$' if currency == 'USD' else ('CA$' if currency == 'CAD' else f'{currency} ')
            avg_spend_str = f"{symbol}{avg_spend:,.2f} ({currency})" 
            month_count = sub_row['MonthCount'] 
            months_in_period = sub_row['MonthsInPeriod']

            sub_transactions = df_expenses_only[ 
                (df_expenses_only['PrimaryCategory'] == primary_cat) &
                (df_expenses_only['Merchant'] == merchant) &
                (df_expenses_only['Currency'] == currency) 
            ] # No need to sort here yet, just need the max date

            # --- BEGIN ADDED LOGIC ---
            is_recent = False
            if not sub_transactions.empty:
                latest_transaction_date = sub_transactions[DATE_COLUMN].max()
                # Ensure the date is valid and comparable
                if pd.notna(latest_transaction_date) and latest_transaction_date >= thirty_one_days_ago:
                    is_recent = True
            
            recent_indicator_html = '<span class="recent-indicator" title="Charged within last 31 days">●</span>' if is_recent else ''
            # --- END ADDED LOGIC ---

            # --- SIMPLIFIED SUMMARY --- 
            simplified_summary_str = f"{primary_cat} - {merchant}{recent_indicator_html} <strong>~{avg_spend_str} / mo</strong>"
            # --- Details to move inside --- 
            period_details_str = f"({month_count} tx months / {months_in_period} period months)"

            html_parts.append(f'    <details class="subscription-item">\n')
            # Use the simplified summary string here
            html_parts.append(f'        <summary>{simplified_summary_str}</summary>\n') 

            # --- Add period details inside the collapsible content --- 
            html_parts.append(f'        <div class="details-content">\n') # Start content wrapper
            html_parts.append(f'            <p><i>Frequency: {period_details_str}</i></p>\n') 

            # Now sort for display within the details if needed
            sorted_sub_transactions = sub_transactions.sort_values(by=DATE_COLUMN, ascending=False)

            if not sorted_sub_transactions.empty:
                table_id_counter += 1 
                tbody_id = f"tbody-recurring-{table_id_counter}" 
                html_parts.append(f'        <table class="transaction-table">\n')
                html_parts.append(f'            <thead><tr>')
                html_parts.append(f'''<th onclick="sortTable('{tbody_id}', 0, 'date')" data-sort-key="date" class="sort-desc">Date</th>''')
                html_parts.append(f'''<th onclick="sortTable('{tbody_id}', 1, 'string')" data-sort-key="account">Account</th>''')
                html_parts.append(f'''<th onclick="sortTable('{tbody_id}', 2, 'string')" data-sort-key="description">Description</th>''')
                html_parts.append(f'''<th onclick="sortTable('{tbody_id}', 3, 'number')" data-sort-key="amount" class="amount">Amount</th>''') 
                html_parts.append(f'</tr></thead>\n')
                html_parts.append(f'            <tbody id="{tbody_id}">\n')

                # Sort by Date descending for the table display
                sorted_group_for_table = sub_transactions.sort_values(by=DATE_COLUMN, ascending=False)
                for _, tx_row in sorted_group_for_table.iterrows():
                    amount_val = tx_row['AbsAmount']
                    tx_currency = tx_row['Currency']
                    tx_symbol = '$' if tx_currency == 'USD' else ('CA$' if tx_currency == 'CAD' else f'{tx_currency} ')
                    amount_str = f"-{tx_symbol}{amount_val:,.2f}" 
                    tx_date = tx_row[DATE_COLUMN].strftime('%Y-%m-%d') if pd.notna(tx_row[DATE_COLUMN]) else 'N/A'
                    account_info = tx_row.get(ACCOUNT_COLUMN, 'N/A')
                    desc = tx_row.get(DESCRIPTION_COLUMN, 'N/A')
                    escaped_desc = html.escape(desc, quote=True)
                    desc_cell_content = f'''{desc} <button class="mark-personal-btn" data-description="{escaped_desc}" title="Mark this description as Personal override">P</button>'''
                    html_parts.append(f'                <tr class="expense-row">')
                    html_parts.append(f'<td data-label="Date" data-sort-value="{tx_date}">{tx_date}</td>')
                    html_parts.append(f'<td data-label="Account">{account_info}</td>')
                    html_parts.append(f'<td data-label="Description">{desc_cell_content}</td>')
                    html_parts.append(f'<td data-label="Amount" class="amount" data-sort-value="{amount_val}">{amount_str}</td>')
                    html_parts.append(f'</tr>\n')
                html_parts.append('            </tbody>\n')
                html_parts.append('        </table>\n')
            else:
                html_parts.append('<p><i>No transactions found for this recurring item.</i></p>')
            html_parts.append('    </details>\n')
    else:
        html_parts.append("    <p><i>No potential recurring expenses identified meeting the criteria.</i></p>\n")
    html_parts.append("</div></details><hr>\n") # Close outer details and recurring section div

    # --- Monthly Breakdown Section ---
    html_parts.append("<h2>Monthly Breakdown</h2>\n")
    grouped_by_month = df_report.groupby('Month')
    sorted_months = sorted(df_report['Month'].unique(), reverse=True)

    for month in sorted_months:
        month_df = grouped_by_month.get_group(month).copy()
        
        # Calculate totals by currency for the month summary
        month_totals_by_currency = month_df.groupby(['TransactionType', 'Currency'])['AbsAmount'].sum()
        income_parts_compact = []
        expense_parts_compact = []
        net_by_currency = {}

        for (ttype, currency), amount in month_totals_by_currency.items():
            symbol = '$' if currency == 'USD' else ('CA$' if currency == 'CAD' else f'{currency} ')
            # Use format_compact here, removing explicit sign as format_compact adds it
            compact_val_unsigned = format_compact(amount)[1:] # Get value without sign
            
            if ttype == 'Income':
                income_parts_compact.append(f"+{symbol}{compact_val_unsigned}")
                net_by_currency[currency] = net_by_currency.get(currency, 0) + amount
            elif ttype == 'Expense':
                expense_parts_compact.append(f"-{symbol}{compact_val_unsigned}")
                net_by_currency[currency] = net_by_currency.get(currency, 0) - amount
        
        # --- Further Simplified Net Summary (Focus on CAD) --- 
        primary_currency = 'CAD' 
        net_summary_display = "Net: N/A"
        if primary_currency in net_by_currency:
            primary_net_str = format_compact(net_by_currency[primary_currency])
            net_summary_display = f"Net CAD: {primary_net_str}"
        elif net_by_currency: # Fallback if no CAD
            first_curr = list(net_by_currency.keys())[0]
            first_net_str = format_compact(net_by_currency[first_curr])
            net_summary_display = f"Net {first_curr}: {first_net_str}"
        else:
            net_summary_display = "Net: 0"
        
        # Join parts for the *internal* breakdown
        income_summary_compact = " | ".join(income_parts_compact) if income_parts_compact else "+0"
        expense_summary_compact = " | ".join(expense_parts_compact) if expense_parts_compact else "-0"
        full_breakdown_str = f"Income ({income_summary_compact}) | Expenses ({expense_summary_compact})"
        # Use the *simplified* display string for the summary tag itself
        month_summary_str = net_summary_display 
        # --- End Further Simplified Net Summary ---

        html_parts.append(f'<details class="month-details" {"open" if month == sorted_months[0] else ""}>\n') 
        html_parts.append(f'    <summary>{month} ({month_summary_str})</summary>\n') # Use simplified summary
        # Add the full breakdown INSIDE the details 
        html_parts.append(f'    <div class="details-content">\n') # Start details content wrapper
        html_parts.append(f'      <p><i>Monthly Summary: {full_breakdown_str}</i></p>\n')

        # --- Income Section for Month ---
        month_income_df = month_df[month_df['TransactionType'] == 'Income']
        if not month_income_df.empty:
            # Calculate CAD total for the section header
            income_cad_total = month_totals_by_currency.get(('Income', 'CAD'), 0)
            income_cad_total_str = format_compact(income_cad_total) # Use compact format
            
            html_parts.append('<section class="income-section">') # Append without trailing newline in string
            # Use simplified header showing only CAD total
            html_parts.append(f'  <h3>Income (Total CAD: {income_cad_total_str})</h3>') 
            grouped_income_by_cat = month_income_df.groupby('PrimaryCategory')
            for category_name in sorted(month_income_df['PrimaryCategory'].unique()):
                 category_df = grouped_income_by_cat.get_group(category_name)
                 cat_totals = category_df.groupby('Currency')['AbsAmount'].sum()
                 # Keep the full breakdown calculation for inside the details
                 cat_full_total_str_parts = []
                 for currency, amount in cat_totals.items():
                      symbol = '$' if currency == 'USD' else ('CA$' if currency == 'CAD' else f'{currency} ')
                      cat_full_total_str_parts.append(f"+{symbol}{amount:,.2f} ({currency})")
                 cat_full_total_str = " | ".join(cat_full_total_str_parts)
                 
                 # Calculate CAD total for the summary tag
                 cat_cad_total = cat_totals.get('CAD', 0)
                 cat_cad_total_str = f"+CA${cat_cad_total:,.2f}" # Use specific format for summary

                 html_parts.append('    <details class="category-details income">')
                 # Use simplified summary tag
                 html_parts.append(f'        <summary>{category_name} Income (Total CAD: {cat_cad_total_str})</summary>')
                 html_parts.append('        <div class="category-content-wrapper">')
                 # Add the full breakdown inside
                 html_parts.append(f'           <p><i>Full Breakdown: {cat_full_total_str}</i></p>')

                 # Group/Sort Items
                 grouped_items = category_df.groupby(['SubCategory', 'Merchant', 'Currency']) # Add Currency
                 groups_to_render = []
                 for (subcategory, merchant, currency), group in grouped_items:
                     groups_to_render.append({
                         'subcategory': subcategory, 'merchant': merchant, 'currency': currency,
                         'total': group['AbsAmount'].sum(), 'group_df': group
                     })
                 groups_to_render.sort(key=lambda x: x['total'], reverse=True)

                 # Render Items
                 for item in groups_to_render:
                     table_id_counter += 1
                     tbody_id = f"tbody-{table_id_counter}"
                     symbol = '$' if item['currency'] == 'USD' else ('CA$' if item['currency'] == 'CAD' else f"{item['currency']} ")
                     item_total_str = f"+{symbol}{item['total']:,.2f} ({item['currency']})"

                     html_parts.append(f'            <details class="item-details income">\n')
                     html_parts.append(f'                <summary>{item["subcategory"]} - {item["merchant"]} <strong>{item_total_str}</strong></summary>\n') 
                     html_parts.append(f'                <table class="transaction-table">\n')
                     html_parts.append(f'                    <thead><tr><th onclick="sortTable(\'{tbody_id}\', 0, \'date\')" data-sort-key="date">Date</th><th onclick="sortTable(\'{tbody_id}\', 1, \'string\')" data-sort-key="account">Account</th><th onclick="sortTable(\'{tbody_id}\', 2, \'string\')" data-sort-key="description">Description</th><th onclick="sortTable(\'{tbody_id}\', 3, \'number\')" data-sort-key="amount" class="sort-desc amount">Amount</th></tr></thead>\n')
                     html_parts.append(f'                    <tbody id="{tbody_id}">\n')
                     sorted_group = item['group_df'].sort_values(by='AbsAmount', ascending=False)
                     for _, row in sorted_group.iterrows():
                         amount_val = row['AbsAmount']
                         tx_currency = row['Currency'] # Already present
                         tx_symbol = '$' if tx_currency == 'USD' else ('CA$' if tx_currency == 'CAD' else f'{tx_currency} ')
                         amount_str = f"+{tx_symbol}{amount_val:,.2f}" 
                         tx_date = row[DATE_COLUMN].strftime('%Y-%m-%d') if pd.notna(row[DATE_COLUMN]) else 'N/A'
                         account_info = row.get(ACCOUNT_COLUMN, 'N/A')
                         desc = row.get(DESCRIPTION_COLUMN, 'N/A')
                         escaped_desc = html.escape(desc, quote=True)
                         desc_cell_content = f'''{desc} <button class="mark-personal-btn" data-description="{escaped_desc}" title="Mark this description as Personal override">P</button>'''
                         html_parts.append(f'                        <tr class="income-row">')
                         html_parts.append(f'<td data-label="Date" data-sort-value="{tx_date}">{tx_date}</td>')
                         html_parts.append(f'<td data-label="Account">{account_info}</td>')
                         html_parts.append(f'<td data-label="Description">{desc_cell_content}</td>')
                         html_parts.append(f'<td data-label="Amount" class="amount" data-sort-value="{amount_val}">{amount_str}</td>')
                         html_parts.append('</tr>\n')
                     html_parts.append('                    </tbody>\n')
                     html_parts.append('                </table>\n')
                     html_parts.append('            </details>\n')
                 html_parts.append('        </div>\n') 
                 html_parts.append('    </details>\n') 
            html_parts.append('</section>\n')
        else:
             html_parts.append(f'<section class="income-section"><p><i>No income recorded for {month}.</i></p></section>\n')

        # --- Expense Section for Month ---
        month_expense_df = month_df[month_df['TransactionType'] == 'Expense']
        if not month_expense_df.empty:
            # Calculate CAD total for the section header
            expense_cad_total = month_totals_by_currency.get(('Expense', 'CAD'), 0)
            expense_cad_total_str = format_compact(-expense_cad_total) # Use compact format, ensure negative
            
            html_parts.append('<section class="expense-section">')
            # Use simplified header showing only CAD total
            html_parts.append(f'  <h3>Expenses (Total CAD: {expense_cad_total_str})</h3>')
            grouped_expense_by_cat = month_expense_df.groupby('PrimaryCategory')
            for category_name in sorted(month_expense_df['PrimaryCategory'].unique()):
                 category_df = grouped_expense_by_cat.get_group(category_name)
                 cat_totals = category_df.groupby('Currency')['AbsAmount'].sum()
                 # Keep the full breakdown calculation for inside the details
                 cat_full_total_str_parts = []
                 for currency, amount in cat_totals.items():
                      symbol = '$' if currency == 'USD' else ('CA$' if currency == 'CAD' else f'{currency} ')
                      cat_full_total_str_parts.append(f"-{symbol}{amount:,.2f} ({currency})")
                 cat_full_total_str = " | ".join(cat_full_total_str_parts)
                 
                 # Calculate CAD total for the summary tag
                 cat_cad_total = cat_totals.get('CAD', 0)
                 cat_cad_total_str = f"-CA${cat_cad_total:,.2f}" # Use specific format for summary

                 html_parts.append('    <details class="category-details expense">')
                 # Use simplified summary tag
                 html_parts.append(f'        <summary>{category_name} Expenses (Total CAD: {cat_cad_total_str})</summary>')
                 html_parts.append('        <div class="category-content-wrapper">')
                 # Add the full breakdown inside
                 html_parts.append(f'           <p><i>Full Breakdown: {cat_full_total_str}</i></p>')

                 # Group/Sort Items
                 grouped_items = category_df.groupby(['SubCategory', 'Merchant', 'Currency']) # Add Currency
                 groups_to_render = []
                 for (subcategory, merchant, currency), group in grouped_items:
                     groups_to_render.append({
                         'subcategory': subcategory, 'merchant': merchant, 'currency': currency,
                         'total': group['AbsAmount'].sum(), 'group_df': group
                     })
                 groups_to_render.sort(key=lambda x: x['total'], reverse=True)

                 # Render Items
                 for item in groups_to_render:
                     table_id_counter += 1
                     tbody_id = f"tbody-{table_id_counter}"
                     symbol = '$' if item['currency'] == 'USD' else ('CA$' if item['currency'] == 'CAD' else f"{item['currency']} ")
                     item_total_str = f"-{symbol}{item['total']:,.2f} ({item['currency']})"

                     html_parts.append(f'            <details class="item-details expense">\n')
                     html_parts.append(f'                <summary>{item["subcategory"]} - {item["merchant"]} <strong>{item_total_str}</strong></summary>\n') 
                     html_parts.append(f'                <table class="transaction-table">\n')
                     html_parts.append(f'                    <thead><tr><th onclick="sortTable(\'{tbody_id}\', 0, \'date\')" data-sort-key="date">Date</th><th onclick="sortTable(\'{tbody_id}\', 1, \'string\')" data-sort-key="account">Account</th><th onclick="sortTable(\'{tbody_id}\', 2, \'string\')" data-sort-key="description">Description</th><th onclick="sortTable(\'{tbody_id}\', 3, \'number\')" data-sort-key="amount" class="sort-desc amount">Amount</th></tr></thead>\n')
                     html_parts.append(f'                    <tbody id="{tbody_id}">\n')
                     sorted_group = item['group_df'].sort_values(by='AbsAmount', ascending=False)
                     for _, row in sorted_group.iterrows():
                         amount_val = row['AbsAmount']
                         tx_currency = row['Currency'] # Already present
                         tx_symbol = '$' if tx_currency == 'USD' else ('CA$' if tx_currency == 'CAD' else f'{tx_currency} ')
                         amount_str = f"-{tx_symbol}{amount_val:,.2f}" 
                         tx_date = row[DATE_COLUMN].strftime('%Y-%m-%d') if pd.notna(row[DATE_COLUMN]) else 'N/A'
                         account_info = row.get(ACCOUNT_COLUMN, 'N/A')
                         desc = row.get(DESCRIPTION_COLUMN, 'N/A')
                         escaped_desc = html.escape(desc, quote=True)
                         desc_cell_content = f'''{desc} <button class="mark-personal-btn" data-description="{escaped_desc}" title="Mark this description as Personal override">P</button>'''
                         html_parts.append(f'                        <tr class="expense-row">')
                         html_parts.append(f'<td data-label="Date" data-sort-value="{tx_date}">{tx_date}</td>')
                         html_parts.append(f'<td data-label="Account">{account_info}</td>')
                         html_parts.append(f'<td data-label="Description">{desc_cell_content}</td>')
                         html_parts.append(f'<td data-label="Amount" class="amount" data-sort-value="{amount_val}">{amount_str}</td>')
                         html_parts.append('</tr>\n')
                     html_parts.append('                    </tbody>\n')
                     html_parts.append('                </table>\n')
                     html_parts.append('            </details>\n')
                 html_parts.append('        </div>\n') 
                 html_parts.append('    </details>\n') 
            html_parts.append('</section>\n') 
        else:
             html_parts.append(f'<section class="expense-section"><p><i>No expenses recorded for {month}.</i></p></section>\n')

        html_parts.append('</details>\n') # Close month-details

    # --- JavaScript Section ---
    # Embed manual_overrides directly into the JavaScript
    manual_overrides_json_string = json.dumps(manual_overrides, indent=2)

    html_parts.append(f"""
    <div class="override-manager">
        <h3>Manage Manual Overrides (Case-Insensitive)</h3>
        <p>Edit the JSON below directly. Click "Validate, Format & Save JSON" to check syntax, format, and save changes to the server. Then, click "Refresh Data from Sheets" to see the changes applied.</p>
        <h4><code>spending_overrides.json</code> Content:</h4>
        <textarea id="override-json-output"></textarea>
        <br>
        <button type="button" id="validate-format-btn">Validate, Format & Save JSON</button>
        <div id="validation-message" class="validation-message"></div>
    </div>

    <script>
        function sortTable(tbodyId, columnIndex, dataType) {{
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return; 
            const rows = Array.from(tbody.rows);
            const headerCell = tbody.closest('table').tHead.rows[0].cells[columnIndex];
            const currentSortOrder = headerCell.classList.contains('sort-asc') ? 'asc' : (headerCell.classList.contains('sort-desc') ? 'desc' : 'none');
            const isAscending = currentSortOrder !== 'asc'; 

            tbody.closest('table').tHead.querySelectorAll('th').forEach(th => {{
                th.classList.remove('sort-asc', 'sort-desc');
            }});
            headerCell.classList.add(isAscending ? 'sort-asc' : 'sort-desc');

            rows.sort((a, b) => {{
                const cellA = a.cells[columnIndex];
                const cellB = b.cells[columnIndex];
                let valA = cellA.dataset.sortValue ?? cellA.textContent.trim();
                let valB = cellB.dataset.sortValue ?? cellB.textContent.trim();

                if (dataType === 'number') {{
                    valA = parseFloat(String(valA).replace(/[+,$-]/g, '')) || 0;
                    valB = parseFloat(String(valB).replace(/[+,$-]/g, '')) || 0;
                }} else if (dataType === 'date') {{
                    valA = new Date(valA);
                    valB = new Date(valB);
                    if (isNaN(valA)) valA = new Date(0);
                    if (isNaN(valB)) valB = new Date(0);
                }} else {{ 
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }}

                let comparison = 0;
                if (valA < valB) comparison = -1;
                else if (valA > valB) comparison = 1;
                return isAscending ? comparison : (comparison * -1);
            }});

            const fragment = document.createDocumentFragment();
            rows.forEach(row => fragment.appendChild(row));
            tbody.appendChild(fragment); 
        }}

        // --- JavaScript for Simplified Manual Override Management & Refresh ---
        let currentOverrides = {manual_overrides_json_string}; // Load initial overrides from Python via JSON embedding
        const jsonOutput = document.getElementById('override-json-output');
        const validateButton = document.getElementById('validate-format-btn');
        const validationMessage = document.getElementById('validation-message');
        const refreshButton = document.getElementById('refresh-btn');
        const updateStatus = document.getElementById('update-status');

        // Populate textarea initially
        jsonOutput.value = JSON.stringify(currentOverrides, null, 2); 

        validateButton.addEventListener('click', function() {{
            validationMessage.textContent = ''; // Clear previous message
            validationMessage.className = 'validation-message'; // Reset class
            const currentJsonString = jsonOutput.value;
            try {{
                const parsedJson = JSON.parse(currentJsonString);
                if (!Array.isArray(parsedJson)) {{
                    throw new Error('Overrides must be a JSON array (list) like [ ... ].');
                }}
                
                // Basic validation for rules within the array
                const validCategories = ['Kalaam', 'Personal', 'Metropolis', 'AutoOptimize'];
                const seenFragments = new Set();
                for (const rule of parsedJson) {{
                    if (!rule || typeof rule !== 'object' || 
                        !rule.fragment || typeof rule.fragment !== 'string' || rule.fragment.trim() === '' ||
                        !rule.category || !validCategories.includes(rule.category)) {{
                        throw new Error('Invalid rule structure. Each rule needs "fragment" (string) and "category" (Kalaam/Personal/Metropolis/AutoOptimize).');
                    }}
                    const fragmentLower = rule.fragment.toLowerCase();
                    if (seenFragments.has(fragmentLower)) {{
                         // Use double quotes for the JS string to allow single quotes inside
                         throw new Error("Duplicate fragment found (case-insensitive): '" + rule.fragment + "'");
                    }}
                    seenFragments.add(fragmentLower);
                }}

                // Format the valid JSON nicely and put it back
                const formattedJson = JSON.stringify(parsedJson, null, 2);
                jsonOutput.value = formattedJson;
                
                validationMessage.textContent = 'JSON is valid! Saving...';
                validationMessage.className = 'validation-message success-message';
                validateButton.disabled = true; // Disable button while saving

                // Send updated overrides to server
                fetch('/update_overrides', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: formattedJson, // Send the validated & formatted JSON array
                }})
                .then(response => {{
                    if (!response.ok) {{ // Check for HTTP errors (like 400, 500)
                         // Use string concatenation for the error message part
                         return response.json().then(errData => {{ throw new Error(errData.message || 'HTTP error ' + response.status); }});
                    }}
                    return response.json();
                }})
                .then(data => {{
                    if (data.success) {{
                        validationMessage.textContent = 'Overrides saved! Click "Refresh Data from Sheets" to apply.';
                        validationMessage.className = 'validation-message success-message';
                        currentOverrides = parsedJson; // Update local JS state to reflect saved state
                    }} else {{
                        // This case might not be reached if using response.ok check above
                        throw new Error(data.message || 'Unknown save error.');
                    }}
                }})
                .catch(error => {{
                     // Use string concatenation here
                    validationMessage.textContent = 'Save Error: ' + error.message;
                    validationMessage.className = 'validation-message error-message';
                }})
                .finally(() => {{
                     validateButton.disabled = false; // Re-enable button
                }});
                
            }} catch (error) {{
                 // Use string concatenation here
                validationMessage.textContent = 'Invalid JSON: ' + error.message;
                validationMessage.className = 'validation-message error-message';
            }}
        }});

        // Refresh Button Logic
        refreshButton.addEventListener('click', function() {{
            updateStatus.textContent = 'Refreshing data...';
            refreshButton.disabled = true;
            validateButton.disabled = true; // Disable save button during refresh too
            fetch('/refresh_data', {{ method: 'POST' }}) 
                .then(response => {{
                     if (!response.ok) {{ // Check for HTTP errors (like 429, 500)
                         return response.json().then(errData => {{ throw new Error(errData.message || 'HTTP error ' + response.status); }});
                    }}
                    return response.json();
                }})
                .then(data => {{
                    if (data.success) {{
                        updateStatus.textContent = 'Refresh complete! Reloading page...';
                        window.location.reload(); 
                    }} else {{
                        // Might not be reached if using response.ok check
                         throw new Error(data.message || 'Unknown refresh error.');
                    }}
                }})
                .catch(error => {{
                     // Use string concatenation here
                    updateStatus.textContent = 'Refresh Error: ' + error.message;
                    refreshButton.disabled = false; // Re-enable on error
                    validateButton.disabled = false; 
                }});
        }});

        // --- "Mark Personal" Button Logic ---
        document.body.addEventListener('click', function(event) {{
            if (event.target.classList.contains('mark-personal-btn')) {{
                const button = event.target;
                const description = button.dataset.description;
                if (!description) return; // Should not happen if data-description is set

                // Find existing override for this exact description
                let foundIndex = -1;
                for (let i = 0; i < currentOverrides.length; i++) {{
                     if (currentOverrides[i].fragment === description) {{
                        foundIndex = i;
                        break;
                    }}
                }}

                let changed = false;
                if (foundIndex !== -1) {{
                    // Rule exists, check if category needs changing
                    if (currentOverrides[foundIndex].category !== 'Personal') {{
                        console.log("Changing category for existing override: " + description);
                        currentOverrides[foundIndex].category = 'Personal';
                        changed = true;
                    }} else {{
                        console.log("Override already exists and is Personal: " + description);
                    }}
                }} else {{
                    // Rule doesn't exist, add it
                    console.log("Adding new Personal override: " + description);
                    currentOverrides.push({{ fragment: description, category: 'Personal' }}); 
                    changed = true;
                }}

                if (changed) {{
                    // Update the textarea (important for validation)
                    jsonOutput.value = JSON.stringify(currentOverrides, null, 2);
                    // Automatically trigger validation and save
                    console.log('Triggering validation and save...');
                    validateButton.click();
                }}
            }}
        }});

    </script>
</body>
</html>""")

    # --- Join HTML parts and return ---
    return "\n".join(html_parts)

# --- Flask Routes ---
@app.route('/')
def index():
    """Main route to display the financial report."""
    with data_lock:
        # Use cached data if available
        if global_data['transactions'] is not None:
            if global_data['is_processing']:
                print("Processing in background, serving potentially stale data.")
            else:
                print("Using cached data.")
            df_report = global_data['transactions']
            overrides = global_data['overrides']
            last_updated = global_data['last_updated']
        else:
             # Initial load or if cache is empty and not processing
             if global_data['is_processing']:
                  return "Data is currently being processed for the first time. Please refresh in a moment.", 202 
             
             print("No cached data, fetching initial data...")
             initial_overrides = load_manual_overrides(MANUAL_OVERRIDES_FILE)
             global_data['overrides'] = initial_overrides # Store initially loaded overrides
            
             global_data['is_processing'] = True
             try:
                 processed_data = fetch_and_process_data(initial_overrides) # Use initially loaded overrides
                 if processed_data is not None:
                     global_data['transactions'] = processed_data
                     global_data['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
                     df_report = global_data['transactions']
                     overrides = global_data['overrides'] # Use the potentially updated overrides
                     last_updated = global_data['last_updated']
                     print(f"Initial data loaded. Last updated: {last_updated}")
                 else:
                      global_data['is_processing'] = False 
                      return "Error fetching initial data from Google Sheets. Check logs.", 500
             except Exception as e:
                  global_data['is_processing'] = False 
                  print(f"Error during initial fetch: {e}\n{traceback.format_exc()}") # Log traceback
                  return "Error during initial data fetch. Check logs.", 500
             finally:
                  global_data['is_processing'] = False

    # Handle cases where data might be None or empty even after processing
    if df_report is None or df_report.empty:
        last_updated_display = global_data['last_updated'] if global_data['last_updated'] else 'Never'
        # Pass current overrides to the minimal HTML in case user wants to manage them
        minimal_html = generate_html_report(pd.DataFrame(), global_data['overrides'], last_updated_display) 
        return render_template_string(minimal_html)

    # Generate the full HTML report using the data and overrides
    html_content = generate_html_report(df_report, overrides, last_updated)
    return render_template_string(html_content) 

@app.route('/update_overrides', methods=['POST'])
def update_overrides():
    """Receives updated overrides JSON and stores it in memory."""
    if request.method == 'POST':
        try:
            new_overrides = request.get_json()
            if not isinstance(new_overrides, list):
                 return jsonify({"success": False, "message": "Invalid format: Data must be a JSON list."}), 400
            
            # Validation (copied from JS validation for consistency)
            valid_categories = {'Kalaam', 'Personal', 'Metropolis', 'AutoOptimize'}
            seen_fragments = set()
            for i, rule in enumerate(new_overrides):
                 if not (isinstance(rule, dict) and \
                         'fragment' in rule and isinstance(rule['fragment'], str) and rule['fragment'].strip() and \
                         'category' in rule and rule['category'] in valid_categories):
                     return jsonify({"success": False, "message": f"Invalid rule structure at index {i}. Needs 'fragment' (string) and 'category' ({valid_categories})."}), 400
                 fragment_lower = rule['fragment'].lower()
                 if fragment_lower in seen_fragments:
                      return jsonify({"success": False, "message": f"Duplicate fragment found (case-insensitive): '{rule['fragment']}'"}), 400
                 seen_fragments.add(fragment_lower)
                 # Clean up rule - store only fragment and category
                 rule = {'fragment': rule['fragment'], 'category': rule['category']}


            with data_lock:
                global_data['overrides'] = new_overrides
                print(f"Stored {len(new_overrides)} overrides in memory. Data will be reprocessed on next refresh/load.")
                    
            # Persist overrides to file
            try:
               script_dir = os.path.dirname(os.path.abspath(__file__))
               override_path = os.path.join(script_dir, MANUAL_OVERRIDES_FILE)
               with open(override_path, 'w', encoding='utf-8') as f:
                   json.dump(new_overrides, f, indent=2)
               print(f"Overrides also saved to {override_path}")
            except Exception as e:
               # Log warning but don't fail the request if file save fails
               print(f"Warning: Could not save overrides to file '{override_path}': {e}")

            return jsonify({"success": True})
        except Exception as e:
            print(f"Error updating overrides: {e}\n{traceback.format_exc()}") # Log traceback
            return jsonify({"success": False, "message": str(e)}), 500
    else:
         return jsonify({"success": False, "message": "Method not allowed."}), 405

@app.route('/refresh_data', methods=['POST']) 
def refresh_data():
    """Triggers a refetch of data from Google Sheets using current overrides."""
    if request.method == 'POST':
        if global_data['is_processing']:
            print("Refresh request received while processing is ongoing.")
            return jsonify({"success": False, "message": "Processing already in progress."}), 429 
        
        global_data['is_processing'] = True
        processed_data = None # Initialize
        try:
            print("Refresh triggered. Fetching new data...")
            with data_lock:
                current_overrides = list(global_data['overrides']) 
            
            processed_data = fetch_and_process_data(current_overrides)
            
            with data_lock:
                if processed_data is not None:
                    global_data['transactions'] = processed_data
                    global_data['overrides'] = current_overrides 
                    global_data['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
                    print(f"Data refreshed successfully. Last updated: {global_data['last_updated']}")
                    # No need to set is_processing = False here, finally block handles it
                    return jsonify({"success": True})
                else:
                    print("Data refresh failed during fetch/process. Keeping potentially stale data.")
                    # No need to set is_processing = False here, finally block handles it
                    return jsonify({"success": False, "message": "Failed to fetch/process data from Google Sheets."}), 500
        except Exception as e:
             print(f"Error during data refresh: {e}\n{traceback.format_exc()}") # Log traceback
             # Ensure flag is reset even on unexpected error
             # No need to set is_processing = False here, finally block handles it
             return jsonify({"success": False, "message": str(e)}), 500
        finally:
             # Ensure the flag is always reset
             global_data['is_processing'] = False
             print("Processing flag reset.")

    else:
         return jsonify({"success": False, "message": "Method not allowed."}), 405

# --- Main Execution Block (For local development & Gunicorn) ---
# This block is useful for local testing. Gunicorn will use the 'app' instance directly.
if __name__ == "__main__":
    # Use 0.0.0.0 to be accessible externally (important for containers/deployment)
    # Use PORT environment variable if available (common in PaaS), default to 8080
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting Flask server locally on port {port}...")
    app.run(debug=False, host='0.0.0.0', port=port)