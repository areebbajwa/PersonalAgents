import os, datetime
from langgraph.graph import Graph, START, END
from tools.sheets_tool import SheetsCommitmentTool
from tools.bank_tool import BankEtransferTool
from tools.whatsapp_tool import WhatsAppPersonalTool

# ---- helper --------------------------------------------------

# def lookup_phone(name: str) -> str:
#     return PHONEBOOK[name]

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
    month = state["month"]
    paid_data = BankEtransferTool().invoke({"month": month})
    updated_state = {**state, "paid": paid_data}
    print(f"fetch_bank will return: {updated_state}")
    return updated_state

def diff(state):
    print(f"diff received state: {state}")
    commit = state["commit"]; paid = state["paid"]
    short_data = {}
    for n, data in commit.items():
        commitment_amount = data["commitment"]
        amount_paid = paid.get(n, 0.0)
        if commitment_amount > amount_paid:
            short_data[n] = round(commitment_amount - amount_paid, 2)
    
    updated_state = {**state, "short": short_data}
    print(f"diff will return: {updated_state}")
    return updated_state

def notify(state):
    print(f"notify received state: {state}")
    wa = WhatsAppPersonalTool()
    commit_data = state["commit"]
    
    def format_phone_number(raw_phone_number: str) -> str:
        # Remove common non-digit characters except '+'
        # Make sure to handle potential None or non-string types gracefully
        if not isinstance(raw_phone_number, str):
            return "" # Or handle error appropriately
            
        # Keep '+' for now, remove others like ' ', '-', '(', ')'
        cleaned_number = "".join(filter(lambda char: char.isdigit() or char == '+', raw_phone_number))

        # Remove leading '+' if it exists
        if cleaned_number.startswith("+"):
            cleaned_number = cleaned_number[1:]

        # If it's a 10-digit number (common for North America), prepend '1'
        # This is a simplification; more robust validation might be needed for international numbers
        if len(cleaned_number) == 10 and cleaned_number.isdigit(): # Ensure it's all digits after stripping '+'
            return "1" + cleaned_number
        elif cleaned_number.isdigit(): # If it's already an international format (e.g., "44...") or a NA number with "1"
            return cleaned_number
        else:
            print(f"Warning: Phone number '{raw_phone_number}' resulted in an unexpected format after cleaning: '{cleaned_number}'. Using as is (if not empty).")
            return cleaned_number # Return as is if it doesn't fit NA pattern and isn't purely digits

    # ---- MODIFICATION: Only process OMAR ISHAAQ KHAN ----
    target_person = "OMAR ISHAAQ KHAN"
    if target_person in state["short"]:
        owing = state["short"][target_person]
        if target_person in commit_data and commit_data[target_person].get("phone"):
            body = (
                f"Salam {target_person}! You're short ${owing:.2f} "
                f"for this month's halaqa fee. JazakumAllahu khairan!"
            )
            raw_phone = commit_data[target_person]["phone"]
            formatted_phone_number = format_phone_number(raw_phone)
            
            if formatted_phone_number:
                print(f"--- Preparing to send WhatsApp message ---")
                print(f"To (Person): {target_person}")
                print(f"Raw Phone: {raw_phone} -> Formatted Phone: {formatted_phone_number}")
                print(f"Body: {body}")
                print(f"------------------------------------------")
                try:
                    wa.invoke({"phone": formatted_phone_number, "body": body})
                    print(f"WhatsApp message invocation for {target_person} complete.")
                except Exception as e:
                    print(f"Error invoking WhatsApp tool for {target_person}: {e}")
            else:
                print(f"Could not format phone number for {target_person} (Raw: {raw_phone}). Skipping.")
        else:
            print(f"No phone number found for {target_person} in commit_data or 'short' list. Skipping notification.")
    else:
        print(f"{target_person} not found in 'short' list, or owes $0. No message will be sent.")
    
    # Process other people as before, but just print, don't send
    for person, owing in state["short"].items():
        if person == target_person:
            continue # Already handled

        body = (
            f"Salam {person}! You're short ${owing:.2f} "
            f"for this month's halaqa fee. JazakumAllahu khairan!"
        )
        if person in commit_data and commit_data[person].get("phone"):
            raw_phone = commit_data[person]["phone"]
            formatted_phone_number = format_phone_number(raw_phone)

            if formatted_phone_number:
                print(f"--- (WOULD SEND) WhatsApp message ---")
                print(f"To (Person): {person}")
                print(f"Raw Phone: {raw_phone} -> Formatted Phone: {formatted_phone_number}")
                print(f"Body: {body}")
                print(f"-------------------------------------\n") # Added newline for readability
            else:
                print(f"Could not format phone number for {person} (Raw: {raw_phone}) (would skip notification).")
        else:
            print(f"No phone number found for {person} (would skip notification).")
    return {}

# ---- graph wiring -------------------------------------------
g = Graph()
g.add_node("fetch_sheet", fetch_sheet)
g.add_node("fetch_bank",  fetch_bank)
g.add_node("diff",        diff)
g.add_node("notify",      notify)

g.add_edge(START, "fetch_sheet")
g.add_edge("fetch_sheet", "fetch_bank") # Restore this edge
# g.add_edge("fetch_sheet", END) # Remove temporary edge
g.add_edge("fetch_bank",  "diff")
g.add_edge("diff",        "notify")
g.add_edge("notify",      END)

HALAQA_GRAPH = g.compile() 