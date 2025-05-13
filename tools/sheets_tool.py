import os
import json
from typing import ClassVar, Dict, List, Any
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from langchain.tools import BaseTool
from googleapiclient.errors import HttpError

# If modifying these SCOPES, delete the file token.json.
# Updated to include write access
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Path to your client secrets and token files
CLIENT_SECRET_FILE = "client_secret.json"
TOKEN_FILE = "token.json"

def get_sheets_credentials():
    """Gets valid user credentials from storage.
    
    If nothing has been stored, or if the stored credentials are invalid,
    the OAuth2 flow is completed to obtain the new credentials.
    
    Returns:
        Credentials, the obtained credential.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first time.
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_info(json.load(open(TOKEN_FILE)))
        except Exception as e:
            print(f"Error loading credentials from token file: {e}")
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing credentials: {e}")
                # If refresh fails, proceed to the flow
                flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            try:
                flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"Error running OAuth flow: {e}")
                return None
        
        # Save the credentials for the next run
        try:
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())
        except Exception as e:
            print(f"Error saving credentials to token file: {e}")
    
    return creds

class SheetsCommitmentTool(BaseTool):
    """Tool for reading commitment information from a Google Sheet."""
    # LIKELY REDUNDANT: The GenericSheetsReaderTool combined with agent-led instructions 
    # for sheet_id and range should be ableto cover this functionality.
    
    name: str = "google_sheets_commitment_reader"
    description: str = "DEPRECATED. Use google_sheets_generic_reader. Reads members' monthly commitment values from a Google Sheet."
    
    # Sheet details moved directly into the class
    sheet_id: ClassVar[str] = "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4"  # Milton Tuesday Halaqa Interac Transfers
    range: ClassVar[str] = "Commitments!A:G"
    
    def _run(self) -> Dict[str, Dict[str, Any]]:
        """Read commitment data from Google Sheets and return it as a dictionary."""
        print(f"SheetsCommitmentTool: Retrieving commitments from sheet ID: {self.sheet_id}")
        
        try:
            service = build("sheets", "v4", credentials=get_sheets_credentials())
            
            # Call the Sheets API
            sheet = service.spreadsheets()
            result = sheet.values().get(spreadsheetId=self.sheet_id, range=self.range).execute()
            values = result.get("values", [])
            
            if not values:
                print("No commitment data found in sheet.")
                return {}
            
            # Parse the commitment data
            # Assume format: Name | Amount | Phone Number | ... (other columns we don't need)
            commitments = {}
            headers = [h.lower() for h in values[0]]  # Convert headers to lowercase
            
            # Find the indices of the relevant columns
            name_idx = headers.index("name") if "name" in headers else 0
            amount_idx = headers.index("amount") if "amount" in headers else 1
            phone_idx = headers.index("phone") if "phone" in headers else 2
            
            for row in values[1:]:  # Skip the header row
                if len(row) > max(name_idx, amount_idx, phone_idx):
                    name = row[name_idx].strip() if row[name_idx] else "Unknown"
                    
                    # Handle the amount, converting to float
                    amount_str = row[amount_idx].strip() if len(row) > amount_idx and row[amount_idx] else "0"
                    # Remove any currency symbols or commas
                    amount_str = amount_str.replace('$', '').replace(',', '')
                    try:
                        amount = float(amount_str)
                    except ValueError:
                        print(f"Invalid amount value for {name}: {amount_str}")
                        amount = 0.0
                    
                    # Get phone if available
                    phone = row[phone_idx].strip() if len(row) > phone_idx and row[phone_idx] else ""
                    
                    commitments[name] = {"commitment": amount, "phone": phone}
            
            return commitments
            
        except Exception as e:
            print(f"Error accessing Google Sheets: {e}")
            return {"error": str(e)}

class GenericSheetsReaderTool(BaseTool):
    """Tool for reading data from a specified range in a Google Sheet."""
    
    name: str = "google_sheets_generic_reader"
    description: str = (
        "Reads data from a specified sheet and range within a Google Spreadsheet. "
        "Input should be the sheet_id (string) and the data_range (string, e.g., 'Sheet1!A1:G50' or 'MySheet!A:C'). "
        "If you have a full Google Sheet URL, try to extract the sheet ID (the long alphanumeric string in the URL, typically after '/d/' and before '/edit') to use as the sheet_id argument. "
        "The first row of the range is assumed to be the header. "
        "Optionally, you can provide 'filter_column' (string, name of the column to filter), "
        "'filter_value' (string, the value to search for in the filter_column), "
        "and 'filter_type' (string, can be 'contains' (default) or 'exact' for matching). "
        "If filter arguments are provided, only rows matching the criteria will be returned. "
        "Returns a list of dictionaries, where each dictionary represents a row, with column headers as keys."
    )
    
    def _run(self, sheet_id: str, data_range: str, filter_column: str = None, filter_value: str = None, filter_type: str = "contains") -> List[Dict[str, Any]]:
        """Read data from the specified Google Sheet and range, with optional filtering.

        Args:
            sheet_id: The ID of the Google Spreadsheet.
            data_range: The A1 notation of the range to read (e.g., 'Sheet1!A1:G50', 'MySheet!A:C').
            filter_column: Optional. The name of the column to filter on.
            filter_value: Optional. The value to filter for in the filter_column.
            filter_type: Optional. Type of filter match: 'contains' (default) or 'exact'.

        Returns:
            A list of dictionaries, where keys are column headers and values are cell values.
            Returns an empty list if no data is found or if an error occurs.
            If filtering is applied, only matching rows are returned.
        """
        print(f"GenericSheetsReaderTool: Reading from sheet ID '{sheet_id}', range '{data_range}'")
        if filter_column and filter_value:
            print(f"GenericSheetsReaderTool: Applying filter: column='{filter_column}', value='{filter_value}', type='{filter_type}'")
        
        try:
            creds = get_sheets_credentials()
            if not creds:
                return [{"error": "Failed to get Google Sheets credentials."}]
                
            service = build("sheets", "v4", credentials=creds)
            sheet_api = service.spreadsheets()
            
            result = sheet_api.values().get(spreadsheetId=sheet_id, range=data_range).execute()
            values = result.get("values", [])
            
            if not values:
                print(f"GenericSheetsReaderTool: No data found in sheet ID '{sheet_id}', range '{data_range}'.")
                return []
            
            headers = [str(header).strip() for header in values[0]] # First row as headers
            all_data_rows = []
            
            for row in values[1:]: # Skip header row
                row_data = {}
                for i, cell_value in enumerate(row):
                    if i < len(headers):
                        row_data[headers[i]] = str(cell_value).strip()
                # Ensure all headers have a corresponding value, even if empty
                for header in headers:
                    if header not in row_data:
                        row_data[header] = ""
                if row_data: # Only add if there's some data
                    all_data_rows.append(row_data)
            
            if not filter_column or not filter_value:
                print(f"GenericSheetsReaderTool: Successfully read {len(all_data_rows)} rows from {data_range} (no filter applied).")
                return all_data_rows

            # Apply filtering
            if filter_column not in headers:
                print(f"GenericSheetsReaderTool: Filter column '{filter_column}' not found in headers: {headers}. Returning all rows.")
                # Alternatively, return an error: return [{"error": f"Filter column '{filter_column}' not found."}]
                return all_data_rows 

            filtered_data_rows = []
            for row_dict in all_data_rows:
                cell_content = row_dict.get(filter_column, "")
                match = False
                if filter_type == "contains":
                    if filter_value.lower() in cell_content.lower():
                        match = True
                elif filter_type == "exact":
                    if filter_value.lower() == cell_content.lower():
                        match = True
                else:
                    # Default to contains if filter_type is unknown, or return error
                    print(f"GenericSheetsReaderTool: Unknown filter_type '{filter_type}'. Defaulting to 'contains'.")
                    if filter_value.lower() in cell_content.lower():
                        match = True
                
                if match:
                    filtered_data_rows.append(row_dict)
            
            print(f"GenericSheetsReaderTool: Successfully read {len(all_data_rows)} rows, returned {len(filtered_data_rows)} after filtering.")
            return filtered_data_rows
            
        except HttpError as e:
            print(f"GenericSheetsReaderTool: Google Sheets API error for sheet ID '{sheet_id}', range '{data_range}': {e}")
            # Try to provide a more specific error message from the API response
            error_content = e.resp.reason
            try:
                content_dict = json.loads(e.content)
                if 'error' in content_dict and 'message' in content_dict['error']:
                    error_content = content_dict['error']['message']
            except:
                pass # Stick with the reason if content parsing fails
            return [{"error": f"Google Sheets API error: {error_content}"}]
        except Exception as e:
            print(f"GenericSheetsReaderTool: Unexpected error for sheet ID '{sheet_id}', range '{data_range}': {e}")
            return [{"error": str(e)}]

class GenericSheetsWriterTool(BaseTool):
    """Tool for writing/appending data to a specified range in a Google Sheet."""
    
    name: str = "google_sheets_generic_writer"
    description: str = (
        "Writes data to a specified sheet and range within a Google Spreadsheet. " 
        "This tool appends rows to the first empty row found at or after the specified data_range. " 
        "Input should be the sheet_id (string), the data_range (string, e.g., 'Sheet1!A1' or 'MySheet!A:A' - this is where the tool will look to append data, typically the start of your table or the sheet name itself like 'Sheet1'), " 
        "and a 'values' (list of lists), where each inner list represents a row and items in the inner list are cell values for that row. "
        "If you have a full Google Sheet URL, try to extract the sheet ID (the long alphanumeric string in the URL, typically after '/d/' and before '/edit') to use as the sheet_id argument."
    )
    
    def _run(self, sheet_id: str, data_range: str, values: List[List[Any]]) -> Dict[str, Any]:
        """Write/append data to the specified Google Sheet and range.

        Args:
            sheet_id: The ID of the Google Spreadsheet.
            data_range: The A1 notation of the range (e.g., 'Sheet1!A1', 'MySheet!A:A'). 
                        The tool appends after the last row with data in this range.
            values: A list of lists, where each inner list represents a row to be appended.
                    Example: [["Date", "Name", "Amount"], ["2023-01-01", "John Doe", 100]]

        Returns:
            A dictionary indicating the status of the operation, e.g., 
            {"status": "success", "updates": response_from_api} or {"error": "message"}.
        """
        if not values:
            return {"error": "No values provided to write."}
        
        print(f"GenericSheetsWriterTool: Attempting to write {len(values)} rows to sheet ID '{sheet_id}', starting at range '{data_range}'")
        
        try:
            creds = get_sheets_credentials()
            if not creds:
                return {"error": "Failed to get Google Sheets credentials."}
                
            service = build("sheets", "v4", credentials=creds)
            sheet_api = service.spreadsheets()
            
            body = {
                'values': values
            }
            
            # Append the values. This will add the data after the last row that has data in the specified range.
            # For more control, one might first get the sheet and find the exact next empty row if appending to a non-contiguous block.
            # However, 'append' is generally robust for adding to tables.
            result = sheet_api.values().append(
                spreadsheetId=sheet_id, 
                range=data_range, # The range to search for a table to append to.
                valueInputOption='USER_ENTERED', # Parses strings as numbers, dates, etc.
                insertDataOption='INSERT_ROWS', # Inserts new rows for the data rather than overwriting.
                body=body
            ).execute()
            
            print(f"GenericSheetsWriterTool: Successfully appended data. Response: {result}")
            return {"status": "success", "updates": result.get('updates')}
            
        except HttpError as e:
            print(f"GenericSheetsWriterTool: Google Sheets API error for sheet ID '{sheet_id}': {e}")
            error_content = e.resp.reason
            try:
                content_dict = json.loads(e.content)
                if 'error' in content_dict and 'message' in content_dict['error']:
                    error_content = content_dict['error']['message']
            except:
                pass
            return {"error": f"Google Sheets API error: {error_content}"}
        except Exception as e:
            print(f"GenericSheetsWriterTool: Unexpected error for sheet ID '{sheet_id}': {e}")
            return {"error": str(e)}

# TODO: Review if BankEtransferTool is still needed or if its logic can be part of the agent.
# For now, ensure its description is clear if it were to be used by an agent.
class BankEtransferTool(BaseTool):
    """Tool for recording bank e-transfer information."""
    
    name: str = "bank_etransfer_recorder"
    description: str = "Use this tool to record bank e-transfer information."
    
    def _run(self, transfer_info: Dict[str, Any]) -> Dict[str, Any]:
        """Record bank e-transfer information.
        
        Args:
            transfer_info: A dictionary containing bank e-transfer information.
            
        Returns:
            A dictionary indicating the status of the operation.
        """
        # Implementation of the tool's functionality
        # This is a placeholder and should be replaced with the actual implementation
        return {"status": "Not implemented"} 