import csv
import io
from collections import defaultdict
import json # For parsing ai_tags if it's a JSON string
import argparse # For command-line arguments

# List of known personal account name prefixes/exact names for an additional check if needed,
# but PrimaryCategory should be the main filter.
KNOWN_PERSONAL_ACCOUNT_IDENTIFIERS = [
    "Areeb personal CAD credit card",
    "Areeb personal CAD chequing 311-6451459"
]

def map_transaction_to_tax_category(transaction, primary_category): # Added primary_category
    ai_cat = transaction.get('ai_category', '').lower()
    ai_tags_str = transaction.get('ai_tags', '[]')
    description = transaction.get('Description', '').lower()
    amount = float(transaction.get('Amount', 0))
    # account_name = transaction.get('Account Name', '').lower() # Keep for potential future use

    try:
        ai_tags = json.loads(ai_tags_str) # Expecting a list of strings
        ai_tags = [tag.lower() for tag in ai_tags]
    except json.JSONDecodeError:
        ai_tags = []

    # --- Income Categories ---
    # These are generally not dependent on the primary_category being 'Personal'
    # as income can be received into various accounts before being attributed.
    # However, for a personal tax return, we'd typically only consider income
    # that is personally attributable. This logic might need review based on broader context.
    if 'employment income' in ai_cat or 'salary' in ai_cat or 'payroll' in ai_tags:
        return 'Income: Employment Income', amount
    if 'self-employment income' in ai_cat or 'business income' in ai_cat or 'consulting income' in ai_tags or 'freelance income' in ai_tags:
        return 'Income: Self-Employment Income', amount
    if 'interest income' in ai_cat or 'interest' in ai_tags:
        return 'Income: Interest Income', amount
    if 'dividend income' in ai_cat or 'dividends' in ai_tags:
        # This will be handled by the dividend identification logic from Mpyre specifically.
        # For general categorization, it's fine, but the tax return will use the $84k figure.
        return 'Income: Dividend Income', amount
    if 'capital gain' in ai_cat or 'capital gains' in ai_tags:
        return 'Income: Capital Gains/Losses (Realized)', amount
    if 'investment income' in ai_cat and not any(x in ai_cat for x in ['interest', 'dividend', 'capital gain']):
        return 'Income: Other Investment Income', amount
    if 'rental income' in ai_cat:
        return 'Income: Rental Income', amount
    if ('other income' in ai_cat or 'miscellaneous income' in ai_cat) and amount > 0:
        return 'Income: Other Income', amount

    # --- Deductions & Credits Categories ---
    # Crucially, these should only be counted if they are from a "Personal" PrimaryCategory context.

    # RRSP Contribution: Typically from a personal context.
    if primary_category == 'Personal' and ('rrsp contribution' in ai_cat or 'rrsp' in ai_tags):
        return 'Deduction: RRSP Contribution', abs(amount)

    if primary_category == 'Personal' and ('medical expense' in ai_cat or 'medical' in ai_tags or 'pharmacy' in ai_tags or 'dentist' in ai_tags or 'doctor' in ai_tags):
        return 'Credit: Medical Expenses', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('donation' in ai_cat or 'charitable donation' in ai_tags):
        return 'Credit: Donations', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('child care expense' in ai_cat or 'childcare' in ai_tags or 'daycare' in ai_tags):
        return 'Deduction: Child Care Expenses', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('professional dues' in ai_cat or 'union dues' in ai_cat or 'membership fees' in ai_tags):
        return 'Deduction: Professional/Union Dues', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('tuition fees' in ai_cat or 'tuition' in ai_tags or 'education' in ai_tags):
        return 'Credit: Tuition Fees', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('investment expense' in ai_cat or 'carrying charges' in ai_tags or 'investment counsel fees' in ai_tags):
        return 'Deduction: Carrying Charges/Investment Expenses', abs(amount) if amount < 0 else amount

    if primary_category == 'Personal' and ('employment expense' in ai_cat or 'home office expense' in ai_tags): # Requires T2200
        return 'Deduction: Employment Expenses', abs(amount) if amount < 0 else amount
        
    if primary_category == 'Personal' and ('student loan interest' in ai_cat or 'student loan interest' in ai_tags):
        return 'Credit: Student Loan Interest', abs(amount) if amount < 0 else amount

    # --- Potentially relevant but not directly tax lines / Need Review ---
    # These can come from any primary_category, their interpretation depends on context.
    if 'tax payment' in ai_cat:
        if 'income tax' in ai_tags or 'cra payment' in description:
            # If PrimaryCategory is Personal, it's an instalment. If MPYRE, it's corporate tax.
            prefix = "Personal" if primary_category == "Personal" else primary_category
            return f'Info ({prefix}): Income Tax Instalment/Payment', abs(amount) if amount < 0 else amount
        if 'property tax' in ai_tags:
            prefix = "Personal" if primary_category == "Personal" else primary_category
            return f'Info ({prefix}): Property Tax', abs(amount) if amount < 0 else amount
    
    if 'inter-account transfer' in ai_cat or 'transfer (between own accounts)' in ai_cat:
        prefix = "Personal" if primary_category == "Personal" else primary_category
        return f'Info ({prefix}): Inter-Account Transfer', amount

    if 'cash withdrawal' in ai_cat:
        prefix = "Personal" if primary_category == "Personal" else primary_category
        return f'Info ({prefix}): Cash Withdrawal', abs(amount) if amount < 0 else amount

    if ai_cat == 'uncategorized' or ai_cat == 'uncategorized/review needed':
        prefix = "Personal" if primary_category == "Personal" else primary_category
        return f'Review ({prefix}): Uncategorized ({description[:30]}...)', amount

    return None, 0 # No specific tax category found

def analyze_tagged_transactions_from_file(csv_file_path):
    tax_summary = defaultdict(float)
    detailed_transactions = defaultdict(list)
    processed_rows = 0
    skipped_rows = 0

    try:
        with open(csv_file_path, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            if 'PrimaryCategory' not in reader.fieldnames:
                print("Error: 'PrimaryCategory' column not found in CSV. This column is essential for filtering.")
                return None, None
                
            for row in reader:
                processed_rows += 1
                try:
                    if row.get('Currency') and row['Currency'] != 'CAD':
                        skipped_rows +=1
                        continue
                    
                    primary_cat = row.get('PrimaryCategory', '').strip()
                    if not primary_cat: # If PrimaryCategory is blank, treat as needing review or skip
                        detailed_transactions['Review: Missing PrimaryCategory'].append(row)
                        continue

                    tax_category, value = map_transaction_to_tax_category(row, primary_cat)

                    if tax_category:
                        tax_summary[tax_category] += value
                        detailed_transactions[tax_category].append(row)
                    else:
                        # Store transactions not mapped under a generic key, perhaps with their primary_cat
                        detailed_transactions[f'Not Directly Mapped ({primary_cat})'].append(row)

                except Exception as e:
                    print(f"Error processing row: {row.get('Description', 'N/A')} (PrimaryCat: {primary_cat}). Error: {e}")
                    detailed_transactions['Processing Errors'].append(row)
                    continue
    except FileNotFoundError:
        print(f"Error: File not found at {csv_file_path}")
        return None, None
    except Exception as e:
        print(f"An error occurred while opening or reading the file: {e}")
        return None, None
    
    print(f"Total rows processed: {processed_rows}, Skipped (non-CAD): {skipped_rows}")
    return tax_summary, detailed_transactions

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Analyze tagged financial transactions from a CSV file for tax purposes.')
    parser.add_argument('csv_file', type=str, help='Path to the input CSV file containing tagged transactions.')
    parser.add_argument('--investigate_draws', action='store_true', help='Print details for potential cash draw transactions.')
    parser.add_argument('--rrsp_details', action='store_true', help='If set, prints detailed transaction info for RRSP contributions.')
    parser.add_argument('--pro_fees_details', action='store_true', help='If set, prints detailed transaction info for Professional Fees/Union Dues.')
    parser.add_argument('--child_care_details', action='store_true', help='If set, prints detailed transaction info for Child Care Expenses.')
    parser.add_argument('--tuition_details', action='store_true', help='If set, prints detailed transaction info for Tuition Fees.')
    parser.add_argument('--investment_expense_details', action='store_true', help='If set, prints detailed transaction info for Investment Expenses.')
    parser.add_argument('--medical_transactions_output', type=str, help='Path to save detailed medical transactions CSV (Personal only).')
    parser.add_argument('--donation_transactions_output', type=str, help='Path to save detailed donation transactions CSV (Personal only).')
    
    args = parser.parse_args()

    print(f"Analyzing transactions from: {args.csv_file}")
    # Initial analysis for summary and general details
    summary, details_dict = analyze_tagged_transactions_from_file(args.csv_file)

    if summary:
        print("\n--- Tax Summary (based on PrimaryCategory filtering for personal credits/deductions) ---")
        for cat, total in sorted(summary.items()):
            print(f"{cat}: {total:.2f}")

        # --- Detailed printouts based on flags ---
        # These will mostly use the 'details_dict' which is already filtered by map_transaction_to_tax_category
        # (which now considers PrimaryCategory for personal items)

        if args.investigate_draws:
            print("\n--- Cash Draw Investigation Details (Includes Mpyre sourced transfers/payments for personal use) ---")
            # This section aims to identify funds moving from Mpyre to Personal contexts or Mpyre paying personal bills.
            # The $84,593 dividend figure was based on a prior manual review of such transactions.
            # This script section helps find candidates but isn't the definitive source of that dividend amount.
            
            # Option 1: Show relevant categories from 'details_dict'
            # These are already processed by map_transaction_to_tax_category.
            # We're interested in 'Info (MPYRE Software Inc.): Inter-Account Transfer', 'Info (MPYRE Software Inc.): Cash Withdrawal'
            # and any personal expenses paid by MPYRE.
            print("\nShowing relevant mapped categories (Mpyre source, potential for personal use):")
            for cat_key in details_dict:
                if "MPYRE Software Inc." in cat_key and ("Transfer" in cat_key or "Withdrawal" in cat_key or "Payment" in cat_key):
                    print(f"\nTransactions from mapped category: {cat_key}")
                    for txn in details_dict[cat_key][:10]: # Print first 10 as sample
                         print(f"  Date: {txn.get('Date')}, Acc: {txn.get('Account Name')}, Amt: {txn.get('Amount')}, Desc: {txn.get('Description')}, AI Cat: {txn.get('ai_category')}, PrimaryCat: {txn.get('PrimaryCategory')}")
            
            print("\nReviewing all transactions for direct payments from Mpyre accounts for categories typically personal:")
            # Iterate through CSV again to find MPYRE PrimaryCategory transactions that AI-tagged as personal items
            # This complements the above by looking for expenses rather than just transfers.
            mpyre_paid_personal_expenses_total = 0
            mpyre_paid_txns = []
            try:
                with open(args.csv_file, 'r', newline='', encoding='utf-8') as csvfile_raw:
                    reader_raw = csv.DictReader(csvfile_raw)
                    for row_raw in reader_raw:
                        if row_raw.get('Currency') != 'CAD': continue
                        primary_cat_raw = row_raw.get('PrimaryCategory', '').strip()
                        ai_cat_raw = row_raw.get('ai_category', '').lower()
                        
                        if primary_cat_raw == 'MPYRE Software Inc.':
                            # List of ai_categories that, if paid by Mpyre, could be shareholder benefits/draws
                            personal_type_ai_cats = [
                                'personal expense', 'personal spending', 'entertainment', 'meals & dining', 
                                'personal services', 'clothing', 'gifts', 'personal travel', 'non-business travel',
                                'health & wellness (non-medical like gym if personal)', 'hobby',
                                # Medical and Donations if paid by Mpyre are Mpyre's expense/donation, not personal.
                                # Child care, tuition if paid by Mpyre could be a benefit.
                                'child care expense', 'tuition fees' 
                            ]
                            if ai_cat_raw in personal_type_ai_cats:
                                amt = float(row_raw.get('Amount',0))
                                if amt < 0: # outflows from Mpyre
                                    mpyre_paid_personal_expenses_total += abs(amt)
                                    mpyre_paid_txns.append(row_raw)
                                    print(f"  Mpyre Paid Personal-Type: Date: {row_raw.get('Date')}, Acc: {row_raw.get('Account Name')}, Amt: {amt}, Desc: {row_raw.get('Description')}, AI Cat: {ai_cat_raw}")
                if mpyre_paid_txns:
                    print(f"Total amount of Mpyre-paid personal-type expenses identified above: {mpyre_paid_personal_expenses_total:.2f}")
                else:
                    print("  No specific Mpyre-paid personal-type expenses (like dining, entertainment etc.) flagged by this check.")

            except Exception as e:
                print(f"Error during --investigate_draws raw Mpyre check: {e}")


        if args.rrsp_details:
            print("\n--- RRSP Contribution Details (Personal PrimaryCategory only) ---")
            total_rrsp = summary.get('Deduction: RRSP Contribution', 0.0)
            if "Deduction: RRSP Contribution" in details_dict and details_dict["Deduction: RRSP Contribution"]:
                for tx in details_dict["Deduction: RRSP Contribution"]:
                    print(f"  Date: {tx['Date']}, Acc: {tx['Account Name']}, Amt: {tx['Amount']}, Desc: {tx['Description']}, AI Cat: {tx['ai_category']}, PrimaryCat: {tx['PrimaryCategory']}")
            else: # Fallback to raw check if mapping didn't catch it but ensuring PrimaryCategory is Personal
                print("  No RRSP contributions found via initial mapping. Performing raw check for 'Personal' PrimaryCategory...")
                raw_rrsp_total = 0
                found_raw_rrsp = False
                with open(args.csv_file, 'r', encoding='utf-8') as file:
                    reader = csv.DictReader(file)
                    for row in reader:
                        if row.get('Currency') != 'CAD': continue
                        if row.get('PrimaryCategory', '').strip() == 'Personal':
                            ai_cat_lower = row.get('ai_category', '').lower()
                            ai_tags_str = row.get('ai_tags', '[]')
                            try: tags = [tag.lower() for tag in json.loads(ai_tags_str)]
                            except: tags = []
                            if 'rrsp contribution' in ai_cat_lower or 'rrsp' in ai_cat_lower or 'rsp contribution' in ai_cat_lower or 'rrsp' in tags:
                                amount = float(row.get('Amount', 0))
                                # RRSP contributions are positive in the 'Amount' if it's a payment from a personal chequing to RRSP account
                                # or negative if viewed as an expense. The map_transaction_to_tax_category uses abs().
                                # For sum, we need a consistent view. Let's assume payments from non-RRSP are negative.
                                current_val = abs(amount) if amount < 0 else amount # Use abs for consistency with mapping logic
                                raw_rrsp_total += current_val
                                print(f"  Raw Check: Date: {row['Date']}, Acc: {row['Account Name']}, Amt: {amount}, Desc: {row['Description']}, AI Cat: {ai_cat_lower}")
                                found_raw_rrsp = True
                if not found_raw_rrsp:
                    print("  No RRSP contributions found for 'Personal' PrimaryCategory via raw check either.")
                total_rrsp = raw_rrsp_total # Prefer raw check total if it ran
            print(f"Total Identified Personal RRSP Contributions: {total_rrsp:.2f}")


        if args.pro_fees_details:
            print("\n--- Professional Fees/Union Dues Details (Personal PrimaryCategory only) ---")
            total_pro_fees = summary.get('Deduction: Professional/Union Dues', 0.0)
            if "Deduction: Professional/Union Dues" in details_dict and details_dict["Deduction: Professional/Union Dues"]:
                for tx in details_dict["Deduction: Professional/Union Dues"]:
                     print(f"  Date: {tx['Date']}, Acc: {tx['Account Name']}, Amt: {tx['Amount']}, Desc: {tx['Description']}, AI Cat: {tx['ai_category']}, PrimaryCat: {tx['PrimaryCategory']}")
            else:
                print("  No Professional Fees/Union Dues found for 'Personal' PrimaryCategory based on initial mapping.")
            print(f"Total Identified Personal Professional Fees/Union Dues: {total_pro_fees:.2f}")

        if args.child_care_details:
            print("\n--- Child Care Expense Details (Personal PrimaryCategory only) ---")
            total_child_care = summary.get('Deduction: Child Care Expenses', 0.0)
            if "Deduction: Child Care Expenses" in details_dict and details_dict["Deduction: Child Care Expenses"]:
                 for tx in details_dict["Deduction: Child Care Expenses"]:
                    print(f"  Date: {tx['Date']}, Acc: {tx['Account Name']}, Amt: {tx['Amount']}, Desc: {tx['Description']}, AI Cat: {tx['ai_category']}, PrimaryCat: {tx['PrimaryCategory']}")
            else:
                 print("  No Child Care Expenses found for 'Personal' PrimaryCategory based on initial mapping.")
            print(f"Total Identified Personal Child Care Expenses: {total_child_care:.2f}")

        if args.tuition_details:
            print("\n--- Tuition Fee Details (Personal PrimaryCategory only) ---")
            total_tuition = summary.get('Credit: Tuition Fees', 0.0)
            if "Credit: Tuition Fees" in details_dict and details_dict["Credit: Tuition Fees"]:
                for tx in details_dict["Credit: Tuition Fees"]:
                    print(f"  Date: {tx['Date']}, Acc: {tx['Account Name']}, Amt: {tx['Amount']}, Desc: {tx['Description']}, AI Cat: {tx['ai_category']}, PrimaryCat: {tx['PrimaryCategory']}")
            else:
                print("  No Tuition Fees found for 'Personal' PrimaryCategory based on initial mapping.")
            print(f"Total Identified Personal Tuition Fees (requires T2202 verification): {total_tuition:.2f}")

        if args.investment_expense_details:
            print("\n--- Investment Expense Details (Personal PrimaryCategory only) ---")
            total_inv_expense = summary.get('Deduction: Carrying Charges/Investment Expenses', 0.0)
            if "Deduction: Carrying Charges/Investment Expenses" in details_dict and details_dict["Deduction: Carrying Charges/Investment Expenses"]:
                for tx in details_dict["Deduction: Carrying Charges/Investment Expenses"]:
                    print(f"  Date: {tx['Date']}, Acc: {tx['Account Name']}, Amt: {tx['Amount']}, Desc: {tx['Description']}, AI Cat: {tx['ai_category']}, PrimaryCat: {tx['PrimaryCategory']}")
            else:
                print("  No specific Investment Expenses found for 'Personal' PrimaryCategory based on initial mapping.")
            print(f"Total Identified Personal Investment Expenses (requires verification): {total_inv_expense:.2f}")

        # Handling new output file arguments using a helper function that re-reads CSV
        def write_filtered_transactions_to_csv(csv_file_path, output_file_path, target_tax_category):
            filtered_tx_list = []
            try:
                with open(csv_file_path, 'r', newline='', encoding='utf-8') as infile:
                    reader = csv.DictReader(infile)
                    if 'PrimaryCategory' not in reader.fieldnames:
                        print(f"Skipping {output_file_path} generation: 'PrimaryCategory' not in input CSV.")
                        return False
                    
                    fieldnames = reader.fieldnames
                    for row in reader:
                        if row.get('Currency') and row['Currency'] != 'CAD':
                            continue
                        
                        primary_cat = row.get('PrimaryCategory', '').strip()
                        # We only care about 'Personal' for these specific credit output files
                        if primary_cat != 'Personal':
                            continue

                        # Call map_transaction_to_tax_category with primary_cat already known to be 'Personal'
                        tax_category, _ = map_transaction_to_tax_category(row, primary_cat) 
                        
                        if tax_category == target_tax_category:
                            filtered_tx_list.append(row)
                
                if filtered_tx_list:
                    with open(output_file_path, 'w', newline='', encoding='utf-8') as outfile:
                        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(filtered_tx_list)
                    print(f"Filtered {target_tax_category} transactions saved to: {output_file_path}")
                    return True
                else:
                    print(f"No '{target_tax_category}' transactions found for 'Personal' PrimaryCategory to save to {output_file_path}.")
                    return False
            except FileNotFoundError:
                print(f"Error: Input CSV file not found at {csv_file_path} for generating {output_file_path}")
                return False
            except Exception as e:
                print(f"Error generating {output_file_path}: {e}")
                return False

        if args.medical_transactions_output:
            write_filtered_transactions_to_csv(args.csv_file, args.medical_transactions_output, 'Credit: Medical Expenses')

        if args.donation_transactions_output:
            write_filtered_transactions_to_csv(args.csv_file, args.donation_transactions_output, 'Credit: Donations')
        
        # Optionally print some details for categories with 'Review' or 'Info'
        print("\n--- Items for Review/Information (from initial mapping, first 5 per category) ---")
        for cat_key in sorted(details_dict.keys()): 
            if cat_key.startswith('Review:') or cat_key.startswith('Info:'):
                if args.investigate_draws and "MPYRE Software Inc." in cat_key and ("Transfer" in cat_key or "Withdrawal" in cat_key):
                    continue # Avoid re-printing if covered by investigate_draws
                print(f"\nCategory: {cat_key}")
                for i, txn_detail in enumerate(details_dict[cat_key][:5]):
                    print(f"  - Date: {txn_detail.get('Date')}, Acc: {txn_detail.get('Account Name', 'N/A')}, Amt: {txn_detail.get('Amount', 'N/A')}, Desc: {txn_detail.get('Description', 'N/A')}, AI Cat: {txn_detail.get('ai_category', 'N/A')}, PrimaryCat: {txn_detail.get('PrimaryCategory', 'N/A')}")
            elif 'Not Directly Mapped' in cat_key and details_dict[cat_key]:
                print(f"\nCategory: {cat_key}")
                for i, txn_detail in enumerate(details_dict[cat_key][:5]):
                     print(f"  - Date: {txn_detail.get('Date')}, Acc: {txn_detail.get('Account Name', 'N/A')}, Amt: {txn_detail.get('Amount', 'N/A')}, Desc: {txn_detail.get('Description', 'N/A')}, AI Cat: {txn_detail.get('ai_category', 'N/A')}, PrimaryCat: {txn_detail.get('PrimaryCategory', 'N/A')}")
            elif cat_key == 'Processing Errors' and details_dict[cat_key]:
                print(f"\nCategory: {cat_key}")
                for i, txn_detail in enumerate(details_dict[cat_key][:5]):
                    print(f"  - Row causing error: {txn_detail}")
    else:
        print("No summary generated. CSV might be empty, not found, or 'PrimaryCategory' column missing.")


    print("\nAnalysis complete.")
    # The main summary is printed at the beginning of the 'if summary:' block now.
    # No need for the fallback print at the end. 