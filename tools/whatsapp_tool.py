import os, json, requests
from langchain.tools import BaseTool

class WhatsAppPersonalTool(BaseTool):
    name: str = "send_whatsapp_personal"
    description: str = "Send a WhatsApp message via personal gateway"

    def _run(self, phone: str, body: str) -> dict:
        gw_base_url = os.environ["WA_GATEWAY_URL"]
        # Ensure the URL ends with a slash if it doesn't, then append 'send'
        send_url = (gw_base_url if gw_base_url.endswith('/') else gw_base_url + '/') + "send"
        res = requests.post(send_url, json={"to": f"{phone}@c.us", "body": body}, timeout=10)
        res.raise_for_status()
        return res.json() 