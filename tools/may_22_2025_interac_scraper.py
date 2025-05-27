import asyncio
import os
import re
import time
import json
import logging
from typing import Optional, List, Dict, Any

from langchain_openai import ChatOpenAI
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load environment variables from config/.env
load_dotenv(dotenv_path="config/.env")

# Local project imports
from browser_use import Controller, ActionResult # Assuming browser_use is installed locally or accessible
from tools.browser_automator import BrowserAutomator
from tools.custom_actions import get_2fa_code

# It's good practice to load sensitive info from env vars or a config file
# For this example, we'll define them directly for simplicity,
# but in a real application, use environment variables.
EMAIL = os.environ.get("INTERAC_EMAIL")

# It's good practice to load sensitive info from env vars or a config file
# For now, using the hardcoded key as in the original example for direct transition.
# Consider moving this to a secure configuration management system.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") # Removed hardcoded default
TD_USERNAME = os.getenv("TD_USERNAME", "4724090919663060") # Example, should be configured securely
TD_PASSWORD = os.getenv("TD_PASSWORD", "123mxypkwj")     # Example, should be configured securely

# Added List, Dict, Any for completeness
TASK_DESCRIPTION = f"""
SYSTEM:
You are a web-automation agent. Your goal is to log into TD EasyWeb, navigate to Interac e-Transfer history, extract received transfers, and handle 2FA using a custom tool.
TD Username: {TD_USERNAME}
TD Password: {TD_PASSWORD}

You have one callable tool:
`get_2fa_code` (no args) -> returns a six-digit string.

When you need the 2FA code, output *exactly* this JSON (no Markdown):
```json
{{"get_2fa_code": {{}}}}
```

USER GOAL:
1.  Go to https://easyweb.td.com/
1.5. **Handle Cookie Banner:** If a cookie consent banner appears, click the 'Accept All' or similar button to dismiss it.
2.  Log in using the provided TD Username and Password.
    - The username field is usually `input#username` or similar.
    - The password field is usually `input#password` or similar.
    - Click the login button.
3.  Handle Two-Factor Authentication (2FA):
    - The site will ask for a security code.
    - Click the "Text me" or similar button to receive the code if options are presented.
    - Once at the screen prompting for the code, call the `get_2fa_code` tool using the specified JSON format.
    - Enter the retrieved code into the appropriate field (e.g., `input#code`).
    - Click "Verify" or "Next".
4.  Navigate to Interac e-Transfer History:
    - Once logged in, find and click a link or button for "Interac e-Transfer" in the left sidebar.
    - On the Interac e-Transfer page, look for "History"
5.  Filter for Received Transfers:
    - On the history page, there should be a way to filter or view "Money Received" or "Received Transfers". Click this.
6.  Extract Data and Handle "Show More":
    - Extract all visible transaction details (date, description, amount, sender/receiver).
    - Scroll down the page to ensure the "Show More" button is visible. If a "Show More" button is found and visible, click it.
    - Wait for new transactions to appear on the page after scrolling or clicking "Show More" before attempting to extract data again or clicking "Show More" again.
    - Repeat scrolling, checking for "Show More", clicking it if visible, waiting, and extracting, until the "Show More" button is no longer visible or no new transactions appear after a click.
7.  Output:
    - Once all transactions are collected, provide them in a structured format (e.g., a list of dictionaries).
Constraints: Stay in the same tab, do not open new tabs unless absolutely necessary for a pop-up. Call the `get_2fa_code` tool exactly once when prompted for the code.
"""

# Added List, Dict, Any for completeness
async def fetch_interac_transfers() -> Optional[ActionResult]:
    """Runs the Interac e-Transfer scraping task."""
    print("--- Starting TD EasyWeb Interac scraping task ---")

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        openai_api_key=OPENAI_API_KEY
    )

    # Setup controller and register the 2FA action
    controller = Controller()
    # print(f"DEBUG: Type of controller: {type(controller)}") # Removed debug
    # print(f"DEBUG: dir(controller): {dir(controller)}") # Removed debug
    # Define the action first
    # async def get_2fa_code() -> ActionResult: ... (already defined in tools.custom_actions)
    # Explicitly register the imported function using the registry
    try:
        # Try registering via the registry attribute
        controller.registry.action("get_2fa_code", get_2fa_code) 
    except AttributeError as e:
        print(f"ERROR: Failed to register custom action 'get_2fa_code' via registry: {e}")
        raise e # Re-raise the error to see the original traceback

    automator = BrowserAutomator(
        llm=llm,
        task_description=TASK_DESCRIPTION,
        controller=controller, # Pass the controller again
        enable_memory=False # As per original scraper
    )

    try:
        result = await automator.run_automation()
        print("TD EasyWeb Interac scraping task finished successfully.")
        return result
    except Exception as e:
        print(f"An error occurred during the Interac scraping task: {e}")
        return None # Or re-raise if the caller should handle it

if __name__ == '__main__':
    # This allows testing the interac_scraper independently
    async def run_test_interac_scraper():
        print("Running Interac Scraper test...")
        # OPENAI_API_KEY is already loaded from config/.env at module level
        if not OPENAI_API_KEY or "sk-proj-" not in OPENAI_API_KEY:
            print("Warning: OPENAI_API_KEY might not be configured correctly for standalone test.")

        result = await fetch_interac_transfers()
        if result and result.extracted_content:
            print(f"Interac Scraper Test: Extracted content: {result.extracted_content}")
        else:
            print("Interac Scraper Test: No content extracted or an error occurred.")

    asyncio.run(run_test_interac_scraper()) 