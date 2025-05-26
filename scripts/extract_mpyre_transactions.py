import sqlite3
import csv
import sys
import os

def extract_transactions(db_path, year, output_csv_path, use_account_name_filter=False):
    """
    Connects to the SQLite database, extracts transactions for 'MPYRE Software Inc.'
    for the specified year (either by PrimaryCategory or Account Name),
    and saves them to a CSV file.
    """
    if not os.path.exists(os.path.dirname(output_csv_path)):
        os.makedirs(os.path.dirname(output_csv_path))

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        base_query_select = """
        SELECT
            id,
            STRFTIME('%Y-%m-%d', "Date") as Date,
            "Account Name",
            "Amount",
            "Description",
            "SourceFile",
            "PrimaryCategory",
            "Currency",
            "RawData",
            "SheetTransactionID"
        FROM transactions
        """
        
        where_clauses = ["STRFTIME('%Y', \"Date\") = ?"]
        params = [str(year)]

        if use_account_name_filter:
            where_clauses.append("\"Account Name\" LIKE ?")
            params.append('%Mpyre%')
            print(f"Querying by Account Name containing 'Mpyre' for year {year}")
        else:
            where_clauses.append("\"PrimaryCategory\" = ?")
            params.append('MPYRE Software Inc.')
            print(f"Querying by PrimaryCategory 'MPYRE Software Inc.' for year {year}")
        
        query = base_query_select + " WHERE " + " AND ".join(where_clauses) + " ORDER BY \"Date\";"
        
        print(f"Executing query: {query}")
        print(f"With parameters: {params}")

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        column_names = [description[0] for description in cursor.description]

        with open(output_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            csvwriter = csv.writer(csvfile)
            csvwriter.writerow(column_names)
            csvwriter.writerows(rows)

        print(f"Successfully extracted {len(rows)} transactions for {year} to {output_csv_path} (Filter: {'Account Name' if use_account_name_filter else 'PrimaryCategory'})")
        return len(rows)

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return -1
    except Exception as e:
        print(f"An error occurred: {e}")
        return -1
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print("Usage: python extract_mpyre_transactions.py <db_path> <year> <output_csv_path> [--use-account-name]")
        sys.exit(1)

    db_path_arg = sys.argv[1]
    year_arg = sys.argv[2]
    output_csv_path_arg = sys.argv[3]
    use_account_name_arg = False
    if len(sys.argv) == 5 and sys.argv[4] == '--use-account-name':
        use_account_name_arg = True

    num_extracted = extract_transactions(db_path_arg, year_arg, output_csv_path_arg, use_account_name_filter=use_account_name_arg)

    if num_extracted == 0 and not use_account_name_arg:
        print("No transactions found with PrimaryCategory. Trying with Account Name filter...")
        extract_transactions(db_path_arg, year_arg, output_csv_path_arg, use_account_name_filter=True) 