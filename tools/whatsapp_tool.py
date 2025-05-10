import os, json, requests
from langchain.tools import BaseTool

class WhatsAppPersonalTool(BaseTool):
    name: str = "send_whatsapp_personal"
    description: str = "Send a WhatsApp message via personal gateway"

    def _run(self, phone: str, body: str) -> dict:
        gw  = os.environ["WA_GATEWAY_URL"]
        res = requests.post(gw, json={"to": f"{phone}@c.us", "body": body}, timeout=10)
        res.raise_for_status()
        return res.json() 