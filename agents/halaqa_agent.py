import os, datetime
from langgraph.graph import Graph, START, END
from tools.sheets_tool import SheetsCommitmentTool, TransfersSheetTool, get_sheets_credentials
from tools.bank_tool import BankEtransferTool

# ---- helper functions -----------------------------------------
def get_existing_transfers(sheet_id, creds_func):
    """Get existing transfers from the Transfers worksheet"""
    from googleapiclient.discovery import build
    
    try:
        service = build("sheets", "v4", credentials=creds_func())
        sheet = service.spreadsheets()
        
        # First check if the Transfers sheet exists
        sheet_metadata = sheet.get(spreadsheetId=sheet_id).execute()
        sheets = sheet_metadata.get('sheets', [])
        sheet_exists = False
        
        for s in sheets:
            if s['properties']['title'] == "Transfers":
                sheet_exists = True
                break
                
        if not sheet_exists:
            return []  # No transfers sheet yet
        
        # Get the transfers data
        result = sheet.values().get(
            spreadsheetId=sheet_id,
            range="Transfers!A:F"  # Read all 6 columns
        ).execute()
        
        values = result.get("values", [])
        if not values or len(values) <= 1:  # Only header or empty
            return []
            
        # Skip header row, create list of transfer records
        existing_transfers = []
        for row in values[1:]:  # Skip header
            if len(row) >= 5:  # Expect at least Date, Sender Name, Amount, Type, Status
                transfer = {
                    "date": row[0] if len(row) > 0 else "",
                    "sender": row[1] if len(row) > 1 else "",      # Column B is Sender Name
                    "amount": row[2] if len(row) > 2 else "",      # Column C is Amount
                    "type": row[3] if len(row) > 3 else "",        # Column D is Transfer Type
                    "status": row[4] if len(row) > 4 else "",      # Column E is Transfer Status
                    # "notes": row[5] if len(row) > 5 else ""    # Column F is Notes (optional for now)
                }
                existing_transfers.append(transfer)
                
        return existing_transfers
        
    except Exception as e:
        print(f"Error getting existing transfers: {e}")
        return []

def format_transfer_for_comparison(transfer):
    """Format a transfer record for comparison"""
    # Normalize data for comparison
    return {
        "date": str(transfer.get("date", "")),
        "sender": str(transfer.get("sender", "")).upper(),
        "amount": str(transfer.get("amount", ""))
    }

def transfers_are_equal(t1, t2):
    """Compare two transfers to see if they are the same"""
    t1_fmt = format_transfer_for_comparison(t1)
    t2_fmt = format_transfer_for_comparison(t2)
    
    # Compare date, sender, and amount
    return (t1_fmt["date"] == t2_fmt["date"] and 
            t1_fmt["sender"] == t2_fmt["sender"] and 
            t1_fmt["amount"] == t2_fmt["amount"])

def is_new_transfer(transfer, existing_transfers):
    """Check if a transfer is new (not in existing_transfers)"""
    for existing in existing_transfers:
        if transfers_are_equal(transfer, existing):
            return False
    return True

# ---- nodes ---------------------------------------------------
def fetch_sheet(state):
    print(f"fetch_sheet received state: {state}")
    commit_data = SheetsCommitmentTool().invoke({})
    print("--- Data fetched from Google Sheet ---")
    if isinstance(commit_data, dict) and commit_data:
        for name, data in commit_data.items():
            if isinstance(data, dict):
                commitment = data.get('commitment', 'N/A')
                phone = data.get('phone', 'N/A')
                print(f"Name: {name}, Commitment: {commitment}, Phone: {phone}")
            else:
                print(f"Name: {name}, Data: {data} (Unexpected format)")
    elif not commit_data:
        print("No data returned from SheetsCommitmentTool.")
    else:
        print(f"Unexpected data format from SheetsCommitmentTool: {commit_data}")
    print("--------------------------------------")
    updated_state = {**state, "commit": commit_data}
    print(f"fetch_sheet will return: {updated_state}")
    return updated_state

def fetch_bank(state):
    print(f"fetch_bank received state: {state}")
    month_to_filter = state["month"] # e.g., "2025-05"
    
    # This will now return a list of individual transfer dicts from the hardcoded data
    individual_transfers_list = BankEtransferTool().invoke({"month": month_to_filter}) 
    
    paid_data_for_month = {}
    # Filter transfers for the current month and aggregate amounts by sender for paid_data
    if individual_transfers_list:
        for transfer in individual_transfers_list:
            transfer_date_str = transfer.get("date", "") # Expected YYYY-MM-DD
            sender = transfer.get("name", "UNKNOWN SENDER").upper()
            amount = transfer.get("amount", 0.0)
            
            # Check if the transfer belongs to the current month_to_filter
            if transfer_date_str.startswith(month_to_filter):
                paid_data_for_month[sender] = paid_data_for_month.get(sender, 0.0) + amount
    
    # The 'transfers' key in the state should be the list of individual transfers 
    # (potentially filtered for the month, or all, depending on downstream needs).
    # The diff node uses `state["paid"]` (which is `paid_data_for_month` here) to compare against commitments.
    # The update_transfers node uses `state["transfers"]` to write to the sheet.
    # We should pass all fetched individual transfers to `state["transfers"]` 
    # so `update_transfers` can check for duplicates correctly across all fetched data.

    updated_state = {**state, "paid": paid_data_for_month, "transfers": individual_transfers_list}
    print(f"fetch_bank will return: {updated_state}")
    return updated_state

def diff(state):
    print(f"diff received state: {state}")
    commit = state["commit"]; paid = state["paid"]
    short_data = {}
    
    # Check if there was an error in fetching the commitments
    if isinstance(commit, dict) and "error" in commit:
        print(f"Error in commitment data: {commit['error']}")
        # Return the state with an empty short_data
        return {**state, "short": short_data}
    
    # Process the valid commitment data
    try:
        for n, data in commit.items():
            # Check if the data is in the expected format
            if isinstance(data, dict) and "commitment" in data:
                commitment_amount = data["commitment"]
                amount_paid = paid.get(n, 0.0)
                if commitment_amount > amount_paid:
                    short_data[n] = round(commitment_amount - amount_paid, 2)
            else:
                print(f"Skipping entry for {n}: data not in expected format. Got: {data}")
    except Exception as e:
        print(f"Error processing commitment data: {e}")
        # If an error occurs, continue with what we have
    
    updated_state = {**state, "short": short_data}
    print(f"diff will return: {updated_state}")
    return updated_state

def update_transfers(state):
    """Node to update Google Sheets with the transfer data."""
    print(f"update_transfers received state: {state}")
    transfers = state.get("transfers", [])
    
    if not transfers:
        print("No transfers to update in Google Sheets.")
        return {**state, "sheets_result": {"status": "No transfers to update"}}
    
    try:
        # Create a TransfersSheetTool instance to get the sheet_id
        sheet_tool = TransfersSheetTool()
        
        # Get existing transfers from the Transfers worksheet
        existing_transfers = get_existing_transfers(sheet_tool.sheet_id, get_sheets_credentials)
        print(f"Found {len(existing_transfers)} existing transfers in the sheet.")
        
        # Filter out transfers that already exist in the sheet
        new_transfers = []
        for transfer in transfers:
            if is_new_transfer(transfer, existing_transfers):
                new_transfers.append(transfer)
        
        print(f"Found {len(new_transfers)} new transfers to add to the sheet.")
        
        if not new_transfers:
            print("All transfers already exist in the sheet.")
            return {**state, "sheets_result": {"status": "No new transfers to add"}}
        
        # Sort new_transfers by date in ascending order before writing
        new_transfers.sort(key=lambda t: t.get('date', ''))
        print(f"Sorted {len(new_transfers)} new transfers by date (ascending).")
        
        # Use the TransfersSheetTool to update the sheet with new transfers
        result = sheet_tool.invoke({"transfers": new_transfers})
        
        print(f"Google Sheets update result: {result}")
        return {**state, "sheets_result": result}
    except Exception as e:
        print(f"Error updating Google Sheets: {e}")
        return {**state, "sheets_result": {"status": "error", "message": str(e)}}

# ---- graph wiring -------------------------------------------
g = Graph()
g.add_node("fetch_sheet", fetch_sheet)
g.add_node("fetch_bank",  fetch_bank)
g.add_node("diff",        diff)
g.add_node("update_transfers", update_transfers)

g.add_edge(START, "fetch_sheet")
g.add_edge("fetch_sheet", "fetch_bank")
g.add_edge("fetch_bank",  "diff")
g.add_edge("diff",        "update_transfers")
g.add_edge("update_transfers", END)

HALAQA_GRAPH = g.compile() 