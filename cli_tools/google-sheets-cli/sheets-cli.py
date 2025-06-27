#!/usr/bin/env python3

import argparse
import json
import sys
import os
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from tabulate import tabulate

# Use symlink from home directory for portability
MAIN_REPO_PATH = os.path.join(os.path.expanduser('~'), 'PersonalAgents')
SERVICE_ACCOUNT_FILE = os.path.join(MAIN_REPO_PATH, 'config', 'firebase-service-account.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_service():
    """Create and return Google Sheets service using service account."""
    try:
        if not os.path.exists(SERVICE_ACCOUNT_FILE):
            print(f"Error: Service account file not found at {SERVICE_ACCOUNT_FILE}")
            print("Please ensure ~/PersonalAgents symlink points to your PersonalAgents repository")
            sys.exit(1)
            
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        print(f"Error creating service: {e}")
        sys.exit(1)

def extract_spreadsheet_id(input_str):
    """Extract spreadsheet ID from URL or return as-is if already an ID."""
    if '/' not in input_str:
        return input_str
    
    # Try to extract from URL
    if '/d/' in input_str:
        parts = input_str.split('/d/')
        if len(parts) > 1:
            id_part = parts[1].split('/')[0]
            return id_part
    return input_str

def read_sheet(spreadsheet_id, range_name, filter_column=None, filter_value=None, output_json=False):
    """Read data from Google Sheet."""
    service = get_service()
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id, range=range_name).execute()
        values = result.get('values', [])
        
        if not values:
            print('No data found.')
            return
        
        # Process as table with headers
        headers = values[0]
        rows = []
        
        for row in values[1:]:
            row_dict = {}
            for i, header in enumerate(headers):
                row_dict[header] = row[i] if i < len(row) else ''
            rows.append(row_dict)
        
        # Apply filter if specified
        if filter_column and filter_value:
            filtered_rows = []
            for row in rows:
                if filter_column in row:
                    if filter_value.lower() in str(row[filter_column]).lower():
                        filtered_rows.append(row)
            rows = filtered_rows
        
        # Output results
        if output_json:
            print(json.dumps(rows, indent=2))
        else:
            # Convert back to list format for tabulate
            table_data = []
            for row in rows:
                table_data.append([row.get(h, '') for h in headers])
            
            print(tabulate(table_data, headers=headers, tablefmt='grid'))
            print(f"\nTotal rows: {len(rows)}")
            
    except HttpError as error:
        print(f'An error occurred: {error}')

def append_data(spreadsheet_id, range_name, values):
    """Append data to Google Sheet."""
    service = get_service()
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    
    try:
        body = {'values': values}
        result = service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
        
        print(f"Successfully appended {result.get('updates', {}).get('updatedRows', 0)} rows")
        print(f"Updated range: {result.get('updates', {}).get('updatedRange', 'N/A')}")
        
    except HttpError as error:
        print(f'An error occurred: {error}')

def update_data(spreadsheet_id, range_name, values):
    """Update data in Google Sheet."""
    service = get_service()
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    
    try:
        body = {'values': values}
        result = service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
        print(f"Successfully updated {result.get('updatedCells', 0)} cells")
        
    except HttpError as error:
        print(f'An error occurred: {error}')

def clear_range(spreadsheet_id, range_name):
    """Clear data in specified range."""
    service = get_service()
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    
    try:
        service.spreadsheets().values().clear(
            spreadsheetId=sheet_id,
            range=range_name
        ).execute()
        
        print(f"Successfully cleared range: {range_name}")
        
    except HttpError as error:
        print(f'An error occurred: {error}')

def list_sheets(spreadsheet_id):
    """List all sheets in a spreadsheet."""
    service = get_service()
    sheet_id = extract_spreadsheet_id(spreadsheet_id)
    
    try:
        spreadsheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        
        print("Sheets in this spreadsheet:")
        for i, sheet in enumerate(sheets):
            props = sheet.get('properties', {})
            print(f"{i+1}. {props.get('title', 'Untitled')} (ID: {props.get('sheetId', 'N/A')})")
            
    except HttpError as error:
        print(f'An error occurred: {error}')


def main():
    parser = argparse.ArgumentParser(description='Google Sheets CLI Tool')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Read command
    read_parser = subparsers.add_parser('read', help='Read data from sheet')
    read_parser.add_argument('spreadsheet_id', help='Spreadsheet ID or URL')
    read_parser.add_argument('range', help='Range to read (e.g., Sheet1!A1:C10)')
    read_parser.add_argument('--filter-column', help='Column to filter by')
    read_parser.add_argument('--filter-value', help='Value to filter for')
    read_parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    # Append command
    append_parser = subparsers.add_parser('append', help='Append data to sheet')
    append_parser.add_argument('spreadsheet_id', help='Spreadsheet ID or URL')
    append_parser.add_argument('range', help='Range to append to')
    append_parser.add_argument('--values', help='JSON array of arrays')
    append_parser.add_argument('--json-file', help='JSON file with array of arrays')
    append_parser.add_argument('--file', help='CSV file to append')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update data in sheet')
    update_parser.add_argument('spreadsheet_id', help='Spreadsheet ID or URL')
    update_parser.add_argument('range', help='Range to update')
    update_parser.add_argument('--values', help='JSON array of arrays')
    
    # Clear command
    clear_parser = subparsers.add_parser('clear', help='Clear data in range')
    clear_parser.add_argument('spreadsheet_id', help='Spreadsheet ID or URL')
    clear_parser.add_argument('range', help='Range to clear')
    
    # List sheets command
    list_parser = subparsers.add_parser('list-sheets', help='List all sheets')
    list_parser.add_argument('spreadsheet_id', help='Spreadsheet ID or URL')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'read':
        read_sheet(args.spreadsheet_id, args.range, 
                  args.filter_column, args.filter_value, args.json)
    
    elif args.command == 'append':
        if args.values:
            values = json.loads(args.values)
        elif args.json_file:
            # Read JSON file
            with open(args.json_file, 'r') as f:
                values = json.load(f)
        elif args.file:
            # Read CSV file
            with open(args.file, 'r') as f:
                import csv
                values = list(csv.reader(f))
        else:
            print("Error: Provide either --values, --json-file, or --file")
            return
        append_data(args.spreadsheet_id, args.range, values)
    
    elif args.command == 'update':
        if not args.values:
            print("Error: --values required")
            return
        values = json.loads(args.values)
        update_data(args.spreadsheet_id, args.range, values)
    
    elif args.command == 'clear':
        clear_range(args.spreadsheet_id, args.range)
    
    elif args.command == 'list-sheets':
        list_sheets(args.spreadsheet_id)

if __name__ == '__main__':
    main()