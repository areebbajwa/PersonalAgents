import os
from typing import Tuple, Any
from google.generativeai import GenerativeModel
from crewai import Agent, Task, Crew, Process, LLM, LLMGuardrail
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import SerperDevTool

# Uncomment the following line to use an LLM just once per agent, leveraging memory for stability
# from langchain_openai import ChatOpenAI

# Print version and path for debugging

# Set API keys in the environment
os.environ["GEMINI_API_KEY"] = "AIzaSyDq4TsS5Pi1uAZivYwKnq8REq4tRKQSMMQ"
os.environ["SERPER_API_KEY"] = "YOUR_SERPER_API_KEY" # Placeholder

def validate_research_output(output: str) -> Tuple[bool, Any]:
    """
    A guardrail function to validate the research task's output.
    It checks if the output adheres to a simple set of rules using an LLM call.
    """
    print(f"--- Running Guardrail: Validating research output ---")
    
    # Simple rules for validation
    rules = """
    1. The output must be a bulleted list.
    2. The output must contain at least 3 distinct points.
    3. Each point must be a complete sentence.
    """

    model = GenerativeModel('gemini-2.5-flash-preview-05-20',
                                  api_key=os.environ["GEMINI_API_KEY"])

    prompt = f"""
    As an expert quality assurance supervisor, please validate the following text based on the given rules.

    **Rules:**
    {rules}

    **Text to Validate:**
    "{output}"

    Does the text comply with all rules?
    - If it complies, respond with only "VALIDATION_SUCCESS".
    - If it does not comply, respond with "VALIDATION_FAILURE" and a brief, one-sentence explanation of why.
    """

    try:
        response = model.generate_content(prompt)
        print(f"--- Guardrail Validation Response: {response.text} ---")
        if "VALIDATION_SUCCESS" in response.text:
            return (True, "Validation successful.")
        else:
            return (False, response.text)
    except Exception as e:
        error_message = f"Guardrail validation failed due to an API error: {e}"
        print(f"--- {error_message} ---")
        return (False, error_message)

@CrewBase
class ReflectiveCrew:
    """ReflectiveCrew to research and write a blog post with validation."""
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    # llm = ChatOpenAI(model_name="gpt-4o", temperature=0.7)

    # Define the LLM to be used by the crew
    llm = LLM(model="gemini/gemini-2.5-flash-preview-05-20")

    @agent
    def research_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config['research_specialist'],
            llm=self.llm,
            tools=[SerperDevTool()],
            verbose=True
        )

    @agent
    def content_writer(self) -> Agent:
        return Agent(
            config=self.agents_config['content_writer'],
            llm=self.llm,
            verbose=True
        )

    @task
    def research_task(self) -> Task:
        # Define the validation rules for the guardrail
        rules = """
        1. The output must be a bulleted list.
        2. The output must contain at least 3 distinct points.
        3. Each point must be a complete sentence.
        """
        
        # Create the LLM-based guardrail
        guardrail = LLMGuardrail(
            description=f"Ensure the output strictly follows these rules:\n{rules}",
            llm=self.llm
        )

        return Task(
            config=self.tasks_config['research_task'],
            agent=self.research_specialist(),
            guardrail=guardrail
        )

    @task
    def writing_task(self) -> Task:
        return Task(
            config=self.tasks_config['writing_task'],
            agent=self.content_writer(),
            context=[self.research_task()]
        )

    @crew
    def crew(self) -> Crew:
        """Creates the reflective research crew"""
        return Crew(
            agents=[self.research_specialist(), self.content_writer()],
            tasks=[self.research_task(), self.writing_task()],
            process=Process.sequential,
            verbose=True
        ) 