# PersonalAgents

A LangGraph-based collection of agents for my own life.  
**Agent #1:** Halaqa fee reminder

## Quick start

```bash
# Python side
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Node WhatsApp gateway
cd waGateway
npm install          # first time only
node index.js        # scan the QR once, then Ctrl-C

# run the agent
cd ..
python runHalaqa.py
```

## Environment variables

Create `.env` in the project root:

```
GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/sa.json
SHEET_ID=1abcDEF...      # Google Sheet with commitments
SHEET_RANGE=Commitments!A:B
BANK_SCRAPER_PATH=./bankScraper/scraper.js
WA_GATEWAY_URL=http://localhost:3000/send
```

and another one inside `waGateway` (see sample) for the WhatsApp session path.

## Deployment

* **WhatsApp gateway** → `docker build -t wa-gateway . && docker run -d -p 3000:3000 wa-gateway`
* **Agent cron** → see `.github/workflows/monthly.yml` for a free GitHub Actions scheduler. 