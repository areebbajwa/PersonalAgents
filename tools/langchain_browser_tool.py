import asyncio
import os # Ensure os is imported
from typing import Any, Dict, Optional, Type

from langchain.tools import BaseTool
from langchain.pydantic_v1 import BaseModel, Field
from langchain_openai import ChatOpenAI # For the BrowserAutomator
from dotenv import load_dotenv # Ensure load_dotenv is available

from tools.browser_automator import BrowserAutomator # The class you provided

# Load .env file for os.getenv("OPENAI_API_KEY") to work in default_factory
load_dotenv()

class BrowserAutomatorInput(BaseModel):
    task_description: str = Field(description="A detailed natural language description of the web automation task to perform, including the objectives and any specific steps or data to look for. If the task involves a specific starting URL, include it clearly in the description.")
    # start_url: Optional[str] = Field(None, description="Optional: The URL to start the automation from. If not provided, the agent should infer it from the task_description or the current browser state if continuing a task.") # Decided to put URL in task_description for simplicity

class BrowserAutomatorTool(BaseTool):
    """A LangChain tool to perform complex web automation tasks using an LLM-driven browser agent."""

    name: str = "web_browser_automator"
    description: str = (
        "Use this tool for any task that requires interacting with a web browser. This includes simple tasks like performing a Google search and extracting results, "
        "as well as more complex, multi-step operations such as navigating websites, filling forms, clicking buttons, or extracting information from pages that require JavaScript. "
        "Provide a detailed natural language 'task_description' of what needs to be done, including any specific URLs to visit (like www.google.com for a search). "
        "For Google Sheets, prefer using specific Google Sheets tools if possible by extracting the sheet ID; however, use this browser tool if direct API access fails or if UI manipulation is needed for Sheets. "
        "The tool will return the final result or observation from the browser."
    )
    args_schema: Type[BaseModel] = BrowserAutomatorInput

    llm: Optional[ChatOpenAI] = None # Changed: No default_factory, allow it to be None initially

    def _get_llm_instance(self) -> ChatOpenAI:
        """Ensures a configured ChatOpenAI instance is available."""
        if self.llm is None or not isinstance(self.llm, ChatOpenAI):
            # If no LLM is passed or it's not the correct type, create a new one.
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found. Cannot initialize LLM for BrowserAutomatorTool.")
            self.llm = ChatOpenAI(model="gpt-4o", temperature=0, openai_api_key=api_key)
        elif not self.llm.openai_api_key:
            # If an LLM instance was somehow passed without an API key, try to set it.
            # This case might be rare if the main agent LLM is configured correctly.
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("BrowserAutomatorTool's LLM instance is missing an API key, and OPENAI_API_KEY was not found in env.")
            self.llm.openai_api_key = api_key # Attempt to set on existing instance
        return self.llm

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
        
        try:
            current_llm = self._get_llm_instance()
        except ValueError as e:
            print(f"LLM configuration error in BrowserAutomatorTool: {e}")
            return f"Error: LLM configuration issue for browser automation - {e}"

        automator = BrowserAutomator(
            llm=current_llm, 
            task_description=task_description,
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