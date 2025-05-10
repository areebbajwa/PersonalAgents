import json, os, datetime
from langgraph.graph import Graph, START, END
from tools import SheetsCommitmentTool, BankEtransferTool, WhatsAppPersonalTool

# ---- helper --------------------------------------------------
PHONEBOOK = json.load(open("phonebook.json"))

def lookup_phone(name: str) -> str:
    return PHONEBOOK[name]

# ---- nodes ---------------------------------------------------
def fetch_sheet(state):
    print(f"fetch_sheet received state: {state}")
    commit_data = SheetsCommitmentTool().invoke({})
    updated_state = {**state, "commit": commit_data}
    print(f"fetch_sheet will return: {updated_state}")
    return updated_state

def fetch_bank(state):
    print(f"fetch_bank received state: {state}")
    month = state["month"]
    paid_data = BankEtransferTool().invoke({"month": month})
    updated_state = {**state, "paid": paid_data}
    print(f"fetch_bank will return: {updated_state}")
    return updated_state

def diff(state):
    print(f"diff received state: {state}")
    commit = state["commit"]; paid = state["paid"]
    short_data = {
        n: round(commit[n] - paid.get(n, 0.0), 2)
        for n in commit if commit[n] > paid.get(n, 0.0)
    }
    updated_state = {**state, "short": short_data}
    print(f"diff will return: {updated_state}")
    return updated_state

def notify(state):
    print(f"notify received state: {state}")
    wa = WhatsAppPersonalTool()
    for person, owing in state["short"].items():
        body = (
            f"Salam {person}! You're short ${owing:.2f} "
            f"for this month's halaqa fee. JazakumAllahu khairan!"
        )
        wa.invoke({"phone": lookup_phone(person), "body": body})
    return {}

# ---- graph wiring -------------------------------------------
g = Graph()
g.add_node("fetch_sheet", fetch_sheet)
g.add_node("fetch_bank",  fetch_bank)
g.add_node("diff",        diff)
g.add_node("notify",      notify)

g.add_edge(START, "fetch_sheet")
g.add_edge("fetch_sheet", "fetch_bank")
g.add_edge("fetch_bank",  "diff")
g.add_edge("diff",        "notify")
g.add_edge("notify",      END)

HALAQA_GRAPH = g.compile() 