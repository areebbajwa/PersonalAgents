from crewai_tools import StagehandTool
# from stagehand.schemas import AvailableModel # Uncomment if you want to specify a different LLM model
import os

# --- Hardcoded API Keys (Recommended: Use Environment Variables) ---
# For production or shared code, load these from environment variables
# using a library like python-dotenv and os.getenv()
# Example:
# from dotenv import load_dotenv
# load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../config/.env'))
# BROWSERBASE_API_KEY = os.getenv("BROWSERBASE_API_KEY")
# BROWSERBASE_PROJECT_ID = "YOUR_BROWSERBASE_PROJECT_ID" # You'll need to get this from Browserbase
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

BROWSERBASE_API_KEY = "bb_live_M9BG2PYWnyJqufYqvtBCw6FTvTw"
# IMPORTANT: You need to replace "YOUR_BROWSERBASE_PROJECT_ID" with your actual Browserbase Project ID.
# StagehandTool requires both an API Key and a Project ID.
BROWSERBASE_PROJECT_ID = "526c7e71-e78d-4c2c-b7a7-0ea4f30ba6ba"
OPENAI_API_KEY = "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"
# ANTHROPIC_API_KEY = "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"

class BrowserAutomationTool:
    """
    A wrapper for the StagehandTool to provide browser automation capabilities.
    It's recommended to manage the lifecycle of the StagehandTool using a context manager (`with ... as ...`).
    However, to pass it to a CrewAI agent which might use it multiple times,
    we initialize it here. The StagehandTool itself handles session management.

    Make sure to replace "YOUR_BROWSERBASE_PROJECT_ID" with your actual project ID from Browserbase.
    """
    _tool_instance = None

    @staticmethod
    def get_tool():
        if BrowserAutomationTool._tool_instance is None:
            if BROWSERBASE_PROJECT_ID == "YOUR_BROWSERBASE_PROJECT_ID":
                raise ValueError("Please replace 'YOUR_BROWSERBASE_PROJECT_ID' with your actual Browserbase Project ID in agents/reflective_crew/tools/browser_tool.py")
            
            print("Initializing StagehandTool...")
            try:
                BrowserAutomationTool._tool_instance = StagehandTool(
                    api_key=BROWSERBASE_API_KEY,
                    project_id=BROWSERBASE_PROJECT_ID, # This is crucial
                    model_api_key=OPENAI_API_KEY,
                    # model_name=AvailableModel.GPT_4O, # Default is gpt-4o, uncomment to change
                    # model_name=AvailableModel.CLAUDE_3_7_SONNET_LATEST, # If using Anthropic
                    # verbose=1 # You can set verbosity level (0-3)
                )
                print("StagehandTool initialized successfully.")
            except Exception as e:
                print(f"Error initializing StagehandTool: {e}")
                # Potentially re-raise or handle as appropriate for your application
                raise
        return BrowserAutomationTool._tool_instance

# Example of how to get the tool:
# browser_tool = BrowserAutomationTool.get_tool()

# If you need to explicitly close it (though StagehandTool is designed to be used within a context manager for ideal cleanup):
# def cleanup_tool():
#     if BrowserAutomationTool._tool_instance:
#         try:
#             BrowserAutomationTool._tool_instance.close()
#             print("StagehandTool closed.")
#         except Exception as e:
#             print(f"Error closing StagehandTool: {e}")

# Remember to call cleanup_tool() when your application exits if you're not using the context manager approach directly with the agent's tasks.
# However, CrewAI tools are typically long-lived with the agent.

if __name__ == '__main__':
    # This is a simple test to ensure the tool can be initialized.
    # For actual use, you'd import this tool into your agent definitions.
    try:
        print("Attempting to get StagehandTool instance...")
        tool = BrowserAutomationTool.get_tool()
        if tool:
            print(f"Successfully got tool: {tool.name}")
            print("You can now assign this tool to a CrewAI agent.")
            print("\nTo use it in an agent:")
            print("from agents.reflective_crew.tools.browser_tool import BrowserAutomationTool")
            print("browser_tool = BrowserAutomationTool.get_tool()")
            print("# Then add 'browser_tool' to your agent's tools list.")

            # Example usage (requires a running crew and task)
            # print("\nSimulating a tool run (this will likely fail without a proper task context):")
            # try:
            #     output = tool.run(instruction="Go to google.com and tell me what you see", url="https://www.google.com", command_type="observe")
            #     print(f"Tool output: {output}")
            # except Exception as e:
            #     print(f"Error running tool directly: {e}")
            #     print("This is expected if run outside a CrewAI task execution flow.")

        else:
            print("Failed to get StagehandTool instance.")
    except ValueError as ve:
        print(f"Configuration Error: {ve}")
    except Exception as e:
        print(f"An unexpected error occurred during test: {e}")
    # finally:
    #     cleanup_tool() # Example of explicit cleanup 