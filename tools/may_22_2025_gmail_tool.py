import os
import json
import base64
import re
from typing import List, Dict, Any, Optional, ClassVar

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from langchain.tools import BaseTool

# If modifying these SCOPES, delete the file config/gmail_token.json.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Path to your client secrets and token files
# IMPORTANT: Ensure config/client_secret.json has Gmail API enabled in Google Cloud Console.
CLIENT_SECRET_FILE = "config/client_secret.json" 
GMAIL_TOKEN_FILE = "config/gmail_token.json" # Separate token file for Gmail

def get_gmail_credentials():
    """Gets valid user credentials for Gmail API from storage.
    
    If nothing has been stored, or if the stored credentials are invalid,
    the OAuth2 flow is completed to obtain the new credentials.
    
    Returns:
        Credentials, the obtained credential.
    """
    creds = None
    if os.path.exists(GMAIL_TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_FILE, SCOPES)
        except Exception as e:
            print(f"Error loading Gmail token: {e}. Attempting re-authentication.")
            creds = None # Ensure creds is None if token loading fails

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                print("Gmail credentials expired, attempting to refresh...")
                creds.refresh(Request())
                print("Gmail credentials refreshed successfully.")
            except Exception as e:
                print(f"Error refreshing Gmail credentials: {e}")
                creds = None # Invalidate creds if refresh fails
        
        if not creds: # If refresh failed or no token file
            try:
                print("Gmail credentials not found or invalid, initiating new OAuth flow...")
                flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
                # Correctly pass the port for the local server if needed, or let it pick one.
                # Forcing a specific port might be an issue if it's in use.
                # creds = flow.run_local_server(port=0) # port=0 lets it pick an available port
                
                # The run_console() method is better for non-web environments or when a browser isn't guaranteed.
                # However, for this agent, run_local_server is usually what's intended for user interaction.
                # Let's stick to run_local_server as it's more common for this type of auth.
                # The user will need to authorize via browser.
                creds = flow.run_local_server(port=0) 
                print("Gmail OAuth flow completed.")
            except Exception as e:
                print(f"Error during Gmail OAuth flow: {e}")
                return None # Return None if flow fails
        
        # Save the credentials for the next run
        try:
            with open(GMAIL_TOKEN_FILE, 'w') as token_file:
                token_file.write(creds.to_json())
            print(f"Gmail credentials saved to {GMAIL_TOKEN_FILE}")
        except Exception as e:
            print(f"Error saving Gmail token: {e}")
            # Credentials might still be usable for the current session even if saving fails
            
    if creds and creds.valid:
        return creds
    else:
        print("Failed to obtain valid Gmail credentials.")
        return None

def parse_email_body(parts: List[Dict[str, Any]]) -> str:
    """Parses email parts to find and decode the email body (preferring plain text)."""
    body = ""
    if parts:
        for part in parts:
            mime_type = part.get("mimeType", "")
            if mime_type == "text/plain":
                data = part.get("body", {}).get("data")
                if data:
                    return base64.urlsafe_b64decode(data).decode()
            elif mime_type == "text/html":
                # Fallback to HTML if plain text not found first
                data = part.get("body", {}).get("data")
                if data and not body: # Only use HTML if plain text wasn't found
                    body = base64.urlsafe_b64decode(data).decode()
            elif "parts" in part: # Recursive call for nested parts
                nested_body = parse_email_body(part["parts"])
                if nested_body: return nested_body # Return first found body
    return body


class GmailSearchTool(BaseTool):
    name: str = "gmail_search"
    description: str = (
        "Searches Gmail for emails matching a query and returns their raw content details. "
        "Input should be a `search_query` (string, using Gmail search operators, e.g., 'subject:dinner from:friend@example.com') "
        "and an optional `max_results` (integer, defaults to 10). "
        "Returns a list of dictionaries, each containing id, thread_id, subject, sender, date, snippet, and the full body (preferably plain text) of the email."
    )

    def _get_header_value(self, headers: List[Dict[str, str]], name: str) -> Optional[str]:
        for header in headers:
            if header['name'].lower() == name.lower():
                return header['value']
        return None

    def _find_part_by_mimetype(self, parts: List[Dict[str, Any]], mimetype: str) -> Optional[Dict[str, Any]]:
        for part in parts:
            if part.get('mimeType') == mimetype:
                return part
            if 'parts' in part and part.get('parts'): # Check if 'parts' exists and is not empty
                found_part = self._find_part_by_mimetype(part['parts'], mimetype)
                if found_part:
                    return found_part
        return None

    def _get_body(self, message_payload: Dict[str, Any]) -> Optional[str]:
        body_data_str: Optional[str] = None # Renamed to avoid conflict with outer scope
        
        preferred_mimetypes = ['text/plain', 'text/html']
        
        target_part = None
        if 'parts' in message_payload and message_payload.get('parts'):
            for mimetype in preferred_mimetypes:
                target_part = self._find_part_by_mimetype(message_payload['parts'], mimetype)
                if target_part and 'body' in target_part and 'data' in target_part['body']:
                    break # Found a suitable part with data
        elif 'body' in message_payload and 'data' in message_payload['body']: 
            # Single part message
            if message_payload.get('mimeType') in preferred_mimetypes:
                 target_part = message_payload
        
        if target_part and 'body' in target_part and 'data' in target_part['body']:
            body_data_val = target_part['body']['data'] # Renamed to avoid conflict
            try:
                body_data_str = base64.urlsafe_b64decode(body_data_val.encode('ASCII')).decode('utf-8', errors='replace')
            except Exception as e:
                print(f"Error decoding email body part: {e}")
                body_data_str = f"Error decoding body: {e}" # Return error message in body
            
        return body_data_str

    def _run(self, search_query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        creds = get_gmail_credentials()
        if not creds:
            return [{"error": "Failed to get Gmail credentials."}]

        try:
            service = build('gmail', 'v1', credentials=creds)
            
            response = service.users().messages().list(
                userId='me', 
                q=search_query, 
                maxResults=max_results
            ).execute()
            
            messages_summary = response.get('messages', [])

            if not messages_summary:
                return [{"info": f"No emails found matching query: '{search_query}'"}]

            email_details_list = []
            for msg_summary in messages_summary:
                msg_id = msg_summary['id']
                try:
                    message = service.users().messages().get(
                        userId='me', 
                        id=msg_id, 
                        format='full' # 'full' gives payload with headers and body
                    ).execute()
                    
                    payload = message.get('payload', {})
                    headers = payload.get('headers', [])
                    
                    subject = self._get_header_value(headers, 'Subject')
                    sender = self._get_header_value(headers, 'From')
                    date_str = self._get_header_value(headers, 'Date')
                    # recipient = self._get_header_value(headers, 'To') # Could be useful
                    
                    body_content = self._get_body(payload)

                    email_details_list.append({
                        'id': msg_id,
                        'thread_id': message.get('threadId'),
                        'subject': subject,
                        'sender': sender,
                        'date': date_str,
                        # 'recipient': recipient,
                        'snippet': message.get('snippet'),
                        'body': body_content
                    })
                except HttpError as e:
                    print(f"HttpError fetching/processing message ID {msg_id}: {e}")
                    email_details_list.append({
                        'id': msg_id,
                        'error': f"API error processing message: {e}"
                    })
                except Exception as e:
                    print(f"Generic error fetching/processing message ID {msg_id}: {e}")
                    email_details_list.append({
                        'id': msg_id,
                        'error': f"Unexpected error processing message: {str(e)}"
                    })
            
            return email_details_list

        except HttpError as error:
            print(f"An API error occurred in GmailSearchTool: {error}")
            return [{"error": f"An API error occurred: {error}"}]
        except Exception as e:
            print(f"An unexpected error occurred in GmailSearchTool: {str(e)}")
            return [{"error": f"An unexpected error occurred: {str(e)}"}]

    async def _arun(self, search_query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        # This is a synchronous implementation wrapped for async calls.
        # For true async, one would use an async HTTP client and Google API async methods if available.
        # For now, to make it runnable in async contexts without full async rewrite:
        # import asyncio
        # return await asyncio.to_thread(self._run, search_query, max_results)
        # However, langchain BaseTool might handle this. Let's keep it simple.
        raise NotImplementedError("GmailSearchTool does not support async yet. Use the sync version.")

# Example usage (for testing purposes, not part of the tool's direct execution by agent)
if __name__ == '__main__':
    print("Attempting to use GmailSearchTool...")
    # Create a dummy tool instance for local testing
    gmail_tool = GmailSearchTool()
    
    # --- IMPORTANT ---
    # To test this locally:
    # 1. Make sure you have 'config/client_secret.json' in your project root,
    #    configured in Google Cloud Console with Gmail API enabled.
    # 2. Run this script once. It will open a browser for you to authorize.
    #    'config/gmail_token.json' will be created.
    # 3. Then, you can call the tool's _run method.
    # 4. Replace 'XYZ' with a real partial ID from an Interac email in your test Gmail account.
    
    # First, ensure credentials exist or can be created
    test_creds = get_gmail_credentials()
    if test_creds:
        print("Gmail credentials obtained successfully for testing.")
        
        # Example: Search for emails with a specific transfer ID suffix
        # Replace '123' with a suffix you expect to find in your emails.
        # And potentially a sender_hint if you want to narrow it down.
        # transfer_id_suffix_to_test = "F3K" # Replace with a real suffix
        # sender_email_hint = "notify@payments.interac.ca" # Common Interac sender
        
        # results = gmail_tool._run(transfer_id_suffix=transfer_id_suffix_to_test, sender_hint=sender_email_hint)
        # if results:
        #     print("\\nFound Emails:")
        #     for email_info in results:
        #         if "error" in email_info:
        #             print(f"  Error: {email_info['error']}")
        #         else:
        #             print(f"  Sender: {email_info['sender']}")
        #             print(f"  Date: {email_info['date']}")
        #             print(f"  Subject: {email_info['subject']}")
        #             print(f"  Extracted ID: {email_info['extracted_id']}")
        #             print(f"  Snippet: {email_info['snippet']}")
        #             print(f"  Body Preview: {email_info['body_preview'][:200]}...")
        #             print("-" * 20)
        # else:
        #     print("\\nNo emails found matching the criteria.")
        print("\\nGmailTool test complete. Uncomment specific _run calls to test further.")
        print("Remember to have config/client_secret.json and authorize when prompted.")
    else:
        print("Failed to obtain Gmail credentials. Cannot run test.") 