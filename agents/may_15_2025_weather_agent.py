from agent import build_agent_executor, run_agent_task

def run_weather_check():
    """
    Builds an agent and runs a task to check the weather in New York.
    """
    print("WEATHER_TASK_RUNNER: Initializing weather check...")
    
    # Build the agent executor using the function from agent.py
    agent_executor = build_agent_executor()
    
    if not agent_executor:
        print("WEATHER_TASK_RUNNER: Failed to build agent executor. Exiting.")
        return

    print(f"WEATHER_TASK_RUNNER: Agent Executor built. Tools: {[tool.name for tool in agent_executor.tools]}")

    # Define the specific task for the weather agent
    weather_task = "Using a web browser, go to www.google.com and search for 'current weather in New York', then tell me what the weather is briefly based on the search results."
    
    print(f"WEATHER_TASK_RUNNER: Sending task to agent: '{weather_task}'")
    
    # Run the task using the function from agent.py
    run_agent_task(agent_executor, weather_task)
    
    print("WEATHER_TASK_RUNNER: Weather check process finished.")

if __name__ == "__main__":
    run_weather_check() 