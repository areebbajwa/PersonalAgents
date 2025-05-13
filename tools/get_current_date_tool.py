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