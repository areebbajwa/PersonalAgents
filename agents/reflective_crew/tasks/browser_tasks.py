from crewai import Task

def create_browser_interaction_task(agent_instance, instruction):
    """
    Creates a task for the LocalPlaywrightAgent.

    Args:
        agent_instance: An instance of the LocalPlaywrightAgent.
        instruction: A string detailing what the agent should do in the browser.

    Returns:
        A CrewAI Task instance.
    """
    return Task(
        description=instruction,
        expected_output="A summary of the actions performed in the browser and any requested information or data. "
                        "If a snapshot was requested, confirmation of the snapshot. "
                        "If an error occurred, a description of the error.",
        agent=agent_instance,
        # You could add context from other tasks if needed, e.g.:
        # context=[other_task_output]
    )

# Example task instructions you could use:
# task_instruction_1 = ("Open the website 'https://www.duckduckgo.com'. "
#                       "Then, type 'CrewAI framework' into the search bar. "
#                       "Click the search button if necessary or press Enter. "
#                       "Take a snapshot of the search results page.")

# task_instruction_2 = ("Navigate to 'https://quotes.toscrape.com/'. "
#                       "Extract the text of the first three quotes on the page. "
#                       "Then, click on the 'Next' button to go to the next page of quotes. "
#                       "Take a snapshot of the second page.") 