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