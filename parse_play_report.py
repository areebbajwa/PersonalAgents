import csv

def calculate_net_payout(filename="/Users/areeb2/Downloads/PlayApps_202412.csv"):
    total_payout = 0.0
    amount_column_index = -1

    with open(filename, 'r', newline='') as csvfile:
        reader = csv.reader(csvfile)
        
        header = next(reader) # Read the header row
        try:
            # Find the index of the 'Amount (Merchant Currency)' column
            amount_column_index = header.index('Amount (Merchant Currency)')
        except ValueError:
            print("Error: 'Amount (Merchant Currency)' column not found in the header.")
            return

        for row in reader:
            try:
                # Ensure the row has enough columns
                if len(row) > amount_column_index:
                    amount_str = row[amount_column_index]
                    if amount_str: # Check if the string is not empty
                        total_payout += float(amount_str)
            except ValueError:
                # Handle cases where conversion to float might fail for a specific row
                print(f"Warning: Could not convert '{row[amount_column_index]}' to float for row: {row}")
            except IndexError:
                # Handle rows that might be shorter than expected (should be caught by len check ideally)
                print(f"Warning: Row is too short: {row}")

    print(f"{total_payout:.2f}")

if __name__ == "__main__":
    calculate_net_payout() 