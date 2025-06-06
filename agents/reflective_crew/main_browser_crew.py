import os
from dotenv import load_dotenv
from crewai import Crew
from crewai_tools import MCPServerAdapter # For MCP connection

# LLM Provider - Using OpenAI for this example
# Ensure you have OPENAI_API_KEY in your .env file
# You might need to install langchain-openai: pip install langchain-openai
from langchain_openai import ChatOpenAI

from agents.reflective_crew.agents.local_browser_agent import LocalPlaywrightAgent
from agents.reflective_crew.tasks.browser_tasks import create_browser_interaction_task

# --- IMPORTANT PRE-REQUISITES --- 
# 1. Your Playwright MCP Server MUST be running MANUALLY in a separate terminal.
#    Command: /usr/local/bin/npx @playwright/mcp@latest --config /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/config/playwright-mcp-config.json --port 8931
#
# 2. The server_params below (URL and transport) MUST match your Playwright MCP server's configuration.
#    If 'http://localhost:7890/sse' is not correct, please adjust it.
#    Check the Playwright MCP server's startup logs (when you run it manually) for its listening address.
# --- 

def run_browser_crew():
    """Sets up and runs the browser automation crew."""
    print("Starting the Browser Automation Crew setup (using 'with' statement for MCP)...")

    # Load environment variables from .env file located at ../../config/.env
    # Adjust the path to your .env file if it's located elsewhere
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config', '.env')
    load_dotenv(dotenv_path=dotenv_path)

    openai_api_key = os.getenv("OPENAI_API_KEY")

    if not openai_api_key:
        print(f"Error: OPENAI_API_KEY not found in {dotenv_path}")
        return

    print(f"Successfully loaded OPENAI_API_KEY.")

    # Initialize the LLM
    # You can choose a specific model and temperature
    llm = ChatOpenAI(openai_api_key=openai_api_key, model_name="gpt-4o", temperature=0.2)
    print("LLM initialized (gpt-4o).")

    # --- MCP Server Connection via SSE (using 'with' statement) --- 
    # Ensure your Playwright MCP server is running and listening on this address.
    server_params = {
        "url": "http://localhost:8931/sse", 
        "transport": "sse" 
    }
    print(f"Attempting to connect to externally running MCP server at: {server_params['url']}")

    try:
        with MCPServerAdapter(server_params) as mcp_tools: # Using context manager
            print(f"Successfully connected to MCP server. Available tools: {[tool.name for tool in mcp_tools]}")

            if not mcp_tools:
                print("Error: No tools loaded from MCP server. Cannot proceed.")
                return

            # Initialize the LocalPlaywrightAgent with tools from MCP
            # First, we need to update the agent definition to accept these tools explicitly.
            # For now, we assume the agent is designed to pick them up if available globally
            # or if the MCP integration in CrewAI makes them implicitly available.
            # The best practice is to pass them explicitly, which requires modifying LocalPlaywrightAgent.
            # However, let's first see if the connection works and tools are listed.
            
            # Create the agent (ensure LocalPlaywrightAgent can use tools passed to its constructor or globally available)
            browser_agent = LocalPlaywrightAgent(llm=llm, tools=mcp_tools) # Pass the loaded MCP tools
            print(f"Agent '{browser_agent.role}' initialized with {len(mcp_tools)} MCP tools.")

            # Define the task for the agent
            # You can change this instruction to whatever you want the agent to do.
            task_instruction = (
                "Open the website 'http://example.com/'. " # Using http for simplicity, less likely to have cert issues for a quick test
                "Then, take a snapshot of the page and tell me the main heading text you see."
            )
            # task_instruction = "Open 'https://www.google.com' and take a snapshot."

            browser_task = create_browser_interaction_task(
                agent_instance=browser_agent,
                instruction=task_instruction
            )
            print(f"Task created: {task_instruction}")

            # Assemble the crew
            # For this example, it's a single-agent crew.
            # You could add more agents and tasks for more complex workflows.
            crew = Crew(
                agents=[browser_agent],
                tasks=[browser_task],
                verbose=True  # Changed from 2 to True for boolean type
            )
            print("Crew assembled.")

            # Kick off the crew's work
            print("\nKicking off the crew...")
            result = crew.kickoff()
            print("\n----------------------------------------")
            print("Crew finished executing.")
            print("Result:")
            print(result)
            print("----------------------------------------")

    except Exception as e:
        print(f"\nError connecting to or interacting with MCP server: {e}")
        print("Please ensure:")
        print("1. Your Playwright MCP server is running MANUALLY with --port 8931.")
        print(f"2. The server_params URL ('{server_params['url']}') is correct.")
        print("3. Check the console output of BOTH this script AND your Playwright MCP server.")
    # The 'with' statement will handle closing the mcp_tools connection.

if __name__ == "__main__":
    print("Executing main_browser_crew.py (using 'with' for MCP)...")
    run_browser_crew() 