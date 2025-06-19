#!/usr/bin/env python3
"""
Weekly TD Bank Data Update Script V2
Uses the sheets-cli tool to import TD transactions from Google Sheets to personal.db
"""

import os
import sys
import sqlite3
import json
import logging
import subprocess
from datetime import datetime
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Constants
GOOGLE_SHEET_ID = '1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE'
DB_PATH = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/data/personal.db'
SHEETS_CLI_PATH = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/google-sheets-cli/sheets-cli.py'

def check_prerequisites():
    """Check if all required files exist"""
    if not os.path.exists(DB_PATH):
        logging.error(f"Database not found at {DB_PATH}")
        return False
    
    if not os.path.exists(SHEETS_CLI_PATH):
        logging.error(f"Sheets CLI not found at {SHEETS_CLI_PATH}")
        return False
    
    return True

def ensure_transactions_table(conn):
    """Ensure the transactions table exists with correct schema"""
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

def fetch_accounts_data():
    """Fetch account information from Google Sheets"""
    logging.info("Fetching account data from Google Sheets...")
    
    try:
        result = subprocess.run(
            ['python3', SHEETS_CLI_PATH, 'read', GOOGLE_SHEET_ID, 'Accounts!A:E', '--json'],
            capture_output=True,
            text=True,
            check=True
        )
        
        accounts = json.loads(result.stdout)
        
        # Create account to currency mapping
        account_currency_map = {}
        for account in accounts:
            name = account.get('⚡ Account Name')
            currency = account.get('⚡ Currency', 'CAD')
            if name:
                account_currency_map[name] = currency
        
        logging.info(f"Loaded {len(account_currency_map)} accounts")
        return account_currency_map
        
    except Exception as e:
        logging.error(f"Error fetching accounts: {e}")
        return {}

def fetch_transactions_data():
    """Fetch transaction data from Google Sheets"""
    logging.info("Fetching transaction data from Google Sheets...")
    
    try:
        result = subprocess.run(
            ['python3', SHEETS_CLI_PATH, 'read', GOOGLE_SHEET_ID, 'Transactions!A:H', '--json'],
            capture_output=True,
            text=True,
            check=True
        )
        
        transactions = json.loads(result.stdout)
        logging.info(f"Fetched {len(transactions)} transactions")
        return transactions
        
    except Exception as e:
        logging.error(f"Error fetching transactions: {e}")
        return []

def parse_date(date_str):
    """Parse date string to YYYY-MM-DD format"""
    if not date_str:
        return None
    
    # Try different date formats
    for fmt in ['%m/%d/%Y', '%m/%d/%y', '%-m/%-d/%Y', '%-m/%-d/%y', '%Y-%m-%d']:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    logging.warning(f"Could not parse date: {date_str}")
    return None

def import_transactions(conn, transactions, account_currency_map):
    """Import transactions into the database"""
    sql = '''
        INSERT OR IGNORE INTO transactions 
        ("Date", "Account Name", "Amount", "Description", "SourceFile", 
         "PrimaryCategory", "Currency", "RawData", "SheetTransactionID")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    initial_count = conn.execute('SELECT COUNT(*) FROM transactions').fetchone()[0]
    
    for trans in transactions:
        date = parse_date(trans.get('⚡ Date'))
        account = trans.get('⚡ Account')
        amount = trans.get('⚡ Amount')
        description = trans.get('⚡ Description', '')
        category = trans.get('⚡ Category')
        raw_data = trans.get('⚡ Raw Data', '')
        trans_id = trans.get('⚡ Transaction ID', '')
        
        # Skip if essential fields are missing
        if not date or not account or amount is None:
            continue
        
        # Convert amount to float
        try:
            amount = float(str(amount).replace(',', ''))
        except ValueError:
            logging.warning(f"Could not parse amount: {amount}")
            continue
        
        currency = account_currency_map.get(account, 'CAD')
        
        values = (
            date,
            account,
            amount,
            description,
            'Google Sheet - TD Transactions',
            category if category and category != 'Uncategorized' else None,
            currency,
            raw_data,
            trans_id
        )
        
        conn.execute(sql, values)
    
    conn.commit()
    
    final_count = conn.execute('SELECT COUNT(*) FROM transactions').fetchone()[0]
    new_count = final_count - initial_count
    
    logging.info(f"Processed {len(transactions)} transactions")
    logging.info(f"Newly inserted: {new_count} transactions")
    
    return new_count

def run_categorization():
    """Run the categorization script if it exists"""
    categorize_script = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/may_26_2025_categorize_db_transactions.py'
    
    if os.path.exists(categorize_script):
        logging.info("Running categorization script...")
        try:
            subprocess.run(['python3', categorize_script], check=True)
            logging.info("Categorization completed")
        except subprocess.CalledProcessError as e:
            logging.warning(f"Categorization script failed: {e}")
    else:
        logging.info("Categorization script not found, skipping")

def main():
    """Main execution function"""
    logging.info("=== Weekly TD Bank Data Update Started ===")
    logging.info(f"Update time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check prerequisites
    if not check_prerequisites():
        logging.error("Prerequisites check failed. Exiting.")
        sys.exit(1)
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    ensure_transactions_table(conn)
    
    # Get initial transaction count
    initial_td_count = conn.execute('''
        SELECT COUNT(*) FROM transactions 
        WHERE "Account Name" LIKE '%TD%' 
           OR "Account Name" LIKE '%Mpyre%'
           OR "Account Name" LIKE '%Areeb%'
           OR "Account Name" LIKE '%Mariam%'
           OR "Account Name" LIKE '%AutoOptimize%'
           OR "Account Name" LIKE '%Shared family%'
    ''').fetchone()[0]
    
    logging.info(f"Initial TD transaction count: {initial_td_count}")
    
    # Fetch data from Google Sheets
    account_currency_map = fetch_accounts_data()
    transactions = fetch_transactions_data()
    
    if not transactions:
        logging.error("No transactions fetched. Exiting.")
        conn.close()
        sys.exit(1)
    
    # Import transactions
    new_count = import_transactions(conn, transactions, account_currency_map)
    
    # Get final count
    final_td_count = conn.execute('''
        SELECT COUNT(*) FROM transactions 
        WHERE "Account Name" LIKE '%TD%' 
           OR "Account Name" LIKE '%Mpyre%'
           OR "Account Name" LIKE '%Areeb%'
           OR "Account Name" LIKE '%Mariam%'
           OR "Account Name" LIKE '%AutoOptimize%'
           OR "Account Name" LIKE '%Shared family%'
    ''').fetchone()[0]
    
    logging.info(f"Final TD transaction count: {final_td_count}")
    
    conn.close()
    
    # Run categorization
    run_categorization()
    
    logging.info("=== Weekly TD Bank Data Update Completed Successfully ===")

if __name__ == "__main__":
    main()