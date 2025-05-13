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