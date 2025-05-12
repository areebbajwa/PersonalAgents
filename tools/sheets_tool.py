import os
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from langchain.tools import BaseTool

# If modifying these SCOPES, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Path to your client secrets and token files
CLIENT_SECRET_FILE = "client_secret.json"
TOKEN_FILE = "token.json"

class SheetsCommitmentTool(BaseTool):
    name: str = "get_halaqa_commitments"
    description: str = "Return {name: {'commitment': float monthly_commitment, 'phone': str phone_number}} from Google Sheets. Expects Name in Col A, Commitment Amount in Col B, and Phone Number in Col G. Reads range A:G."

    def _get_credentials(self):
        creds = None
        # The file token.json stores the user's access and refresh tokens, and is
        # created automatically when the authorization flow completes for the first
        # time.
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        # If there are no (valid) credentials available, let the user log in.
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    CLIENT_SECRET_FILE, SCOPES)
                # Note: The following line will attempt to open a browser for user authorization.
                # It will start a local server to listen for the authorization code.
                # You might need to copy the URL from the console and paste it into your browser manually if running in a restricted environment.
                creds = flow.run_local_server(port=0)
            # Save the credentials for the next run
            with open(TOKEN_FILE, "w") as token:
                token.write(creds.to_json())
        return creds

    def _run(self) -> dict:
        sheet_id   = os.environ["SHEET_ID"]
        sheet_rng  = os.environ["SHEET_RANGE"]

        creds = self._get_credentials()
        try:
            service = build("sheets", "v4", credentials=creds)
            sheet = service.spreadsheets()
            result = (
                sheet.values()
                .get(spreadsheetId=sheet_id, range=sheet_rng)
                .execute()
            )
            values = result.get("values", [])

            if not values:
                print("No data found.")
                return {}
            else:
                processed_values = {}
                # Skip header row by starting from values[1:]
                for r in values[1:]: # Assuming first row is header
                    # Expect Name (col A, index 0), Amount (col B, index 1), Phone (col G, index 6)
                    # Ensure row has enough columns and the required fields are present
                    if r and len(r) >= 7 and r[0] and r[1] and r[6]:
                        name = r[0].strip()
                        amount_str = str(r[1]).strip() # Commitment from Column B
                        phone = str(r[6]).strip()      # Phone from Column G
                        
                        # Remove common currency symbols and whitespace from amount
                        for char in ['$', '€', '£', ',']: # Add other symbols if needed
                            amount_str = amount_str.replace(char, '')
                        try:
                            amount = float(amount_str)
                            processed_values[name] = {"commitment": amount, "phone": phone}
                        except ValueError:
                            print(f"Could not convert amount '{r[1]}' to float for {name}. Skipping.")
                    elif r and len(r) > 0: # If row has some data but not the expected format
                        name_in_row = r[0].strip() if r[0] else "Unknown"
                        if len(r) < 7:
                            print(f"Row for {name_in_row} has fewer than 7 columns. Skipping: {r}")
                        elif not r[0]:
                            print(f"Row is missing Name (Column A). Skipping: {r}")
                        elif not r[1]:
                             print(f"Row for {name_in_row} is missing Commitment Amount (Column B). Skipping: {r}")
                        elif not r[6]:
                             print(f"Row for {name_in_row} is missing Phone Number (Column G). Skipping: {r}")
                        else:
                            print(f"Skipping row due to unexpected format: {r}")
                    elif r: # Row exists but is empty or very short
                        print(f"Skipping malformed or sparse row: {r}")
                return processed_values
        except Exception as e:
            print(f"An error occurred: {e}")
            # Potentially re-raise or handle more gracefully
            # If it's an auth error, deleting token.json might help for the next run
            if "invalid_grant" in str(e) or "token has been expired or revoked" in str(e):
                if os.path.exists(TOKEN_FILE):
                    os.remove(TOKEN_FILE)
                    print(f"Deleted {TOKEN_FILE} due to auth error. Please re-run to authorize.")
            return {"error": str(e)} 