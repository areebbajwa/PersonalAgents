import asyncio
import os
import json # Keep for potential parsing if needed
from typing import Optional # Added import
from langchain.tools import BaseTool
from tools.interac_scraper import fetch_interac_transfers
from browser_use import ActionResult # For type hinting if checking result type

class BankEtransferTool(BaseTool):
    name: str = "get_recent_etransfers"
    description: str = "Fetches recently received Interac e-transfers. Expected to return a dictionary mapping names to amounts paid, e.g., {'NAME LASTNAME': 50.00}."

    def _run(self, *args, **kwargs) -> dict:
        # Langchain tools are often called synchronously, so we run the async function here.
        # This is a common pattern for integrating async logic into sync Langchain tools.
        return asyncio.run(self._arun(*args, **kwargs))

    async def _arun(self, month: Optional[str] = None) -> dict: # month might be passed from graph_halaqa
        print(f"BankEtransferTool invoked for month: {month if month else 'all recent'}")
        try:
            # The fetch_interac_transfers function as refactored doesn't take a month argument.
            # The prompt inside interac_scraper.py is responsible for what it fetches.
            # If month-specific fetching is strictly needed here, interac_scraper.py would need modification.
            action_result = await fetch_interac_transfers()

            # --- Updated Extraction Logic --- 
            extracted_data = None
            if action_result: 
                # Check if it's an AgentHistoryList with results
                if hasattr(action_result, 'all_results') and action_result.all_results:
                    # Get the last action's result, assuming it contains the final extraction
                    last_action = action_result.all_results[-1]
                    if hasattr(last_action, 'extracted_content') and last_action.extracted_content:
                        extracted_data = last_action.extracted_content
                        print(f"BankEtransferTool: Extracted content from last action: {type(extracted_data)}")
                    elif hasattr(last_action, 'success') and last_action.success == False and hasattr(last_action, 'error'):
                        print(f"BankEtransferTool: Last action failed: {last_action.error}")
                    else:
                         print(f"BankEtransferTool: Last action did not contain extracted content or indicate success/failure clearly.")
                # Fallback: Maybe action_result itself has extracted_content directly?
                elif hasattr(action_result, 'extracted_content') and action_result.extracted_content:
                     extracted_data = action_result.extracted_content
                     print(f"BankEtransferTool: Extracted content directly from result: {type(extracted_data)}")
                else:
                    print("BankEtransferTool: Received action_result, but couldn't find extracted content in expected attributes.")
            # --- End Updated Extraction Logic ---
            
            if extracted_data:
                print(f"BankEtransferTool: Processing extracted data: {extracted_data}") 
                data = extracted_data # Use the correctly extracted data

                # Keep the existing parsing logic for str, list, dict
                if isinstance(data, str):
                    # The final 'done' action often returns a descriptive string, not JSON.
                    # We need the JSON extraction from the *previous* step.
                    # Let's adjust to look for the JSON extraction step before the final 'done'
                    json_data = None
                    if hasattr(action_result, 'all_results') and len(action_result.all_results) > 1:
                        for res in reversed(action_result.all_results):
                            if hasattr(res, 'extracted_content') and isinstance(res.extracted_content, str):
                                try:
                                    # Check if it looks like the JSON structure we expect
                                    potential_json = json.loads(res.extracted_content.strip("```json\n").strip("\n```"))
                                    if isinstance(potential_json, dict) and 'transactions' in potential_json:
                                        json_data = potential_json['transactions'] # Extract the list
                                        print("BankEtransferTool: Found JSON transaction list in previous steps.")
                                        break # Stop looking once found
                                except (json.JSONDecodeError, TypeError):
                                    continue # Not the JSON we're looking for
                    
                    if json_data:
                        data = json_data # Process the found JSON list instead of the final string
                    else:
                        print(f"BankEtransferTool: Final extracted content was a string, but couldn't find structured JSON in history. String was: {data}")
                        return {}

                elif isinstance(data, list): # Assuming it's a list of transactions
                    processed_data = {}
                    # Example transformation: (This is a guess, actual structure from scraper is needed)
                    # For each transaction in the list:
                    #   name = extract_name_from_transaction(transaction)
                    #   amount = extract_amount_from_transaction(transaction)
                    #   processed_data[name.upper()] = processed_data.get(name.upper(), 0.0) + amount
                    # This part needs to be robust based on actual scraper output.
                    # For now, returning raw list if it's a list and not a dict, to see its structure.
                    # Or, if the agent directly extracts into the target format, this is simpler.
                    print("BankEtransferTool: Extracted content is a list. Needs transformation logic.")
                    # Placeholder until we know the exact format from the agent.
                    # The agent's prompt asks for "a list of dictionaries".
                    # Let's assume the agent is smart enough to aggregate by sender and provide the sum.
                    # If the agent returns: [{'sender': 'JOHN DOE', 'amount': 50.0}, {'sender': 'JANE SMITH', 'amount': 75.50}]
                    # Then we would transform it.
                    # If the agent can return {'JOHN DOE': 50.0, 'JANE SMITH': 75.50} directly, that's ideal.
                    # The prompt currently says "a list of dictionaries" so we expect that list.
                    # The graph_halaqa.py expects {name: float amount_paid_this_month}
                    
                    # SIMULATING A TRANSFORMATION IF THE AGENT RETURNS A LIST OF DICTS
                    # [{'date': '...', 'description': '...', 'amount': 25.0, 'sender': 'FARIS FAZEL REHMAN'}]
                    aggregated_payments = {}
                    for transaction in data:
                        if isinstance(transaction, dict) and 'sender' in transaction and 'amount' in transaction:
                            sender_name = str(transaction['sender']).upper() # Ensure consistent casing
                            try:
                                amount = float(transaction['amount'])
                                aggregated_payments[sender_name] = aggregated_payments.get(sender_name, 0.0) + amount
                            except ValueError:
                                print(f"BankEtransferTool: Could not parse amount for sender {sender_name}: {transaction['amount']}")
                        else:
                            print(f"BankEtransferTool: Skipping transaction due to missing fields or wrong type: {transaction}")
                    print(f"BankEtransferTool: Aggregated payments: {aggregated_payments}")
                    return aggregated_payments
                    
                elif isinstance(data, dict):
                    # If it's already a dictionary, assume it's in the correct format or close to it.
                    # Convert keys to uppercase for consistency, as in sheets_tool.py and graph_halaqa.py
                    processed_data = {str(k).upper(): float(v) for k, v in data.items() if isinstance(v, (int, float))}
                    print(f"BankEtransferTool: Processed dictionary data: {processed_data}")
                    return processed_data
                else:
                    print(f"BankEtransferTool: Extracted content is not a recognized type (str, list, dict): {type(data)}")
                    return {}

            else:
                print("BankEtransferTool: No content extracted by interac_scraper.")
                return {}
        except Exception as e:
            print(f"BankEtransferTool: Error running interac_scraper: {e}")
            # Consider re-raising or returning a specific error indicator
            raise # Re-raise by default 