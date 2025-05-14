import os
import asyncio # For running async tools if needed

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Import our custom tools
from tools import (
    GmailSearchTool,
    GenericSheetsReaderTool,
    GenericSheetsWriterTool,
    BrowserAutomatorTool,
    GetCurrentDateTool
)

# Load environment variables (especially OPENAI_API_KEY)
print("AGENT.PY: Attempting to load .env file...")
loaded_successfully = load_dotenv()
print(f"AGENT.PY: load_dotenv() returned: {loaded_successfully}")
openai_api_key = os.getenv("OPENAI_API_KEY")

if not openai_api_key:
    print("AGENT.PY: ERROR - OPENAI_API_KEY not found in environment variables.")
    # Potentially exit or raise an error if key is critical for basic operation
    # For now, let it proceed, ChatOpenAI will raise error if key not found and not passed directly
else:
    print("AGENT.PY: OPENAI_API_KEY loaded.")

# 1. Initialize LLM
# Sticking with gpt-4o as per guidance
llm = ChatOpenAI(model="gpt-4o", temperature=0, openai_api_key=openai_api_key) 

# 2. Define the list of tools
tools = [
    GmailSearchTool(),
    GenericSheetsReaderTool(),
    GenericSheetsWriterTool(),
    BrowserAutomatorTool(),
    GetCurrentDateTool(),
]

# 3. Create the prompt
# Using a more structured prompt template to include memory and system message
# Based on common patterns for OpenAI Functions Agent
prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a helpful autonomous assistant. "
     "You have the following tools and MUST use them to satisfy each explicit step "
     "in the user request. "
     "**Do NOT stop or say you are finished until EVERY numbered step has been "
     "completed for EVERY item in any list you create. "
     "After the final step, output one short summary paragraph and nothing else."),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# 4. Create the agent
# This agent is designed to work with OpenAI function calling.
agent = create_openai_functions_agent(llm, tools, prompt)

# 5. Create the AgentExecutor
# This will manage the agent's interactions, tool usage, and memory.
agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools,
    memory=ConversationBufferMemory(memory_key="chat_history", return_messages=True), # Ensure memory_key matches placeholder
    verbose=True,                     # For detailed logging of agent steps
    handle_parsing_errors=True,       # Helps in debugging parsing issues with LLM responses
    max_iterations=50,                # Limit the number of steps to prevent infinite loops
    early_stopping_method="generate",   # Added
    return_intermediate_steps=True      # Added
)

def run_agent_task(task: str):
    """Helper function to run a task through the agent executor."""
    print(f"\n--- Running task: {task} ---")
    try:
        # For tools that might be async (like BrowserAutomatorTool's _arun)
        # AgentExecutor should ideally handle this. If it runs in a sync way,
        # and the tool needs an event loop, issues might arise.
        # The BrowserAutomatorTool has a _run method that attempts to handle this.
        result = agent_executor.invoke({"input": task}) # Changed from response to result
        print("\n--- Task Response ---")
        
        # Check for premature AgentFinish
        if result.get("intermediate_steps") and isinstance(result["intermediate_steps"], list) and len(result["intermediate_steps"]) > 0:
            last_step_action = result["intermediate_steps"][-1][0]
            if hasattr(last_step_action, 'log') and "AgentFinish" in last_step_action.log:
                 print("⚠️ Agent tried to finish early.")
                 # print(f"Intermediate steps: {result['intermediate_steps']}") # For debugging
        
        print(f"Output: {result.get('output')}")
        # print(f"Chat History: {result.get('chat_history')}") # If you want to see memory
    except Exception as e:
        print(f"Error running agent task: {e}")
        import traceback
        traceback.print_exc()
    print("--- Task End ---")

if __name__ == "__main__":
    print("\nAgent Executor Initialized.")
    print(f"Loaded Tools: {[tool.name for tool in tools]}")

    # --- Test Scenarios ---
    # Ensure your .env file has OPENAI_API_KEY and client_secret.json/token.json are set up for sheets/gmail.
    # Ensure Playwright browsers are installed if using BrowserAutomatorTool: python -m playwright install

    # Test 1: Simple Gmail Search (Requires Gmail API setup and token)
    # task1 = "What is the subject of the most recent email in my inbox? Fetch only 1 email."
    # run_agent_task(task1)

    # Test 2: Simple Sheet Read (Requires Sheets API setup and token, and a valid sheet ID)
    # halaqa_sheet_id = "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4"
    # task2 = f"Read the first 2 rows of data (including headers) from the 'Commitments' tab in Google Sheet ID {halaqa_sheet_id}. The range is Commitments!A:C."
    # run_agent_task(task2)

    # Test 3: Simple Sheet Write (Requires Sheets API setup and token)
    # test_sheet_id = "YOUR_TEST_SHEET_ID_HERE" # Replace with a sheet ID you can write to
    # task3 = f"Write the following data to Google Sheet ID {test_sheet_id} starting at cell 'Sheet1!A10': [['Test Name', 'Test Value1'], ['Another Row', 'Test Value2']]"
    # if test_sheet_id == "YOUR_TEST_SHEET_ID_HERE":
    #     print("\nSkipping Test 3: Please replace YOUR_TEST_SHEET_ID_HERE with a valid sheet ID.")
    # else:
    # run_agent_task(task3)

    # Test 4: Browser Automation (Requires Playwright browsers: python -m playwright install)
    # task4 = "Open the website https://example.com and tell me its main heading."
    # run_agent_task(task4)
    
    # Test 5: The original complex task (will require multiple steps and careful execution)
    # bank_transactions_sheet_url = "https://docs.google.com/spreadsheets/d/1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE/edit" # TD Canada Trust Data example
    # accounting_sheet_id = "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4"
    # task5 = (
    #    f"1. Read transactions from the Google Sheet located at {bank_transactions_sheet_url} (assume it's publicly viewable or use browser tool if direct read fails, focus on a few recent transactions for now, columns like Date, Description, Amount). "
    #    f"2. For each transaction that looks like an Interac e-Transfer, extract any partial transfer ID from the description. "
    #    f"3. Search my Gmail (areebb@gmail.com) for Interac transfer notification emails matching these partial IDs. Look for sender name, full ID, and amount. "
    #    f"4. Read existing transfers from the 'Transfers' sheet in Google Sheet ID {accounting_sheet_id} to avoid duplicates. "
    #    f"5. For new, matched transfers, add them to this 'Transfers' sheet with columns: Date, Sender Name, Amount, Type (e.g., 'Interac'), Status (e.g., 'Matched')."
    # )
    # print("\nSkipping Test 5 (Main Task) for now. Uncomment and ensure all setups are correct to run.")
    # run_agent_task(task5)

    print("\nAGENT.PY: Running refined bank reconciliation test task V2 (improved matching logic)...")
    bank_transactions_sheet_id = "1xhSXVcMg4rhrC-PzxcebSdbfbzq7HOns7zuRO3AJcDE"
    target_sheet_name = "Transactions"
    gmail_user = "areebb@gmail.com"
    
    refined_task_for_interac_v2 = (
        f"Your primary goal is to find Interac e-Transfers from a Google Sheet, match them to emails, and report details. Follow all steps meticulously.\n"
        f"1. Access the Google Spreadsheet with ID '{bank_transactions_sheet_id}'. Read up to 200 rows from the sheet named '{target_sheet_name}' (e.g., range '{target_sheet_name}!A1:Z200'). "
        f"   When reading, use the sheet tool's filtering capability: set filter_column='Description', filter_value='E-TRANSFER', and filter_type='contains'. This will give you only RECEIVED Interac e-Transfer transactions from those 200 rows (Note: 'E-TRANSFER' is for received, 'E-TFR' is for sent). Identify columns for Date, Description, and Amount from this result. If no transactions are found, state this and stop.\n"
        f"2. After obtaining this list of 'E-TRANSFER' transactions, use the 'get_current_date' tool to find out today's date. Let's call this current_date.\n"
        f"3. From the 'E-TRANSFER' transactions you received in step 1, parse the 'Date' for each. Filter this list further to include only those transactions that occurred within the last 31 days from current_date. If a transaction date cannot be parsed, you may skip it but note this. If no transactions remain after this date filtering, state this and stop.\n"
        f"   **It is crucial that you now proceed to step 4 for EACH transaction remaining in this filtered list.** \n"
        f"4. You MUST NOW PROCESS each of these 'E-TRANSFER' transactions identified in the last 31 days by performing the following sub-steps for each one: \n"
        f"  a. Extract the partial transfer ID, which is typically the last 3 alphanumeric characters at the very end of the 'Description' (e.g., if description is 'E-TRANSFER ***ABC', extract 'ABC'). Note this partial ID. \n"
        f"  b. Construct a Gmail search query. The query should look for emails with a subject line containing 'Interac e-Transfer' AND ('received funds' OR 'money deposited' OR 'sent you money'). "
        f"     Crucially, restrict this Gmail search by date: search for emails received roughly in the last 35-40 days from current_date. For example, if current_date is 2024-01-15, search for emails 'after:2023-12-05 before:2024-01-16'. Use the 'gmail_search' tool with this constructed query. Do NOT limit the number of emails returned by the search, let the tool return all matches within the date range. \n"
        f"  c. For each email found by the Gmail search in step 4b: read its body to find a line similar to 'Reference Number: XXXXXXXXXX'. Extract the full XXXXXXXXXX value. \n"
        f"  d. Check if this full Reference Number from the email *ends with* the partial transfer ID you extracted from the bank transaction description in step 4a. \n"
        f"  e. If a match is found, you MUST report the original bank transaction 'Description', its 'Date', the extracted partial ID, the full email 'Reference Number', the email's 'Subject', 'Sender', and 'Date'. \n"
        f"If, after attempting all steps for all relevant transactions, no matches were found for any of them, then (and only then) state that no complete matches could be made. If earlier steps resulted in no transactions to process (as per step 1 or 3), you would have already stated that."
    )
    run_agent_task(refined_task_for_interac_v2)

    print("\nAGENT.PY: End of script.")

    # --- NEW TASK DEFINITION ---
    commitments_sheet_id = "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4"
    commitments_sheet_gid = "103352420" # For the "Commitments" tab
    transfers_sheet_id = "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4" # Same sheet, different tab
    transfers_sheet_gid = "1110009458"  # For the "Transfers" tab
    gmail_user = "areebb@gmail.com" # Assuming this is still the target Gmail

    refined_task_for_interac_v3 = (
        f"Your goal is to find Interac e-Transfers in Gmail for '{gmail_user}', "
        f"match the sender to a name in the 'Commitments' Google Sheet, and if a match is found, "
        f"add the transaction to a 'Transfers' Google Sheet if it's not already there. "
        f"Follow all steps meticulously for every email found. Do NOT stop until all steps are complete for all items.\\n"
        f"**Overall Process:** Email Search -> Commitments Sheet Match -> Transfers Sheet Deduplication & Write.\\n"
        f"**Commitments Sheet Details:** ID='{commitments_sheet_id}', Tab GID='{commitments_sheet_gid}'. Assume the relevant names are in a clearly identifiable column (e.g., 'Name', 'Full Name', 'Contact').\\n"
        f"**Transfers (Accounting) Sheet Details:** ID='{transfers_sheet_id}', Tab GID='{transfers_sheet_gid}'. Columns to write: 'Date', 'Name', 'Amount', 'Email Subject', 'Email Sender', 'Status'.\\n"

        f"**Step 1: Get Current Date**\\n"
        f"   - Use the 'get_current_date' tool to find out today's date. This will be used to calculate the date range for email searches.\\n"

        f"**Step 2: Search Gmail for Interac e-Transfers**\\n"
        f"   - Construct a Gmail search query for Interac e-Transfers. Common subjects include 'Interac e-Transfer' combined with phrases like 'deposited your money', 'sent you money', or 'received funds'.\\n"
        f"   - Search for emails received in the last 35-40 days (calculate this range based on the current_date from Step 1). Example Gmail query part for dates: 'after:YYYY/MM/DD before:YYYY/MM/DD'.\\n"
        f"   - For each email found, carefully parse its content (body and headers) to extract: (a) Sender's Name (do your best to extract a clean name), (b) Full Email Subject, (c) Date Sent, (d) Transfer Amount.\\n"
        f"   - If no relevant emails are found, state this and stop.\\n"

        f"**Step 3: Match Email Sender with 'Commitments' Sheet**\\n"
        f"   - For EACH email processed in Step 2:\\n"
        f"     a. Take the extracted Sender's Name.\\n"
        f"     b. Read the list of names from the 'Commitments' Google Sheet (ID '{commitments_sheet_id}', range should target the sheet with gid '{commitments_sheet_gid}' and include the name column, e.g., '{commitments_sheet_gid}!A1:A1000' if names are in column A. Be flexible with the range if needed to get all names).\\n"
        f"     c. Perform a *lenient comparison* between the email Sender's Name and each name in the 'Commitments' list. A lenient match means they are very similar, even if not identical (e.g., 'John Doe' vs 'Doe, John' or 'J. Doe').\\n"
        f"     d. If a lenient match is found, store the *EXACT name as it appears in the 'Commitments' sheet*, along with the email's Date, Amount, Subject, and original Sender Name.\\n"
        f"     e. If no lenient match is found for an email sender, note this and move to the next email.\\n"

        f"**Step 4: Add Matched Transfers to 'Transfers' Sheet (Deduplicate First)**\\n"
        f"   - For EACH transfer that was successfully matched in Step 3:\\n"
        f"     a. Take the email's Date, the *exact 'Commitments' Name*, and the Amount.\\n"
        f"     b. Read the existing entries in the 'Transfers' Google Sheet (ID '{transfers_sheet_id}', range should target sheet with gid '{transfers_sheet_gid}', e.g., '{transfers_sheet_gid}!A:F').\\n"
        f"     c. Check if an identical record (based on Date, Exact 'Commitments' Name, and Amount) already exists in the 'Transfers' sheet.\\n"
        f"     d. If no duplicate is found, use the 'google_sheets_generic_writer' tool to append a NEW ROW to the 'Transfers' sheet with the following columns and values: \\n"
        f"        - 'Date': (from email)\\n"
        f"        - 'Name': (the *exact name from the 'Commitments' sheet*)\\n"
        f"        - 'Amount': (from email)\\n"
        f"        - 'Email Subject': (full subject from email)\\n"
        f"        - 'Email Sender': (original sender name/address from email)\\n"
        f"        - 'Status': 'Matched from Gmail'\\n"
        f"     e. If a duplicate IS found, note this and do not add the row.\\n"

        f"**Step 5: Final Summary**\\n"
        f"   - After processing all emails and attempting all matches and writes, provide a brief summary of actions taken (e.g., 'Searched X emails, found Y matches in Commitments, wrote Z new transfers to the Transfers sheet. N duplicates found. M emails had no match in Commitments.')."
    )

    run_agent_task(refined_task_for_interac_v3)

    print("\nAGENT.PY: End of script.") 