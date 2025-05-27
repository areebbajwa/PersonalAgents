import asyncio
import os
import json # Keep for potential parsing if needed
from typing import Optional, List, Dict, Any # Added List, Dict, Any
from langchain.tools import BaseTool
from tools.interac_scraper import fetch_interac_transfers # Uncommented
from browser_use import ActionResult # For type hinting if checking result type
from datetime import datetime # For date parsing, though scraper might provide formatted dates

class BankEtransferTool(BaseTool):
    name: str = "get_recent_etransfers"
    description: str = "Fetches recently received Interac e-transfers from the bank. Expected to return a list of transfer dictionaries."

    def _run(self, *args, **kwargs) -> List[Dict[str, Any]]:
        # Langchain tools are often called synchronously, so we run the async function here.
        return asyncio.run(self._arun(*args, **kwargs))

    async def _arun(self, month: Optional[str] = None) -> List[Dict[str, Any]]:
        print(f"BankEtransferTool invoked for month: {month if month else 'all recent'} - USING LIVE INTERAC SCRAPER")
        
        # Original code calling the scraper:
        try:
            action_result = await fetch_interac_transfers()
            extracted_data = None
            if action_result: 
                if hasattr(action_result, 'all_results') and action_result.all_results:
                    last_action = action_result.all_results[-1]
                    if hasattr(last_action, 'extracted_content') and last_action.extracted_content:
                        extracted_data = last_action.extracted_content
                    elif hasattr(last_action, 'success') and last_action.success == False and hasattr(last_action, 'error'):
                        print(f"BankEtransferTool: Last action failed: {last_action.error}")
                elif hasattr(action_result, 'extracted_content') and action_result.extracted_content:
                     extracted_data = action_result.extracted_content
            
            if extracted_data:
                # The halaqa_agent expects a list of transfer dictionaries.
                # The interac_scraper.py is prompted to return a list of dictionaries.
                # We need to ensure that `extracted_data` is that list.
                if isinstance(extracted_data, list):
                    # Validate structure of items in list if necessary
                    # For now, assume it's the correct list of dicts.
                    print(f"BankEtransferTool: Returning extracted list of transfers. Count: {len(extracted_data)}")
                    return extracted_data
                elif isinstance(extracted_data, str):
                    # Try to parse if it's a JSON string representing a list
                    try:
                        parsed_list = json.loads(extracted_data)
                        if isinstance(parsed_list, list):
                            print(f"BankEtransferTool: Returning parsed list from JSON string. Count: {len(parsed_list)}")
                            return parsed_list
                        else:
                            print(f"BankEtransferTool: Parsed JSON is not a list: {type(parsed_list)}")
                            return []
                    except json.JSONDecodeError:
                        print(f"BankEtransferTool: Extracted string is not valid JSON: {extracted_data}")
                        return []
                else:
                    print(f"BankEtransferTool: Extracted data is not a list or JSON string of a list. Type: {type(extracted_data)}")
                    return []
            else:
                print("BankEtransferTool: No content extracted by interac_scraper.")
                return []
        except Exception as e:
            print(f"BankEtransferTool: Error running interac_scraper: {e}")
            # Consider if raising the error is better or returning empty list
            return [] # Returning empty list on error to prevent graph crash, can be changed