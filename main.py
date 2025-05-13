#!/usr/bin/env python3
import os
import sys
import argparse
import logging
import traceback
import datetime # Added for timestamp

# No longer load dotenv here, agent.py handles it.
# from dotenv import load_dotenv
# print("MAIN.PY: Attempting to load .env file...")
# loaded_successfully = load_dotenv()
# print(f"MAIN.PY: load_dotenv() returned: {loaded_successfully}")
# print(f"MAIN.PY - AFTER LOAD_DOTENV: OPENAI_API_KEY = {'SET' if os.environ.get('OPENAI_API_KEY') else 'NOT FOUND'}")

def setup_logging(debug_mode: bool = False):
    """Configures logging to both console and a timestamped file."""
    log_level = logging.DEBUG if debug_mode else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Create a timestamped log file name
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"agent_run_{timestamp}.log"
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.FileHandler(log_filename), # Log to file
            logging.StreamHandler(sys.stdout)  # Log to console
        ]
    )
    logging.info(f"MAIN.PY: Logging initialized. Log file: {log_filename}")

# Removed run_halaqa_agent function

def main():
    """Main entry point to run the LangChain agent with a specified task."""
    print("MAIN.PY: Starting PersonalAgents general agent runner...")
    
    parser = argparse.ArgumentParser(description="Run the Personal AI Agent with a specific task.")
    parser.add_argument("task", type=str, help="The natural language task for the agent to perform.")
    parser.add_argument("--debug", action="store_true", help="Enable debug output for logging.")
    
    args = parser.parse_args()
    
    # Setup logging first
    setup_logging(args.debug)
    
    if args.debug:
        # This message will now go to both console and file thanks to setup_logging
        logging.debug("MAIN.PY: Debug mode enabled")
    
    logging.info(f"MAIN.PY: Received task: {args.task}")
    
    try:
        # Import the agent runner from agent.py
        from agent import run_agent_task
        
        # Execute the task
        # Note: If run_agent_task becomes async, main will need to be async too
        # and use asyncio.run(run_agent_task(args.task))
        run_agent_task(args.task)
        
        logging.info("MAIN.PY: Agent finished processing the task.")
        
    except ImportError as ie:
        logging.error(f"MAIN.PY: Failed to import agent components: {ie}")
        logging.error("MAIN.PY: Ensure agent.py is in the correct path and all dependencies are installed.")
        sys.exit(1)
    except Exception as e:
        logging.error(f"MAIN.PY: An error occurred while running the agent task: {e}")
        logging.error(traceback.format_exc())
        sys.exit(1)
    
    logging.info("MAIN.PY: Finished execution.")

if __name__ == "__main__":
    main() 