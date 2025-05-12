import os, datetime, asyncio
from dotenv import load_dotenv
# Updated import to point to the agent definition
from agents.halaqa_agent import HALAQA_GRAPH 

load_dotenv()  # loads .env at project root

if __name__ == "__main__":
    today = datetime.date.today()
    # The graph expects month as YYYY-MM, let's ensure we pass that format
    month_str = today.strftime("%Y-%m") 
    print(f"Invoking Halaqa graph for month: {month_str}")
    # The graph now involves async operations via BankEtransferTool -> interac_scraper
    # LangGraph's invoke might handle this, but explicitly using ainvoke is safer for async graphs.
    # However, HALAQA_GRAPH itself isn't defined as async in the original code.
    # Let's stick to invoke for now, assuming LangGraph handles the async tool call internally.
    # If errors occur, we might need to switch to graph.ainvoke() within an async main function.
    try:
        # Pass the month string in the input dictionary
        result = HALAQA_GRAPH.invoke({"month": month_str})
        print(f"Halaqa graph finished execution. Final state: {result}")
    except Exception as e:
        print(f"An error occurred during graph execution: {e}")
        # Potentially add more error handling or logging here 