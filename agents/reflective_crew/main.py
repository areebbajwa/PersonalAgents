import os
from .crew import ReflectiveCrew

def run():
    """
    Run the reflective crew.
    """
    # This is where you could add inputs to the crew like `topic`
    # inputs = {'topic': 'AI in healthcare'}
    # ReflectiveCrew().crew().kickoff(inputs=inputs)
    
    # For this example, we don't have dynamic inputs, so we can just kick it off.
    result = ReflectiveCrew().crew().kickoff()
    print("\n\n########################")
    print("## Crew Execution Result:")
    print("########################\n")
    print(result)

# This allows the script to be run directly
if __name__ == "__main__":
    run() 