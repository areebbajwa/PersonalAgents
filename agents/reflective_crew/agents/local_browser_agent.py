from crewai import Agent

class LocalPlaywrightAgent(Agent):
    def __init__(self, llm, tools=None): # llm is expected to be an initialized LLM instance, tools is a list of tools
        super().__init__(
            role="Local Browser Automation Specialist via Playwright MCP",
            goal="Execute browser tasks on the user's local machine using Playwright MCP "
                 "to navigate, interact with elements, and extract information.",
            backstory=(
                "I am an AI agent specifically designed to operate a local browser "
                "through a Playwright Multi-Modal Controller Platform (MCP). "
                "I can understand instructions to open websites, click buttons, "
                "type into fields, and retrieve web page content, all happening on the user's machine. "
                "My capabilities are enabled by the tools provided by the connected MCP."
            ),
            verbose=True,
            # Tools like mcp_playwright_browser_navigate, mcp_playwright_browser_click, etc.,
            # are made available to the agent if CrewAI is correctly configured
            # to communicate with your Playwright MCP server.
            # Explicitly listing them in the 'tools' array here might be necessary
            # depending on your CrewAI version and MCP integration setup,
            # but often the MCP connection itself advertises available tools.
            # Consult CrewAI's MCP integration documentation.
            tools=tools if tools is not None else [], # Pass the provided tools
            llm=llm,
            allow_delegation=False,
            # It's often beneficial to allow the agent to use the LLM to reason about browser content
            allow_code_execution=False # Set to True if you expect the agent to interpret or run JS, etc.
        ) 