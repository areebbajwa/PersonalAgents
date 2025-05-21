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
# print("AGENT.PY: Attempting to load .env file...") # Less verbose for library use
loaded_successfully = load_dotenv(dotenv_path="config/.env")
# print(f"AGENT.PY: load_dotenv() returned: {loaded_successfully}") # Less verbose

def build_agent_executor():
    """
    Builds and returns a LangChain AgentExecutor configured with an LLM, tools, prompt, and memory.
    """
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("AGENT.PY: ERROR - OPENAI_API_KEY not found in environment variables.")
        # Potentially raise an error or handle it as per application's needs
        # For now, ChatOpenAI will raise an error if key is not found and not passed directly
    # else:
        # print("AGENT.PY: OPENAI_API_KEY loaded.") # Less verbose

    # 1. Initialize LLM
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
    agent = create_openai_functions_agent(llm, tools, prompt)

    # 5. Create the AgentExecutor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=ConversationBufferMemory(memory_key="chat_history", return_messages=True),
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=50,
        early_stopping_method="generate",
        return_intermediate_steps=True
    )
    # print(f"AGENT.PY: Agent Executor created. Loaded Tools: {[tool.name for tool in tools]}") # Less verbose
    return agent_executor

def run_agent_task(executor: AgentExecutor, task: str): # Added executor parameter
    """Helper function to run a task through the provided agent executor."""
    print(f"\n--- Running task via agent.py: {task} ---")
    try:
        result = executor.invoke({"input": task})
        print("\n--- Task Response (agent.py) ---")

        if result.get("intermediate_steps") and isinstance(result["intermediate_steps"], list) and len(result["intermediate_steps"]) > 0:
            last_step_action = result["intermediate_steps"][-1][0]
            if hasattr(last_step_action, 'log') and "AgentFinish" in last_step_action.log:
                 print("⚠️ Agent tried to finish early.")

        print(f"Output: {result.get('output')}")
    except Exception as e:
        print(f"Error running agent task in agent.py: {e}")
        import traceback
        traceback.print_exc()
    print("--- Task End (agent.py) ---")

if __name__ == "__main__":
    print("\nAGENT.PY: Running in main execution mode (for testing core agent functionality).")
    
    # Build the agent executor
    my_agent_executor = build_agent_executor()
    
    if my_agent_executor:
        print(f"AGENT.PY: Successfully built Agent Executor in main. Loaded Tools: {[tool.name for tool in my_agent_executor.tools]}")
        
        # --- Test Scenario: Simple Greeting or Info Task ---
        # This task is just to test the core agent functionality when agent.py is run directly.
        test_task = "What is the primary function of the BrowserAutomatorTool?"
        
        print(f"\nAGENT.PY: Running a simple test task: '{test_task}'")
        run_agent_task(my_agent_executor, test_task) # Pass the executor
    else:
        print("AGENT.PY: Failed to build agent executor in main.")

    print("\nAGENT.PY: End of script (main execution).") 