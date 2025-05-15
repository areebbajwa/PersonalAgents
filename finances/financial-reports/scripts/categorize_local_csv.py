import pandas as pd
import json
import os
import traceback

# --- Configuration ---
# Relative paths from the script's location in finances/financial-reports/scripts/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANUAL_OVERRIDES_FILE = os.path.join(SCRIPT_DIR, "..", "config", "spending_overrides.json")
TRANSACTIONS_CSV_FILE = os.path.join(SCRIPT_DIR, "..", "data", "categorized_transactions.csv")

# Column names expected in the CSV
ACCOUNT_COLUMN_CSV = 'Account' # Actual name in categorized_transactions.csv
DESCRIPTION_COLUMN_CSV = 'Description' # Actual name in categorized_transactions.csv
CATEGORY_COLUMN_CSV = 'Category' # Actual name in categorized_transactions.csv

# Column names as used by the categorization logic (from categorize_transactions.py)
# We will map CSV columns to these names if they differ.
ACCOUNT_COLUMN_LOGIC = '⚡ Account'
DESCRIPTION_COLUMN_LOGIC = '⚡ Description'


# --- Categorization Logic (Adapted from categorize_transactions.py) ---
KALAAM_FOUNDATION_ACCOUNTS = [
    'COMMUNITY PLAN', 'BUSINESS INVESTOR ACCOUNT', 'Kalaam Donations',
    'TD BASIC BUSINESS PLAN',
    '5244162', '5244952', '7303538', '2695', '1389', '2065'
]
MPYRE_SOFTWARE_ACCOUNTS = [
    'Mpyre', 'TD BUSINESS TRAVEL VISA', 'CANADIAN MARGIN', 'US MARGIN',
    '5217807', '7301012', '5082', '561HR0E', '561HR0F', '81J687A', '81J687B', '56J6Y7E', '56J6Y7F'
]
METROPOLIS_ACCOUNTS = [
    'Metropolis', 'US DOLLAR CARD', 'TD BUSINESS CASH BACK VISA', 'US Dollar Credit Card',
    '5250184', '5253361', '7306877', '7307237', '7409', '4839', '2631'
]
AUTOOPTIMIZE_ACCOUNTS = [
    'AutoOptimize',
    '5246040', '7306838', '1147'
]
KALAAM_FOUNDATION_KEYWORDS = [
    'UPWORK', 'PURRWEB', 'OPENAI', 'ANAS', 'FIREBASE',
    'VIMEO', 'JAHANZAIB', 'ISHAAQ', 'FRAMER'
]
HARDCODED_DESC_MAP = {
    'MPYRE Software Inc.': ['WPS BILLING', 'PAYPAL MSP'],
    'Personal': ['PENNYAPPEAL CANADA', 'ALLSTATE', 'HWY407 ETR BPY']
}

def load_manual_overrides(filename):
    if not os.path.exists(filename):
        print(f"Info: Manual overrides file '{filename}' not found. No overrides applied.")
        return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            overrides_data = json.load(f)
        if not isinstance(overrides_data, list):
            print(f"Warning: Content of '{filename}' is not a JSON list. Overrides ignored.")
            return []

        valid_overrides = []
        valid_categories = {'Kalaam', 'Personal', 'Metropolis', 'AutoOptimize', 'MPYRE Software Inc.', 'Kalaam Foundation'}
        seen_fragments = set()

        for i, rule in enumerate(overrides_data):
            category = rule.get('category')
            if category not in valid_categories:
                print(f"Warning: Rule {i+1} in '{filename}' has invalid or missing category '{category}'. Skipping rule.")
                continue
            fragment = rule.get('fragment')
            if not fragment or not isinstance(fragment, str):
                print(f"Warning: Rule {i+1} in '{filename}' has invalid or missing fragment. Skipping rule.")
                continue
            if fragment.lower() in seen_fragments:
                print(f"Warning: Skipping duplicate override fragment (case-insensitive): '{fragment}' in rule {i+1} in '{filename}'.")
                continue
            valid_overrides.append({'fragment': fragment.upper(), 'category': category})
            seen_fragments.add(fragment.lower())
        print(f"Loaded {len(valid_overrides)} valid manual override rules from '{filename}'.")
        return valid_overrides
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from '{filename}'. Check format. Error: {e}")
        return []
    except Exception as e:
        print(f"Error loading overrides from '{filename}': {e}")
        return []

def categorize_primary_v2(row_dict_for_logic, manual_overrides_list):
    account_name_field = row_dict_for_logic.get(ACCOUNT_COLUMN_LOGIC, '')
    description = str(row_dict_for_logic.get(DESCRIPTION_COLUMN_LOGIC, '')).upper()
    account_identifier = str(account_name_field).upper()

    for override in manual_overrides_list:
        fragment = override['fragment'] # Already uppercased
        target_category = override['category']
        if fragment in description:
            return target_category

    for category, keywords in HARDCODED_DESC_MAP.items():
        for keyword in keywords:
            if keyword.upper() in description:
                return category

    # Account Name / Identifier Matching (using the full account string from CSV)
    if any(identifier.upper() in account_identifier for identifier in KALAAM_FOUNDATION_ACCOUNTS):
        return 'Kalaam Foundation'
    if any(identifier.upper() in account_identifier for identifier in MPYRE_SOFTWARE_ACCOUNTS):
        return 'MPYRE Software Inc.'
    if any(identifier.upper() in account_identifier for identifier in METROPOLIS_ACCOUNTS):
        return 'Metropolis'
    if any(identifier.upper() in account_identifier for identifier in AUTOOPTIMIZE_ACCOUNTS):
        return 'AutoOptimize'

    # Description Keywords for Kalaam Foundation
    if any(keyword.upper() in description for keyword in KALAAM_FOUNDATION_KEYWORDS):
        return 'Kalaam Foundation'

    return 'Personal'

if __name__ == "__main__":
    print("--- Starting Local CSV Transaction Categorization Script ---")
    try:
        print(f"Loading manual overrides from: {MANUAL_OVERRIDES_FILE}")
        manual_overrides = load_manual_overrides(MANUAL_OVERRIDES_FILE)

        print(f"Reading transactions from: {TRANSACTIONS_CSV_FILE}")
        if not os.path.exists(TRANSACTIONS_CSV_FILE):
            print(f"Error: Transactions CSV file not found at {TRANSACTIONS_CSV_FILE}")
            exit()
        
        df = pd.read_csv(TRANSACTIONS_CSV_FILE)
        print(f"Loaded {len(df)} transactions.")

        if CATEGORY_COLUMN_CSV not in df.columns:
            print(f"Error: Category column '{CATEGORY_COLUMN_CSV}' not found in the CSV.")
            # If no category column, we might be starting fresh or it's an error.
            # For now, let's assume we add it if missing and categorize all.
            print(f"Adding '{CATEGORY_COLUMN_CSV}' column and attempting to categorize all rows.")
            df[CATEGORY_COLUMN_CSV] = pd.NA


        # Identify rows that need categorization (Category is NaN, NaT, None, or empty string)
        # pd.NA is pandas' missing value marker, which is good to check for.
        # Also check for empty strings if they might occur.
        uncategorized_mask = df[CATEGORY_COLUMN_CSV].isnull() | (df[CATEGORY_COLUMN_CSV] == '') | (df[CATEGORY_COLUMN_CSV].astype(str).str.upper() == 'NAN')
        uncategorized_indices = df[uncategorized_mask].index

        if uncategorized_indices.empty:
            print("No rows found requiring categorization (Category column is not blank).")
        else:
            print(f"Found {len(uncategorized_indices)} rows to categorize.")
            processed_count = 0
            for index in uncategorized_indices:
                row_data_csv = df.loc[index]
                
                # Prepare dict for the categorization logic using its expected column names
                row_for_logic = {
                    ACCOUNT_COLUMN_LOGIC: row_data_csv[ACCOUNT_COLUMN_CSV],
                    DESCRIPTION_COLUMN_LOGIC: row_data_csv[DESCRIPTION_COLUMN_CSV]
                }
                
                new_category = categorize_primary_v2(row_for_logic, manual_overrides)
                df.loc[index, CATEGORY_COLUMN_CSV] = new_category
                processed_count += 1
            print(f"Successfully categorized {processed_count} rows.")

        print(f"Saving updated transactions to: {TRANSACTIONS_CSV_FILE}")
        df.to_csv(TRANSACTIONS_CSV_FILE, index=False, encoding='utf-8')
        print("Categorized transactions saved successfully.")

    except FileNotFoundError as e:
        print(f"Error: A required file was not found. {e}")
        print(traceback.format_exc())
    except pd.errors.EmptyDataError:
        print(f"Error: The CSV file '{TRANSACTIONS_CSV_FILE}' is empty.")
        print(traceback.format_exc())
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        print(traceback.format_exc())

    print("--- Local CSV Transaction Categorization Script Finished ---") 