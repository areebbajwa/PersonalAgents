#!/usr/bin/env python3
"""
Generate Corrected Financial Statements for Mpyre Software Inc.
Excludes accounting entries (Balance Forward, RTN NSF) that were incorrectly counted as revenue.
"""

import sqlite3
from datetime import datetime
import json

def connect_to_db():
    """Connect to the personal database."""
    return sqlite3.connect("/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/data/personal.db")

def get_mpyre_transactions(year):
    """Get all Mpyre transactions for a given year, excluding accounting entries."""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    # Query tagged transactions, excluding accounting entries
    query = f"""
    SELECT Date, "Account Name", Amount, Description, SourceFile, PrimaryCategory, 
           ai_category, ai_merchant, ai_tags
    FROM tagged_transactions_{year}
    WHERE PrimaryCategory = 'MPYRE Software Inc.'
      AND ai_category != 'EXCLUDED_ACCOUNTING'
    ORDER BY Date
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    
    # Convert to list of dictionaries
    transactions = []
    for row in rows:
        transactions.append({
            'Date': row[0],
            'Account Name': row[1], 
            'Amount': row[2],
            'Description': row[3],
            'SourceFile': row[4],
            'PrimaryCategory': row[5],
            'ai_category': row[6],
            'ai_merchant': row[7],
            'ai_tags': row[8]
        })
    
    return transactions

def categorize_transactions(transactions):
    """Categorize transactions into revenue and expenses, excluding accounting entries."""
    revenue_transactions = []
    expense_transactions = []
    
    for txn in transactions:
        if txn['ai_category'] == 'EXCLUDED_ACCOUNTING':
            continue  # Skip accounting entries
            
        if txn['Amount'] > 0:
            revenue_transactions.append(txn)
        elif txn['Amount'] < 0:
            expense_transactions.append(txn)
    
    return revenue_transactions, expense_transactions

def generate_financial_statements(year):
    """Generate corrected financial statements for the given year."""
    
    print(f"\n=== MPYRE SOFTWARE INC. - CORRECTED FINANCIAL STATEMENTS {year} ===")
    print("(Accounting entries like Balance Forward and RTN NSF properly excluded)")
    
    # Get transactions
    transactions = get_mpyre_transactions(year)
    
    if not transactions:
        print(f"No Mpyre transactions found for {year}")
        return None
    
    print(f"\nTotal Mpyre transactions: {len(transactions)}")
    
    # Check for excluded accounting entries
    excluded_count = sum(1 for txn in transactions if txn['ai_category'] == 'EXCLUDED_ACCOUNTING')
    if excluded_count > 0:
        print(f"Accounting entries excluded: {excluded_count}")
    
    # Categorize into revenue and expenses
    revenue_transactions, expense_transactions = categorize_transactions(transactions)
    
    # Summary Statistics
    total_revenue = sum(txn['Amount'] for txn in revenue_transactions)
    total_expenses = abs(sum(txn['Amount'] for txn in expense_transactions))
    net_income = total_revenue - total_expenses
    
    print(f"\n--- FINANCIAL SUMMARY {year} ---")
    print(f"Total Revenue: ${total_revenue:,.2f}")
    print(f"Total Expenses: ${total_expenses:,.2f}")
    print(f"Net Income: ${net_income:,.2f}")
    
    # Detailed Revenue Breakdown
    if revenue_transactions:
        print(f"\n--- REVENUE BREAKDOWN ({len(revenue_transactions)} transactions) ---")
        revenue_by_category = {}
        for txn in revenue_transactions:
            category = txn['ai_category']
            if category not in revenue_by_category:
                revenue_by_category[category] = {'count': 0, 'total': 0}
            revenue_by_category[category]['count'] += 1
            revenue_by_category[category]['total'] += txn['Amount']
        
        for category, data in revenue_by_category.items():
            print(f"{category}: {data['count']} transactions, ${data['total']:,.2f}")
        
        # Show individual revenue transactions if not too many
        if len(revenue_transactions) <= 20:
            print(f"\n--- INDIVIDUAL REVENUE TRANSACTIONS ---")
            for txn in revenue_transactions:
                print(f"{txn['Date']}: {txn['Description'][:50]} - ${txn['Amount']:,.2f} ({txn['ai_category']})")
    
    # Detailed Expense Breakdown  
    if expense_transactions:
        print(f"\n--- EXPENSE BREAKDOWN ({len(expense_transactions)} transactions) ---")
        expenses_by_category = {}
        for txn in expense_transactions:
            category = txn['ai_category']
            if category not in expenses_by_category:
                expenses_by_category[category] = {'count': 0, 'total': 0}
            expenses_by_category[category]['count'] += 1
            expenses_by_category[category]['total'] += abs(txn['Amount'])
        
        for category, data in expenses_by_category.items():
            print(f"{category}: {data['count']} transactions, ${data['total']:,.2f}")
    
    # Check for potential missed accounting entries
    potential_balance_forward = [txn for txn in transactions 
                               if any(term in txn['Description'].lower() 
                                     for term in ['balance forward', 'bal fwd', 'rtn nsf'])]
    if potential_balance_forward:
        print(f"\n⚠️  WARNING: Found {len(potential_balance_forward)} potential accounting entries:")
        for txn in potential_balance_forward:
            print(f"  {txn['Date']}: {txn['Description']} - ${txn['Amount']:,.2f} ({txn['ai_category']})")
    
    return {
        'year': year,
        'total_revenue': total_revenue,
        'total_expenses': total_expenses, 
        'net_income': net_income,
        'revenue_transactions': len(revenue_transactions),
        'expense_transactions': len(expense_transactions),
        'excluded_accounting': excluded_count
    }

def main():
    """Generate corrected financial statements for all years."""
    years = ['2020', '2021', '2022', '2023']
    results = {}
    
    print("MPYRE SOFTWARE INC. - CORRECTED FINANCIAL STATEMENTS")
    print("=" * 60)
    print("Excluding accounting entries that were incorrectly counted as revenue")
    
    for year in years:
        try:
            result = generate_financial_statements(year)
            if result:
                results[year] = result
        except Exception as e:
            print(f"Error processing {year}: {e}")
    
    # Summary comparison
    if results:
        print(f"\n" + "=" * 60)
        print("CORRECTED SUMMARY - ALL YEARS")
        print("=" * 60)
        
        total_net = 0
        for year in years:
            if year in results:
                r = results[year]
                print(f"{year}: Revenue ${r['total_revenue']:>10,.2f} | Expenses ${r['total_expenses']:>10,.2f} | Net ${r['net_income']:>10,.2f}")
                total_net += r['net_income']
        
        print("-" * 60)
        print(f"Total Net Income (2020-2023): ${total_net:,.2f}")
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"../financial-reports/mpyre_corrected_statements_{timestamp}.json"
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main() 