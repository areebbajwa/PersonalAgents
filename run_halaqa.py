print("EXECUTION OF RUN_HALAQA.PY HAS BEGUN - ABSOLUTE FIRST LINE")
import sys # Moved sys import here to allow the print above to work

import os, datetime, asyncio, logging
from dotenv import load_dotenv # Restored dotenv

print(f"Python version: {sys.version}")

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables for API keys and bank credentials
print("Loading environment variables...")
load_dotenv()  # loads .env at project root

# Print environment for debugging
print(f"OPENAI_API_KEY: {'Set' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
print(f"TD_USERNAME: {'Set' if os.environ.get('TD_USERNAME') else 'Not set'}")
print(f"TD_PASSWORD: {'Set' if os.environ.get('TD_PASSWORD') else 'Not set'}")

print("Importing HALAQA_GRAPH...")
try:
    # Updated import to point to the agent definition
    from agents.halaqa_agent import HALAQA_GRAPH 
    print("Successfully imported HALAQA_GRAPH")
except Exception as e:
    print(f"Error importing HALAQA_GRAPH: {e}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)

def main():
    """Main function to run the Halaqa agent"""
    print("Entered main() function")
    
    # Print environment variables for debugging (excluding sensitive info)
    logging.debug("Environment variables:")
    logging.debug(f"OPENAI_API_KEY: {'Set' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
    logging.debug(f"TD_USERNAME: {'Set' if os.environ.get('TD_USERNAME') else 'Not set'}")
    logging.debug(f"TD_PASSWORD: {'Set' if os.environ.get('TD_PASSWORD') else 'Not set'}")
    
    today = datetime.date.today()
    # The graph expects month as YYYY-MM, let's ensure we pass that format
    month_str = today.strftime("%Y-%m") 
    print(f"Month string: {month_str}")
    logging.info(f"Invoking Halaqa graph for month: {month_str}")
    
    try:
        # Pass the month string in the input dictionary
        print("About to call HALAQA_GRAPH.invoke()")
        logging.info("Calling HALAQA_GRAPH.invoke()")
        result = HALAQA_GRAPH.invoke({"month": month_str})
        print("HALAQA_GRAPH.invoke() completed")
        logging.info(f"Halaqa graph finished execution.")
        logging.debug(f"Final state: {result}")
    except Exception as e:
        print(f"ERROR in graph execution: {e}")
        logging.error(f"An error occurred during graph execution: {e}")
        import traceback
        traceback_str = traceback.format_exc()
        print(traceback_str)
        logging.error(traceback_str)
        sys.exit(1)

if __name__ == "__main__":
    print("About to call main()")
    main()
    print("main() function completed") 