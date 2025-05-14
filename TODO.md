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

* [ ] **Agent-Led Email Search & Initial Data Gathering:**
  ➜ *Agent will:
    1. Call `GetCurrentDateTool` to get the current date. (✓ Working)
    2. Call `GmailSearchTool` for Interac e-Transfer emails (e.g., subjects "Interac e-Transfer" + "received funds"/"money deposited"/"sent you money") within the last 35-40 days.
    3. For each email found, extract: Sender Name, Amount, Date, Email Subject. (Agent needs to parse email body/headers for these).*
* [ ] **Agent-Led "Commitments" Sheet Matching:**
  ➜ *For EACH email's sender name:
    1. Call `GenericSheetsReaderTool` to get a list of names from the "Commitments" sheet (ID: `1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4`, gid: `103352420`).
    2. Perform a lenient comparison between the email sender's name and the names from the "Commitments" sheet.
    3. If a match is found, use the *exact name from the "Commitments" sheet* for the next step.*
  * **CHALLENGE:** Ensuring the agent reliably iterates through *all found emails* and then, for each email, performs the "Commitments" sheet lookup and matching. The current prompt guard-rails should help.
* [ ] **Agent-Led "Transfers" (Accounting) Sheet Writing:**
  ➜ *For EACH matched transfer (where an email sender was matched to a name in "Commitments"):
    1. Call `GenericSheetsReaderTool` to read the "Transfers" sheet (ID: `1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4`, gid: `1110009458`) to check for duplicates (e.g., based on Date, Exact Name from Commitments, and Amount).
    2. If the transfer is not a duplicate, call `GenericSheetsWriterTool` to append a new row with: `Date` (from email), `Name` (exact from Commitments), `Amount` (from email), `Email Subject`, `Email Sender`, `Status` (e.g., "Matched from Gmail").*

*Previous approach details (filtering bank sheet first) have been superseded by the new logic.*
* **ISSUE (General):** Agent might still try to finish prematurely. The prompt guard-rails and `return_intermediate_steps` are in place to mitigate this.

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