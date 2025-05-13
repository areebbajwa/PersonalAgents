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
    ("system", "You are a helpful and autonomous assistant. You have access to the following tools. Use them when appropriate to answer the user's request."),
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
)

def run_agent_task(task: str):
    """Helper function to run a task through the agent executor."""
    print(f"\n--- Running task: {task} ---")
    try:
        # For tools that might be async (like BrowserAutomatorTool's _arun)
        # AgentExecutor should ideally handle this. If it runs in a sync way,
        # and the tool needs an event loop, issues might arise.
        # The BrowserAutomatorTool has a _run method that attempts to handle this.
        response = agent_executor.invoke({"input": task})
        print("\n--- Task Response ---")
        print(f"Output: {response.get('output')}")
        # print(f"Chat History: {response.get('chat_history')}") # If you want to see memory
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