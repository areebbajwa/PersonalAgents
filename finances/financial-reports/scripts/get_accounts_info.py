import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
import os

# --- Configuration (copied from your main.py) ---
# Updated file paths for the new directory structure
CREDENTIALS_FILE = os.path.join('config', 'serviceAccountKey.json')
SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit?gid=460839481#gid=460839481'
ACCOUNTS_WORKSHEET_NAME = 'Accounts'
ACCOUNT_NAME_COLUMN = '⚡ Account Name' # As defined in your main.py
ACCOUNT_ID_COLUMN = '⚡ Account'       # As defined in your main.py

def authenticate_gsheets():
    """Authenticates with Google Sheets API using service account."""
    # Check if the credentials file is in the same directory as the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    creds_path = os.path.join(script_dir, CREDENTIALS_FILE)

    if not os.path.exists(creds_path):
        print(f"Error: Credentials file '{CREDENTIALS_FILE}' not found in the script directory: {script_dir}")
        print(f"Please ensure '{CREDENTIALS_FILE}' is in the config directory.")
        # Fallback for Render/Cloud Run style secret path if the local one isn't found,
        # though for local execution, the above check is more relevant.
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

def get_accounts_data(gspread_client, spreadsheet_url, worksheet_name):
    """Fetches data from the Accounts worksheet."""
    try:
        print(f"Attempting to open spreadsheet URL...")
        sheet_object = gspread_client.open_by_url(spreadsheet_url)
        print(f"Successfully opened spreadsheet: '{sheet_object.title}'")
        worksheet = sheet_object.worksheet(worksheet_name)
        print(f"Accessing worksheet: '{worksheet.title}'")

        data = worksheet.get_all_records() # Fetches data as a list of dictionaries
        if not data:
            print(f"Warning: No data found in worksheet '{worksheet_name}'.")
            return None
        
        df = pd.DataFrame(data)
        print(f"Successfully fetched {len(df)} records from '{worksheet_name}'.")
        return df
    except gspread.exceptions.SpreadsheetNotFound:
        print(f"Error: Spreadsheet not found at URL: {spreadsheet_url}")
        print("Please ensure the URL is correct and the service account has access.")
        return None
    except gspread.exceptions.WorksheetNotFound:
        print(f"Error: Worksheet named '{worksheet_name}' not found.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

if __name__ == "__main__":
    print("Attempting to authenticate with Google Sheets...")
    gspread_client = authenticate_gsheets()

    if gspread_client:
        print("\nFetching 'Accounts' worksheet data...")
        accounts_df = get_accounts_data(gspread_client, SPREADSHEET_URL, ACCOUNTS_WORKSHEET_NAME)

        if accounts_df is not None:
            print("\n--- Accounts Data ---")
            if ACCOUNT_NAME_COLUMN in accounts_df.columns and ACCOUNT_ID_COLUMN in accounts_df.columns:
                # Print only the relevant columns, handling potential missing values
                for index, row in accounts_df.iterrows():
                    account_name = row.get(ACCOUNT_NAME_COLUMN, 'N/A')
                    account_id = row.get(ACCOUNT_ID_COLUMN, 'N/A')
                    print(f"Account Name: {account_name}, Account ID: {account_id}")
            elif ACCOUNT_NAME_COLUMN in accounts_df.columns:
                print(f"'{ACCOUNT_ID_COLUMN}' not found, printing only '{ACCOUNT_NAME_COLUMN}':")
                for name in accounts_df[ACCOUNT_NAME_COLUMN].tolist():
                    print(f"Account Name: {name}")
            else:
                print(f"Could not find the specified account name column ('{ACCOUNT_NAME_COLUMN}') in the 'Accounts' sheet.")
                print(f"Available columns: {accounts_df.columns.tolist()}")
                print("\nPlease check the column names in your sheet and in the script.")
            
            print("\n--- End of Accounts Data ---")
            print("\nInstructions: Please copy the 'Account Name' and 'Account ID' list above and paste it back into our chat.")
            print("This will help me understand how to categorize transactions for MPYRE Software Inc. and Kalaam Foundation.")
        else:
            print("Failed to retrieve data from the 'Accounts' worksheet.")
    else:
        print("Google Sheets authentication failed. Please check your credentials file and setup.") 