import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
import os # Added os import

# --- Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) # Get script's directory
CSV_FILE_PATH = os.path.join(SCRIPT_DIR, 'categorized_transactions.csv') # Path relative to script
TARGET_YEAR_T1 = 2023
TARGET_YEAR_T4_T5 = 2024

# Personal account identifiers from terminal searches
PERSONAL_ACCOUNTS = ['6451459']  # Personal account
MPYRE_ACCOUNTS = ['MPYRE']  # MPYRE accounts
MPYRE_CREDIT_CARD = ['C/C MPYRE', 'MPYRE C/C', 'MPYRE CREDIT', 'MPYRE CC']  # MPYRE corporate credit card patterns to exclude

# Keywords for identifying transaction types
DIVIDEND_KEYWORDS = ["DIVIDEND", "DISTRIBUTION", "OWNER DRAW", "SHAREHOLDER PAYMENT", "OWNER INVESTMENT"] # Added owner investment as it might be a negative value representing draw
CONTRACTOR_KEYWORDS = [
    "UPWORK", "PURRWEB", "FREELANCE", "CONSULTING", "CONTRACTOR", "GIG",
    "OPENAI", "ANAS", "FIREBASE", "VIMEO", "JAHANZAIB", "ISHAAQ", "FRAMER" # From categorization_rules.md
]
MOM_KEYWORDS = ["TFR-TO KHA"] # Keywords for mom transfers

def load_and_prepare_data(file_path):
    """Loads the CSV and prepares the data for analysis."""
    try:
        df = pd.read_csv(file_path)
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
        print(f"Make sure the CSV file is located at: {file_path}")
        return None
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

    # Convert date column to datetime
    df['⚡ Date'] = pd.to_datetime(df['⚡ Date'], errors='coerce')
    
    # Add a Year column for easier filtering
    df['Year'] = df['⚡ Date'].dt.year
    
    # Convert amount to numeric
    df['⚡ Amount'] = pd.to_numeric(df['⚡ Amount'], errors='coerce')
    
    print(f"Loaded {len(df)} transactions from {file_path}")
    return df

def get_2023_personal_draws(df):
    """Identifies and sums 2023 personal draws from MPYRE accounts.
       This looks for transfers from MPYRE accounts to personal accounts
       and other personal expenses paid from MPYRE accounts.
    """
    print("\n--- 1. 2023 Cash Draws from Corporate Margin Accounts ---")
    
    if df is None or df.empty:
        print("No data available to analyze.")
        return 0
    
    # Filter for the target year
    df_year = df[df['Year'] == TARGET_YEAR_T1]
    
    # First approach: Look for transfers from MPYRE to personal accounts and other personal draws
    # This checks if MPYRE is in the Account column and transaction goes out (negative amount)
    draws = df_year[
        (df_year['⚡ Account'].str.contains('|'.join(MPYRE_ACCOUNTS), case=False, na=False)) & 
        (df_year['⚡ Amount'] < 0) &  # Negative amount means money going out
        (
            # Either transfer to personal account by account number
            (df_year['⚡ Description'].str.contains('|'.join(PERSONAL_ACCOUNTS), case=False, na=False)) |
            # OR explicitly labeled as a dividend or draw
            (df_year['⚡ Description'].str.contains('|'.join(DIVIDEND_KEYWORDS), case=False, na=False)) |
            # OR categorized as Personal in the PrimaryCategory field (if it exists)
            (('PrimaryCategory' in df_year.columns) & (df_year['PrimaryCategory'] == 'Personal'))
        ) &
        # Exclude transfers to MPYRE's credit card
        (~df_year['⚡ Description'].str.contains('|'.join(MPYRE_CREDIT_CARD), case=False, na=False))
    ]
    
    # Additional potential personal expenses from MPYRE accounts
    # Look for transactions that are likely personal based on keywords/merchants
    personal_expense_keywords = [
        'HWY407', 'ALLSTATE', 'PENNYAPPEAL', 'RESTAURANT', 'GROCERY', 'DINING', 
        'UBER', 'AMAZON', 'MOVIE', 'NETFLIX', 'SPOTIFY', 'ITUNES', 'APPLE',
        'CLOTHING', 'TRAVEL', 'HOTEL', 'AIRLINE', 'GAS', 'DENTAL', 'MEDICAL',
        'PHARMACY', 'SHOPPERS', 'WALMART', 'COSTCO', 'SUPERMARKET'
    ]
    
    personal_expenses = df_year[
        (df_year['⚡ Account'].str.contains('|'.join(MPYRE_ACCOUNTS), case=False, na=False)) & 
        (df_year['⚡ Amount'] < 0) &  # Negative amount means money going out
        (df_year['⚡ Description'].str.contains('|'.join(personal_expense_keywords), case=False, na=False)) &
        # Exclude transfers to MPYRE's credit card
        (~df_year['⚡ Description'].str.contains('|'.join(MPYRE_CREDIT_CARD), case=False, na=False))
    ]
    
    # Check if we found any additional personal expenses
    additional_amount = 0
    if not personal_expenses.empty:
        # Remove any duplicates (transactions that were already counted in draws)
        personal_expenses = personal_expenses[~personal_expenses.index.isin(draws.index)]
        if not personal_expenses.empty:
            additional_amount = personal_expenses['⚡ Amount'].abs().sum()
            # Combine with the main draws DataFrame
            draws = pd.concat([draws, personal_expenses])
    
    # Check if there are CC transactions marked as personal or with personal keywords
    # Get credit card transactions that might be personal draws
    if 'PrimaryCategory' in df_year.columns and 'SubCategory' in df_year.columns:
        cc_personal = df_year[
            (df_year['⚡ Account'].str.contains('|'.join(MPYRE_ACCOUNTS), case=False, na=False)) & 
            (df_year['⚡ Amount'] < 0) &  # Negative amount means money going out
            # Not a payment to MPYRE CC
            (~df_year['⚡ Description'].str.contains('|'.join(MPYRE_CREDIT_CARD), case=False, na=False)) &
            (
                # Either categorized as Personal
                (df_year['PrimaryCategory'] == 'Personal') |
                # OR has personal subcategories
                (df_year['SubCategory'].isin(['PERSONAL', 'DINING', 'GROCERIES', 'ENTERTAINMENT', 'TRAVEL']))
            )
        ]
        
        # Combine with the main draws DataFrame
        if not cc_personal.empty:
            # Remove any duplicates (transactions that were already counted)
            cc_personal = cc_personal[~cc_personal.index.isin(draws.index)]
            if not cc_personal.empty:
                draws = pd.concat([draws, cc_personal])
    
    total_draws = draws['⚡ Amount'].abs().sum()
    
    formatted_total = Decimal(total_draws).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    print(f"Total personal draws from MPYRE in 2023: ${formatted_total:,.2f}")
    
    if additional_amount > 0:
        additional_formatted = Decimal(additional_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        print(f"Note: This includes ${additional_formatted:,.2f} in potential additional personal expenses")
    
    # Display some sample transactions for verification
    if not draws.empty:
        print("\nSample transactions (showing up to 10):")
        for i, row in draws.head(10).iterrows():
            print(f"Date: {row['⚡ Date'].strftime('%Y-%m-%d')}, Amount: ${abs(row['⚡ Amount']):,.2f}, Description: {row['⚡ Description']}")
        
        if len(draws) > 10:
            print(f"... and {len(draws) - 10} more transactions")
    
    return float(formatted_total)

def get_mom_transfers(df):
    """Identifies and sums transfers to mom (KHA)."""
    print("\n--- 2. Transfers to Mom ---")
    
    if df is None or df.empty:
        print("No data available to analyze.")
        return 0
    
    # Find transfers with "TFR-TO KHA" in the description
    mom_transfers = df[df['⚡ Description'].str.contains('|'.join(MOM_KEYWORDS), case=False, na=False)]
    
    # Calculate total and group by year
    mom_transfers_by_year = mom_transfers.groupby('Year')['⚡ Amount'].agg(
        total_amount=lambda x: Decimal(x.abs().sum()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        count=len
    )
    
    print("Transfers to Mom by year:")
    if mom_transfers_by_year.empty:
        print("No transfers to Mom found.")
    else:
        for year, row in mom_transfers_by_year.iterrows():
            print(f"{year}: ${row['total_amount']:,.2f} ({row['count']} transactions)")
    
    # Get transfers for the target year
    target_year_total = 0
    if TARGET_YEAR_T1 in mom_transfers_by_year.index:
        target_year_total = float(mom_transfers_by_year.loc[TARGET_YEAR_T1, 'total_amount'])
        
        # Display some sample transactions for the target year
        target_year_transfers = mom_transfers[mom_transfers['Year'] == TARGET_YEAR_T1]
        print(f"\nSample transfers to Mom in {TARGET_YEAR_T1}:")
        for i, row in target_year_transfers.head(5).iterrows():
            print(f"Date: {row['⚡ Date'].strftime('%Y-%m-%d')}, Amount: ${abs(row['⚡ Amount']):,.2f}, Description: {row['⚡ Description']}")
        
        if len(target_year_transfers) > 5:
            print(f"... and {len(target_year_transfers) - 5} more transactions")
    
    return target_year_total

def get_contractor_payments(df):
    """Identifies and analyzes contractor payments."""
    print("\n--- 3. Contractor Payments (T4A Requirements) ---")
    
    if df is None or df.empty:
        print("No data available to analyze.")
        return
    
    # Filter for contractor payments
    contractor_payments = df[df['⚡ Description'].str.contains('|'.join(CONTRACTOR_KEYWORDS), case=False, na=False)]
    
    # Group by year and count transactions - Fixed aggregation syntax
    contractor_by_year = contractor_payments.groupby('Year').agg({
        '⚡ Amount': lambda x: Decimal(abs(x).sum()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        '⚡ Description': 'count'
    })
    
    # Rename columns for clarity
    contractor_by_year.columns = ['total_amount', 'count']
    
    print("Contractor payments by year:")
    if contractor_by_year.empty:
        print("No contractor payments found.")
    else:
        for year, row in contractor_by_year.iterrows():
            print(f"{year}: ${row['total_amount']:,.2f} ({row['count']} payments)")
    
    # Get specific contractor details for recent years
    recent_years = [TARGET_YEAR_T1, TARGET_YEAR_T4_T5]
    for year in recent_years:
        if year in contractor_payments['Year'].values:
            print(f"\nContractor details for {year}:")
            year_payments = contractor_payments[contractor_payments['Year'] == year]
            
            # Group by description to identify unique contractors - Fixed aggregation syntax
            contractors = year_payments.groupby('⚡ Description').agg({
                '⚡ Amount': lambda x: Decimal(abs(x).sum()).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                '⚡ Date': 'count'
            })
            
            # Rename columns for clarity
            contractors.columns = ['total_amount', 'count']
            contractors = contractors.sort_values('total_amount', ascending=False)
            
            for contractor, row in contractors.iterrows():
                print(f"- {contractor}: ${row['total_amount']:,.2f} ({row['count']} payments)")
    
    # Tax advice for contractors
    print("\nTax filing information for overseas contractors:")
    print("- Canadian companies do not need to issue T4A slips to foreign contractors residing outside Canada")
    print("- For services performed entirely outside Canada, no withholding tax is typically required")
    print("- For contractors who performed services in Canada, T4A-NR slips may be required")
    print("- Document these payments as regular business expenses")

def main():
    # Load and prepare data
    print(f"Loading data from {CSV_FILE_PATH}...")
    df = load_and_prepare_data(CSV_FILE_PATH)
    
    if df is not None:
        # Get personal draws (for T1 return)
        personal_draws = get_2023_personal_draws(df)
        
        # Get mom transfers
        mom_transfers = get_mom_transfers(df)
        
        # Get contractor payments (for T4A slips)
        get_contractor_payments(df)
        
        # Summary for tax preparation
        print("\n--- Tax Filing Summary ---")
        print(f"1. Total 2023 personal draws from MPYRE: ${personal_draws:,.2f}")
        print("   • These should be reported as dividends on your 2023 T1 tax return")
        print(f"2. Total 2023 transfers to Mom: ${mom_transfers:,.2f}")
        print("   • Discuss with your accountant if these are gifts or support payments")
        print("3. Overseas contractors: No T4A slips required for services performed outside Canada")
    else:
        print("Could not load data for analysis.")

if __name__ == "__main__":
    main() 