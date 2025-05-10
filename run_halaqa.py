import os, datetime
from dotenv import load_dotenv
from graph_halaqa import HALAQA_GRAPH

load_dotenv()  # loads .env at project root

if __name__ == "__main__":
    today = datetime.date.today()
    month = today.strftime("%Y-%m")
    HALAQA_GRAPH.invoke({"month": month}) 