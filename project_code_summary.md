# Table of Contents
- TODO.md
- README.md
- agent.py
- run_halaqa.py
- main.py
- tools/langchain_browser_tool.py
- tools/gmail_tool.py
- tools/interac_scraper.py
- tools/__init__.py
- tools/custom_actions.py
- tools/get_current_date_tool.py
- tools/bank_tool.py
- tools/sheets_tool.py
- tools/browser_automator.py
- agents/halaqa_agent.py

## File: TODO.md

- Extension: .md
- Language: markdown
- Size: 7212 bytes
- Created: 2025-05-13 18:50:30
- Modified: 2025-05-13 18:50:30

### Code

```markdown
# Personal Agent TODO List  — *annotated*

## Phase 1: Core Agent Framework & Basic Tooling

* [ ] **Define Agent Architecture:**

  * [ ] Choose a core AI model (e.g., Gemini 2.5 Pro via an appropriate library).
    ➜ *Stick with GPT-4o for now; it natively supports OpenAI-style function calls, which LangChain's `create_openai_functions_agent` uses out-of-the-box. You can hot-swap to Gemini later once LangChain exposes Gemini function calling.*
  * [ ] Design the main agent loop: receive task, plan, execute tools, process results, repeat/conclude.
    ➜ *Use `AgentExecutor` (LangChain) with `verbose=True`; it already handles plan → tool → observe cycles.*
  * [ ] Establish how the agent will manage its state, memory, and context.
    ➜ *Plug in `ConversationBufferMemory` for now; upgrade to `ConversationTokenBufferMemory` when token usage balloons.*

* [ ] **Tool Integration Mechanism:**

  * [ ] Develop a system for the agent to discover and utilize available tools (e.g., `GmailSearchTool`, `GenericSheetsReaderTool`, Browser tools).
    ➜ *Create an array `tools = [GmailSearchTool(), GenericSheetsReaderTool(), …]` and feed it to `create_openai_functions_agent`. LangChain converts each `BaseTool`'s name/description/arg schema to a Function-Calling signature.*
  * [ ] Ensure tools provide clear descriptions for the agent to understand their purpose and inputs/outputs.
    ➜ *Add a one-sentence purpose + explicit arg docstring in every `description`.*

* [ ] **Initial Toolset Refinement & Verification:**

  * [x] `GmailSearchTool` — authentication done.
  * [x] `GenericSheetsReaderTool` — Google creds done.
  * [x] `SheetsCommitmentTool` — *likely redundant; let the agent read any range with `GenericSheetsReaderTool` + prompt instructions (range, sheet name).*
  * [x] `TransfersSheetTool` — *rename to `GenericSheetsWriterTool` → accepts `sheet_id`, `range`, `values`.*
  * [x] Browser Interaction Tools (`mcp_browser*`)

    * [x] Basic nav verified.
    * [x] *Give them `description` fields that say **when** to use them (“Use when the input is a full Google-Sheets URL…”).*
      ➜ *Created `BrowserAutomatorTool` in `tools/langchain_browser_tool.py` which wraps `BrowserAutomator` for complex, LLM-driven web tasks. This tool has a detailed description for the LangChain agent.*

* [x] **Basic Natural Language Task Processing:**
    ➜ *Implemented in `agent.py` and `main.py`.*

  * [x] Implement initial capability for the agent to take a high-level natural-language task.
    ➜ *Prompt template: “You are an autonomous assistant. You have these tools: … Here is the user task: {task}.”* (Agent structure with prompt, tools, and executor created in `agent.py`. `main.py` takes task input.)
  * [x] Agent should break down a simple task into a sequence of tool calls.
    ➜ *Handled automatically by the functions agent; set `max_iterations=10` so it can chain multiple calls.* (AgentExecutor in `agent.py` configured for this.)

---

## Phase 2: Bank Reconciliation Test Case

* [ ] **Agent-Led Bank Transaction Sheet Access & Filtering:**
  ➜ *Pass the sheet ID in the initial task prompt. Agent will:
    1. Call `GetCurrentDateTool` to get the current date. (✓ Working)
    2. Call `GenericSheetsReaderTool` with filtering for 'E-TRANSFER' (✓ Working, using 'E-TRANSFER' for received).
    3. Parse transaction dates and filter for those within the last 31 days. (✓ Working)
    4. Identify ALL transactions containing 'E-TRANSFER' (changed from 'E-TFR') in their description from the date-filtered list. (✓ Agent identifies the list)*
  * **ISSUE:** Agent currently stops after successfully identifying and filtering transactions, before proceeding to iterate through them for email searches, despite prompt instructions.
* [ ] **Agent-Led Email Search:**
  ➜ *For EACH identified E-TRANSFER: LLM forms Gmail query (e.g., general Interac subjects, restricted by date, then parse body for Reference Number ending with partial ID from bank sheet); use the `GmailSearchTool`.*
  * **CHALLENGE:** Need to ensure the agent reliably iterates through the list of transactions from the previous step and performs the Gmail search and matching logic for each. This might require more advanced prompt engineering or a change in how the agent processes list-based sub-tasks.
* [ ] **Accounting Sheet Interaction:**
  ➜ *Writer tool appends rows; instruct agent to read existing rows first to dedupe. (This part is still future work for the agent to fully implement in the reconciliation task).*

---

## Phase 3: Enhancements, Error Handling & Generalization

* [ ] **Advanced Reasoning & Planning:**
  ➜ *Move from single-loop agent to **LangGraph** DAG once tasks exceed 40–50 steps.*
* [ ] **Configuration Management:**
  ➜ *Load creds via `python-dotenv`; pass dynamic sheet IDs in the user task.*
* [ ] **Robust Error Handling & Logging:**
  ➜ *Wrap every tool's `_run` in try/except → return `"error": str(e)`, then set `handle_tool_error=True` in the executor so the LLM can decide a fallback.*
* [ ] **User Interaction & Feedback:**
  ➜ *Add a `human_prompt` tool (returns `input()`); agent can choose to request clarification.*
* [ ] **Prompt Engineering:**
  ➜ *Keep all instructions in a single **system** message; iterate after each failed run.*

---

## Phase 4: Testing & Documentation

* [ ] **Comprehensive Testing:**
  ➜ *Write pytest cases that call the `agent_executor.invoke({"input": task})` and assert sheet rows added.*
* [ ] **Documentation:**
  ➜ *`README.md` → quick-start, .env keys, list of available tools with sample JSON.*

---

## Cleanup & Housekeeping

* [X] Delete ad-hoc scripts once coverage exists.
  ➜ *Replace them with pytest fixtures.*
* [ ] Refactor `main.py` into `agent.py` exporting `build_agent()`.

---

### One-shot recipe to bootstrap

```python
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.memory import ConversationBufferMemory
from tools.gmail_tool import GmailSearchTool
from tools.sheets_tool import GenericSheetsReaderTool, GenericSheetsWriterTool # Assuming GenericSheetsWriterTool will be created

llm   = ChatOpenAI(model="gpt-4o", temperature=0, openai_api_key="sk-...") # Ensure OPENAI_API_KEY is loaded from .env
tools = [
    GmailSearchTool(),
    GenericSheetsReaderTool(),
    # GenericSheetsWriterTool(), # Add once created
    # mcp_browser tools already decorated with @controller.action(...) # Need to figure out how to wrap/integrate these
]

# agent_prompt = hub.pull("hwchase17/openai-functions-agent") # Example, may need custom prompt
# agent  = create_openai_functions_agent(llm, tools, agent_prompt)
# agentX = AgentExecutor(agent=agent, tools=tools,
#                        memory=ConversationBufferMemory(),
#                        verbose=True,
#                        handle_parsing_errors=True, # Good for debugging
#                        max_iterations=10)

# result = agentX.invoke({"input": "Reconcile last month's transfers..."})
# print(result["output"])
```

## Notes:
*   Primary AI Model: `gemini-2.5-pro-preview-05-06`
```

## File: README.md

- Extension: .md
- Language: markdown
- Size: 2537 bytes
- Created: 2025-05-13 14:21:20
- Modified: 2025-05-13 14:21:20

### Code

```markdown
# PersonalAgents

A LangGraph-based collection of agents for personal automation tasks.

**Current Agents:**
1. **Halaqa Agent**: Tracks monthly commitments and Interac e-Transfers, updating the "Transfers" worksheet in Google Sheets

## Project Structure

```
PersonalAgents/
├── agents/                # Agent implementations
│   └── halaqa_agent.py    # Halaqa fee and transfers tracking agent
├── tools/                 # Shared tools used by agents
│   ├── bank_tool.py       # Bank account access tools
│   ├── interac_scraper.py # Interac e-Transfer scraper
│   ├── sheets_tool.py     # Google Sheets integration
│   └── whatsapp_tool.py   # WhatsApp messaging (legacy)
├── wa_gateway/            # WhatsApp gateway service (legacy)
├── main.py                # Main entry point for all agents
└── run_halaqa.py          # Standalone runner for Halaqa agent
```

## Quick Start

```bash
# Python setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run the agent
python main.py halaqa
```

## Environment Variables

Create `.env` in the project root:

```
# Google Sheets
SHEET_ID=1abcDEF...      # Google Sheet with commitments/transfers
SHEET_RANGE=Commitments!A:G  # Sheet range for commitment data

# Bank Authentication
OPENAI_API_KEY=sk-...     # OpenAI API key
TD_USERNAME=yourUsername  # TD EasyWeb username
TD_PASSWORD=yourPassword  # TD EasyWeb password
```

You also need a Google API client_secret.json file in the project root for Google Sheets access.

## Google Sheets Setup

The agent requires two worksheets in the Google Sheet specified by SHEET_ID:

1. **Commitments**: Contains information about monthly commitments
   - Columns: Name (A), Commitment Amount (B), Phone (G)
   
2. **Transfers**: Will be created automatically if it doesn't exist
   - Columns: Date, Sender, Amount, Description

The agent will:
1. Check commitments in the Commitments worksheet
2. Fetch Interac e-Transfers from TD Bank
3. Compare commitments with transfers received
4. Update the Transfers worksheet with new transfers

## Deployment

* **Agent cron** → see `.github/workflows/monthly.yml` for a free GitHub Actions scheduler.

## Security Considerations

This project handles sensitive financial information. Make sure to:
- Never commit `.env` files, tokens, or credentials to version control
- Use environment variables for all sensitive information
- Consider using a secure credential manager for production use 
```

## File: agent.py

- Extension: .py
- Language: python
- Size: 10172 bytes
- Created: 2025-05-13 18:48:25
- Modified: 2025-05-13 18:48:25

### Code

```python
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
```

## File: run_halaqa.py

- Extension: .py
- Language: python
- Size: 2787 bytes
- Created: 2025-05-13 14:48:44
- Modified: 2025-05-13 14:48:44

### Code

```python
print("EXECUTION OF RUN_HALAQA.PY HAS BEGUN - ABSOLUTE FIRST LINE")
import sys # Moved sys import here to allow the print above to work

import os, datetime, asyncio, logging
from dotenv import load_dotenv # Restored dotenv

print(f"Python version: {sys.version}")

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables for API keys and bank credentials
print("Loading environment variables...")
load_dotenv()  # loads .env at project root

# Print environment for debugging
print(f"OPENAI_API_KEY: {'Set' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
print(f"TD_USERNAME: {'Set' if os.environ.get('TD_USERNAME') else 'Not set'}")
print(f"TD_PASSWORD: {'Set' if os.environ.get('TD_PASSWORD') else 'Not set'}")

print("Importing HALAQA_GRAPH...")
try:
    # Updated import to point to the agent definition
    from agents.halaqa_agent import HALAQA_GRAPH 
    print("Successfully imported HALAQA_GRAPH")
except Exception as e:
    print(f"Error importing HALAQA_GRAPH: {e}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)

def main():
    """Main function to run the Halaqa agent"""
    print("Entered main() function")
    
    # Print environment variables for debugging (excluding sensitive info)
    logging.debug("Environment variables:")
    logging.debug(f"OPENAI_API_KEY: {'Set' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
    logging.debug(f"TD_USERNAME: {'Set' if os.environ.get('TD_USERNAME') else 'Not set'}")
    logging.debug(f"TD_PASSWORD: {'Set' if os.environ.get('TD_PASSWORD') else 'Not set'}")
    
    today = datetime.date.today()
    # The graph expects month as YYYY-MM, let's ensure we pass that format
    month_str = today.strftime("%Y-%m") 
    print(f"Month string: {month_str}")
    logging.info(f"Invoking Halaqa graph for month: {month_str}")
    
    try:
        # Pass the month string in the input dictionary
        print("About to call HALAQA_GRAPH.invoke()")
        logging.info("Calling HALAQA_GRAPH.invoke()")
        result = HALAQA_GRAPH.invoke({"month": month_str})
        print("HALAQA_GRAPH.invoke() completed")
        logging.info(f"Halaqa graph finished execution.")
        logging.debug(f"Final state: {result}")
    except Exception as e:
        print(f"ERROR in graph execution: {e}")
        logging.error(f"An error occurred during graph execution: {e}")
        import traceback
        traceback_str = traceback.format_exc()
        print(traceback_str)
        logging.error(traceback_str)
        sys.exit(1)

if __name__ == "__main__":
    print("About to call main()")
    main()
    print("main() function completed") 
```

## File: main.py

- Extension: .py
- Language: python
- Size: 2943 bytes
- Created: 2025-05-13 18:44:01
- Modified: 2025-05-13 18:44:01

### Code

```python
#!/usr/bin/env python3
import os
import sys
import argparse
import logging
import traceback
import datetime # Added for timestamp

# No longer load dotenv here, agent.py handles it.
# from dotenv import load_dotenv
# print("MAIN.PY: Attempting to load .env file...")
# loaded_successfully = load_dotenv()
# print(f"MAIN.PY: load_dotenv() returned: {loaded_successfully}")
# print(f"MAIN.PY - AFTER LOAD_DOTENV: OPENAI_API_KEY = {'SET' if os.environ.get('OPENAI_API_KEY') else 'NOT FOUND'}")

def setup_logging(debug_mode: bool = False):
    """Configures logging to both console and a timestamped file."""
    log_level = logging.DEBUG if debug_mode else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Create a timestamped log file name
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"agent_run_{timestamp}.log"
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.FileHandler(log_filename), # Log to file
            logging.StreamHandler(sys.stdout)  # Log to console
        ]
    )
    logging.info(f"MAIN.PY: Logging initialized. Log file: {log_filename}")

# Removed run_halaqa_agent function

def main():
    """Main entry point to run the LangChain agent with a specified task."""
    print("MAIN.PY: Starting PersonalAgents general agent runner...")
    
    parser = argparse.ArgumentParser(description="Run the Personal AI Agent with a specific task.")
    parser.add_argument("task", type=str, help="The natural language task for the agent to perform.")
    parser.add_argument("--debug", action="store_true", help="Enable debug output for logging.")
    
    args = parser.parse_args()
    
    # Setup logging first
    setup_logging(args.debug)
    
    if args.debug:
        # This message will now go to both console and file thanks to setup_logging
        logging.debug("MAIN.PY: Debug mode enabled")
    
    logging.info(f"MAIN.PY: Received task: {args.task}")
    
    try:
        # Import the agent runner from agent.py
        from agent import run_agent_task
        
        # Execute the task
        # Note: If run_agent_task becomes async, main will need to be async too
        # and use asyncio.run(run_agent_task(args.task))
        run_agent_task(args.task)
        
        logging.info("MAIN.PY: Agent finished processing the task.")
        
    except ImportError as ie:
        logging.error(f"MAIN.PY: Failed to import agent components: {ie}")
        logging.error("MAIN.PY: Ensure agent.py is in the correct path and all dependencies are installed.")
        sys.exit(1)
    except Exception as e:
        logging.error(f"MAIN.PY: An error occurred while running the agent task: {e}")
        logging.error(traceback.format_exc())
        sys.exit(1)
    
    logging.info("MAIN.PY: Finished execution.")

if __name__ == "__main__":
    main() 
```

## File: tools/langchain_browser_tool.py

- Extension: .py
- Language: python
- Size: 8435 bytes
- Created: 2025-05-13 18:12:39
- Modified: 2025-05-13 18:12:39

### Code

```python
import asyncio
from typing import Any, Dict, Optional, Type

from langchain.tools import BaseTool
from langchain.pydantic_v1 import BaseModel, Field
from langchain_openai import ChatOpenAI # For the BrowserAutomator

from tools.browser_automator import BrowserAutomator # The class you provided

class BrowserAutomatorInput(BaseModel):
    task_description: str = Field(description="A detailed natural language description of the web automation task to perform, including the objectives and any specific steps or data to look for. If the task involves a specific starting URL, include it clearly in the description.")
    # start_url: Optional[str] = Field(None, description="Optional: The URL to start the automation from. If not provided, the agent should infer it from the task_description or the current browser state if continuing a task.") # Decided to put URL in task_description for simplicity

class BrowserAutomatorTool(BaseTool):
    """A LangChain tool to perform complex web automation tasks using an LLM-driven browser agent."""

    name: str = "web_browser_automator"
    description: str = (
        "Use this tool for complex, multi-step tasks in a web browser, such as navigating websites, filling forms, clicking buttons, or extracting information from pages that require JavaScript. "
        "Provide a detailed natural language 'task_description' of what needs to be done, including any specific URLs to visit. "
        "For Google Sheets, prefer using 'google_sheets_generic_reader' or 'google_sheets_generic_writer' tools if possible by extracting the sheet ID from the URL. "
        "Only use this tool for Google Sheets if direct API access fails, is insufficient (e.g., the sheet is not shared for API access but viewable in a browser), or if the task specifically requires UI manipulation beyond simple data reading/writing. "
        "The tool will return the final result or observation from the browser automation agent."
    )
    args_schema: Type[BaseModel] = BrowserAutomatorInput

    # TODO: Consider how to best provide the LLM. For now, it instantiates its own.
    # This could be optimized by sharing the main agent's LLM if possible.
    llm: ChatOpenAI = Field(default_factory=lambda: ChatOpenAI(model="gpt-4o", temperature=0))

    def _run(
        self, 
        task_description: str,
        # start_url: Optional[str] = None, # Removed start_url as separate arg
        **kwargs: Any 
    ) -> str:
        """Execute the browser automation task synchronously."""
        # langchain.tools.BaseTool._run is called by AgentExecutor a lot of the time
        # asyncio.run() is not re-entrant and can cause issues if the agent is already in an event loop.
        # For a robust solution, the AgentExecutor should ideally be run with asyncio.
        
        # This is a common way to bridge async code to sync in such tools if needed,
        # but it's best if the calling environment (AgentExecutor) handles the loop.
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If a loop is running, we cannot use asyncio.run().
                # This might happen if the agent itself is running in an async context.
                # A more sophisticated solution might involve `nest_asyncio` or ensuring
                # the agent executor is run in a way that accommodates async tool calls.
                # For now, we'll raise an error or log a warning.
                # print("Warning: Attempting to run async browser tool from a running event loop. This might lead to issues.")
                # This is a placeholder. The ideal way is to use _arun.
                # Forcing sync execution here if loop is running is tricky.
                # Let's try to use asyncio.run for now and see if AgentExecutor manages it.
                # If not, we will primarily rely on _arun.
                task = loop.create_task(self._arun(task_description=task_description, **kwargs))
                # This approach to get result from task in sync code is complex and error-prone.
                # It's better to ensure _arun is called if in an async context.
                # For now, just calling asyncio.run as a simpler approach, assuming AgentExecutor might not have its own loop or manages it.
                return asyncio.run(self._arun(task_description=task_description, **kwargs))

            else: # No loop running, safe to use asyncio.run
                return asyncio.run(self._arun(task_description=task_description, **kwargs))
        except RuntimeError as e:
            if " asyncio.run() cannot be called from a running event loop" in str(e):
                 return "Error: BrowserAutomatorTool cannot be run synchronously from within an existing asyncio event loop. The agent needs to support async tool calls, or this tool should be called from a non-async context."
            raise e


    async def _arun(
        self, 
        task_description: str,
        # start_url: Optional[str] = None, # Removed start_url as separate arg
        **kwargs: Any
    ) -> str:
        """Execute the browser automation task asynchronously."""
        print(f"BrowserAutomatorTool: Received task: {task_description}")
        
        # Ensure OPENAI_API_KEY is available for the ChatOpenAI instance in BrowserAutomator
        # This assumes it's loaded from .env or set in the environment.
        # If self.llm was passed in, this would be handled by its instantiation.
        if not self.llm.openai_api_key:
            # Attempt to get it from os.environ if not set on the instance.
            # This is a fallback, ideally it's configured on the llm instance.
            import os
            from dotenv import load_dotenv
            load_dotenv()
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return "Error: OPENAI_API_KEY not found for BrowserAutomator's LLM."
            self.llm.openai_api_key = api_key


        automator = BrowserAutomator(
            llm=self.llm, # Use the LLM instance from the tool
            task_description=task_description,
            # controller and enable_memory can be configured if needed, defaults are used for now
        )
        
        try:
            # run_automation is async, so we await it here.
            result = await automator.run_automation()
            
            # The result from BrowserAutomator.run_automation() is an ActionResult or None.
            # We need to convert this to a string for the LangChain agent.
            if result:
                # ActionResult might have different attributes. Let's try to get a summary.
                # Assuming ActionResult has a 'summary' or similar, or just convert to string.
                if hasattr(result, 'summary') and result.summary:
                    return str(result.summary)
                elif hasattr(result, 'status_code') and result.status_code == 200 and hasattr(result, 'content'): # Example
                    return f"Browser action successful. Content snippet: {str(result.content)[:200]}..."
                else:
                    return f"Browser automation finished. Result: {str(result)}" # Generic fallback
            else:
                return "Browser automation task completed, but no specific result was returned by the automation agent."
        except Exception as e:
            print(f"Error during BrowserAutomatorTool execution: {e}")
            return f"Error during browser automation: {str(e)}"

# Example of how to potentially use it (for testing, not for agent directly)
async def main_test():
    tool = BrowserAutomatorTool()
    # Ensure OPENAI_API_KEY is in your environment
    # Example task:
    test_task = "Go to google.com and search for 'LangChain Browser Automation' and tell me the title of the first result page."
    try:
        output = await tool._arun(task_description=test_task)
        print("\nTool Output:")
        print(output)
    except Exception as e:
        print(f"Error in test: {e}")

if __name__ == '__main__':
    # To run this test:
    # 1. Ensure OPENAI_API_KEY is set in your .env file and loaded.
    # 2. You might need to install playwright browsers: python -m playwright install
    # asyncio.run(main_test())
    print("BrowserAutomatorTool created. To test, uncomment the asyncio.run(main_test()) line and ensure OPENAI_API_KEY is set.") 
```

## File: tools/gmail_tool.py

- Extension: .py
- Language: python
- Size: 13497 bytes
- Created: 2025-05-13 18:05:57
- Modified: 2025-05-13 18:05:57

### Code

```python
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

# If modifying these SCOPES, delete the file gmail_token.json.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Path to your client secrets and token files
# IMPORTANT: Ensure client_secret.json has Gmail API enabled in Google Cloud Console.
CLIENT_SECRET_FILE = "client_secret.json" 
GMAIL_TOKEN_FILE = "gmail_token.json" # Separate token file for Gmail

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
    # 1. Make sure you have 'client_secret.json' in your project root,
    #    configured in Google Cloud Console with Gmail API enabled.
    # 2. Run this script once. It will open a browser for you to authorize.
    #    'gmail_token.json' will be created.
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
        print("Remember to have client_secret.json and authorize when prompted.")
    else:
        print("Failed to obtain Gmail credentials. Cannot run test.") 
```

## File: tools/interac_scraper.py

- Extension: .py
- Language: python
- Size: 6383 bytes
- Created: 2025-05-13 14:12:33
- Modified: 2025-05-13 14:12:33

### Code

```python
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
        # You might want to load OPENAI_API_KEY from .env for local testing
        if not OPENAI_API_KEY or "sk-proj-" not in OPENAI_API_KEY:
            print("Warning: OPENAI_API_KEY might not be configured correctly for standalone test.")
            # Optionally load from a .env file if python-dotenv is used
            # from dotenv import load_dotenv
            # load_dotenv()
            # global OPENAI_API_KEY
            # OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", OPENAI_API_KEY)

        result = await fetch_interac_transfers()
        if result and result.extracted_content:
            print(f"Interac Scraper Test: Extracted content: {result.extracted_content}")
        else:
            print("Interac Scraper Test: No content extracted or an error occurred.")

    asyncio.run(run_test_interac_scraper()) 
```

## File: tools/__init__.py

- Extension: .py
- Language: python
- Size: 348 bytes
- Created: 2025-05-13 18:35:48
- Modified: 2025-05-13 18:35:48

### Code

```python
from .sheets_tool    import SheetsCommitmentTool, GenericSheetsReaderTool, GenericSheetsWriterTool
from .bank_tool      import BankEtransferTool
# from .whatsapp_tool  import WhatsAppPersonalTool
from .gmail_tool import GmailSearchTool
from .langchain_browser_tool import BrowserAutomatorTool 
from .get_current_date_tool import GetCurrentDateTool 
```

## File: tools/custom_actions.py

- Extension: .py
- Language: python
- Size: 2507 bytes
- Created: 2025-05-13 14:12:33
- Modified: 2025-05-13 14:12:33

### Code

```python
import asyncio
import aiohttp
from browser_use import ActionResult # Assuming browser_use is installed

async def get_2fa_code() -> ActionResult:
    """Polls https://2fa.ngrok.app/get-2fa-code (max 60s) and returns the code."""
    url = "https://2fa.ngrok.app/get-2fa-code"
    print(f"\n[Custom Action get_2fa_code] Starting to poll {url} for 2FA code...")
    # Use a longer total timeout for the session, but keep individual request timeouts short
    session_timeout = aiohttp.ClientTimeout(total=65) 
    request_timeout = aiohttp.ClientTimeout(total=5) 
    async with aiohttp.ClientSession(timeout=session_timeout) as session:
        for attempt in range(30): # Poll for 30 * 2s = 60 seconds
            print(f"[Custom Action get_2fa_code] Polling attempt {attempt + 1}/30...")
            try:
                # Use a shorter timeout for each individual GET request
                async with session.get(url, timeout=request_timeout) as resp:
                    if resp.status == 200:
                        code = (await resp.text()).strip()
                        if code:
                            print(f"[Custom Action get_2fa_code] Retrieved: {code}")
                            # Ensure the returned value conforms to ActionResult if needed by the Controller
                            # Assuming ActionResult just needs the string content for now.
                            # If it needs specific fields, adjust this.
                            return ActionResult(extracted_content=code) 
                        else:
                            print("[Custom Action get_2fa_code] Received empty code, will retry...")
                    else:
                         print(f"[Custom Action get_2fa_code] Received status {resp.status}, will retry...")
                         
            except asyncio.TimeoutError:
                 print("[Custom Action get_2fa_code] Request timed out, will retry...")
            except aiohttp.ClientError as e:
                print(f"[Custom Action get_2fa_code] aiohttp error: {e}, will retry...")
            except Exception as e:
                 print(f"[Custom Action get_2fa_code] Unexpected error: {e}, will retry...")

            await asyncio.sleep(2) # Wait before the next poll

    print("[Custom Action get_2fa_code] Failed to retrieve 2FA code after 60 seconds.")
    # Raise an error or return a specific ActionResult indicating failure
    raise RuntimeError("Timed-out waiting for 2FA code from ngrok service") 
```

## File: tools/get_current_date_tool.py

- Extension: .py
- Language: python
- Size: 803 bytes
- Created: 2025-05-13 18:34:14
- Modified: 2025-05-13 18:34:14

### Code

```python
from langchain_core.tools import BaseTool
from datetime import datetime, timezone

class GetCurrentDateTool(BaseTool):
    name: str = "get_current_date"
    description: str = (
        "Useful for getting the current date. "
        "Returns the current date in YYYY-MM-DD format."
    )

    def _run(self) -> str:
        """Returns the current date as a string."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async def _arun(self) -> str:
        """Returns the current date as a string."""
        # For simplicity, using the sync version in async context
        return self._run()

if __name__ == '__main__':
    tool = GetCurrentDateTool()
    print(f"Tool Name: {tool.name}")
    print(f"Tool Description: {tool.description}")
    print(f"Current Date: {tool._run()}") 
```

## File: tools/bank_tool.py

- Extension: .py
- Language: python
- Size: 3992 bytes
- Created: 2025-05-13 16:57:49
- Modified: 2025-05-13 16:57:49

### Code

```python
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
```

## File: tools/sheets_tool.py

- Extension: .py
- Language: python
- Size: 16774 bytes
- Created: 2025-05-13 18:38:53
- Modified: 2025-05-13 18:38:53

### Code

```python
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
```

## File: tools/browser_automator.py

- Extension: .py
- Language: python
- Size: 2544 bytes
- Created: 2025-05-13 14:12:33
- Modified: 2025-05-13 14:12:33

### Code

```python
import asyncio
from browser_use import Agent, Controller, Browser, ActionResult
from langchain_openai import ChatOpenAI # Or whichever LLM you use
from typing import Optional, Callable, Awaitable

class BrowserAutomator:
    """A reusable tool for automating web tasks using browser_use and an LLM."""

    def __init__(
        self,
        llm: ChatOpenAI, # Or a base LLM class if you might swap models
        task_description: str,
        controller: Optional[Controller] = None,
        enable_memory: bool = False
    ):
        """
        Initializes the BrowserAutomator.

        Args:
            llm: The language model instance to use.
            task_description: The detailed prompt/instructions for the agent.
            controller: An optional Controller instance with pre-registered actions.
            enable_memory: Whether to enable memory for the agent.
        """
        self.llm = llm
        self.task_description = task_description
        self.controller = controller if controller is not None else Controller()
        self.enable_memory = enable_memory
        self._browser_instance: Optional[Browser] = None

    async def run_automation(self) -> Optional[ActionResult]:
        """Sets up the browser and agent, runs the automation task, and cleans up."""
        print(f"--- Starting browser automation task ---")
        result = None
        self._browser_instance = Browser()
        try:
            browser_playwright_context = await self._browser_instance.new_context()

            agent = Agent(
                task=self.task_description,
                llm=self.llm,
                controller=self.controller,
                browser_context=browser_playwright_context,
                enable_memory=self.enable_memory
            )
            result = await agent.run() # Capture the final result
            print(f"--- Browser automation task finished. Result: {result} ---")
            return result # Return the final ActionResult or whatever agent.run() returns

        except Exception as e:
            print(f"An error occurred during the browser automation task: {e}")
            # Decide if you want to re-raise, return None, or a specific error state
            raise # Re-raise the exception for now
        finally:
            if self._browser_instance:
                print("Closing browser instance...")
                await self._browser_instance.close()
                self._browser_instance = None
            print("--- Browser automation cleanup complete ---") 
```

## File: agents/halaqa_agent.py

- Extension: .py
- Language: python
- Size: 9598 bytes
- Created: 2025-05-13 16:57:00
- Modified: 2025-05-13 16:57:00

### Code

```python
import os, datetime
from langgraph.graph import Graph, START, END
from tools.sheets_tool import SheetsCommitmentTool, TransfersSheetTool, get_sheets_credentials
from tools.bank_tool import BankEtransferTool

# ---- helper functions -----------------------------------------
def get_existing_transfers(sheet_id, creds_func):
    """Get existing transfers from the Transfers worksheet"""
    from googleapiclient.discovery import build
    
    try:
        service = build("sheets", "v4", credentials=creds_func())
        sheet = service.spreadsheets()
        
        # First check if the Transfers sheet exists
        sheet_metadata = sheet.get(spreadsheetId=sheet_id).execute()
        sheets = sheet_metadata.get('sheets', [])
        sheet_exists = False
        
        for s in sheets:
            if s['properties']['title'] == "Transfers":
                sheet_exists = True
                break
                
        if not sheet_exists:
            return []  # No transfers sheet yet
        
        # Get the transfers data
        result = sheet.values().get(
            spreadsheetId=sheet_id,
            range="Transfers!A:F"  # Read all 6 columns
        ).execute()
        
        values = result.get("values", [])
        if not values or len(values) <= 1:  # Only header or empty
            return []
            
        # Skip header row, create list of transfer records
        existing_transfers = []
        for row in values[1:]:  # Skip header
            if len(row) >= 5:  # Expect at least Date, Sender Name, Amount, Type, Status
                transfer = {
                    "date": row[0] if len(row) > 0 else "",
                    "sender": row[1] if len(row) > 1 else "",      # Column B is Sender Name
                    "amount": row[2] if len(row) > 2 else "",      # Column C is Amount
                    "type": row[3] if len(row) > 3 else "",        # Column D is Transfer Type
                    "status": row[4] if len(row) > 4 else "",      # Column E is Transfer Status
                    # "notes": row[5] if len(row) > 5 else ""    # Column F is Notes (optional for now)
                }
                existing_transfers.append(transfer)
                
        return existing_transfers
        
    except Exception as e:
        print(f"Error getting existing transfers: {e}")
        return []

def format_transfer_for_comparison(transfer):
    """Format a transfer record for comparison"""
    # Normalize data for comparison
    return {
        "date": str(transfer.get("date", "")),
        "sender": str(transfer.get("sender", "")).upper(),
        "amount": str(transfer.get("amount", ""))
    }

def transfers_are_equal(t1, t2):
    """Compare two transfers to see if they are the same"""
    t1_fmt = format_transfer_for_comparison(t1)
    t2_fmt = format_transfer_for_comparison(t2)
    
    # Compare date, sender, and amount
    return (t1_fmt["date"] == t2_fmt["date"] and 
            t1_fmt["sender"] == t2_fmt["sender"] and 
            t1_fmt["amount"] == t2_fmt["amount"])

def is_new_transfer(transfer, existing_transfers):
    """Check if a transfer is new (not in existing_transfers)"""
    for existing in existing_transfers:
        if transfers_are_equal(transfer, existing):
            return False
    return True

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
    month_to_filter = state["month"] # e.g., "2025-05"
    
    # This will now return a list of individual transfer dicts from the hardcoded data
    individual_transfers_list = BankEtransferTool().invoke({"month": month_to_filter}) 
    
    paid_data_for_month = {}
    # Filter transfers for the current month and aggregate amounts by sender for paid_data
    if individual_transfers_list:
        for transfer in individual_transfers_list:
            transfer_date_str = transfer.get("date", "") # Expected YYYY-MM-DD
            sender = transfer.get("name", "UNKNOWN SENDER").upper()
            amount = transfer.get("amount", 0.0)
            
            # Check if the transfer belongs to the current month_to_filter
            if transfer_date_str.startswith(month_to_filter):
                paid_data_for_month[sender] = paid_data_for_month.get(sender, 0.0) + amount
    
    # The 'transfers' key in the state should be the list of individual transfers 
    # (potentially filtered for the month, or all, depending on downstream needs).
    # The diff node uses `state["paid"]` (which is `paid_data_for_month` here) to compare against commitments.
    # The update_transfers node uses `state["transfers"]` to write to the sheet.
    # We should pass all fetched individual transfers to `state["transfers"]` 
    # so `update_transfers` can check for duplicates correctly across all fetched data.

    updated_state = {**state, "paid": paid_data_for_month, "transfers": individual_transfers_list}
    print(f"fetch_bank will return: {updated_state}")
    return updated_state

def diff(state):
    print(f"diff received state: {state}")
    commit = state["commit"]; paid = state["paid"]
    short_data = {}
    
    # Check if there was an error in fetching the commitments
    if isinstance(commit, dict) and "error" in commit:
        print(f"Error in commitment data: {commit['error']}")
        # Return the state with an empty short_data
        return {**state, "short": short_data}
    
    # Process the valid commitment data
    try:
        for n, data in commit.items():
            # Check if the data is in the expected format
            if isinstance(data, dict) and "commitment" in data:
                commitment_amount = data["commitment"]
                amount_paid = paid.get(n, 0.0)
                if commitment_amount > amount_paid:
                    short_data[n] = round(commitment_amount - amount_paid, 2)
            else:
                print(f"Skipping entry for {n}: data not in expected format. Got: {data}")
    except Exception as e:
        print(f"Error processing commitment data: {e}")
        # If an error occurs, continue with what we have
    
    updated_state = {**state, "short": short_data}
    print(f"diff will return: {updated_state}")
    return updated_state

def update_transfers(state):
    """Node to update Google Sheets with the transfer data."""
    print(f"update_transfers received state: {state}")
    transfers = state.get("transfers", [])
    
    if not transfers:
        print("No transfers to update in Google Sheets.")
        return {**state, "sheets_result": {"status": "No transfers to update"}}
    
    try:
        # Create a TransfersSheetTool instance to get the sheet_id
        sheet_tool = TransfersSheetTool()
        
        # Get existing transfers from the Transfers worksheet
        existing_transfers = get_existing_transfers(sheet_tool.sheet_id, get_sheets_credentials)
        print(f"Found {len(existing_transfers)} existing transfers in the sheet.")
        
        # Filter out transfers that already exist in the sheet
        new_transfers = []
        for transfer in transfers:
            if is_new_transfer(transfer, existing_transfers):
                new_transfers.append(transfer)
        
        print(f"Found {len(new_transfers)} new transfers to add to the sheet.")
        
        if not new_transfers:
            print("All transfers already exist in the sheet.")
            return {**state, "sheets_result": {"status": "No new transfers to add"}}
        
        # Sort new_transfers by date in ascending order before writing
        new_transfers.sort(key=lambda t: t.get('date', ''))
        print(f"Sorted {len(new_transfers)} new transfers by date (ascending).")
        
        # Use the TransfersSheetTool to update the sheet with new transfers
        result = sheet_tool.invoke({"transfers": new_transfers})
        
        print(f"Google Sheets update result: {result}")
        return {**state, "sheets_result": result}
    except Exception as e:
        print(f"Error updating Google Sheets: {e}")
        return {**state, "sheets_result": {"status": "error", "message": str(e)}}

# ---- graph wiring -------------------------------------------
g = Graph()
g.add_node("fetch_sheet", fetch_sheet)
g.add_node("fetch_bank",  fetch_bank)
g.add_node("diff",        diff)
g.add_node("update_transfers", update_transfers)

g.add_edge(START, "fetch_sheet")
g.add_edge("fetch_sheet", "fetch_bank")
g.add_edge("fetch_bank",  "diff")
g.add_edge("diff",        "update_transfers")
g.add_edge("update_transfers", END)

HALAQA_GRAPH = g.compile() 
```

