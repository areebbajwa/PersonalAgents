# PersonalAgents

A LangGraph-based collection of agents for personal automation tasks.

**Current Agents:**
1. **Halaqa Agent**: Tracks monthly commitments and Interac e-Transfers, updating the "Transfers" worksheet in Google Sheets

## Project Structure

```
PersonalAgents/
├── agents/                # Agent implementations
│   └── halaqa_agent.py    # Halaqa fee and transfers tracking agent
├── tools/                 # Shared tools used by agents
│   ├── bank_tool.py       # Bank account access tools
│   ├── interac_scraper.py # Interac e-Transfer scraper
│   ├── sheets_tool.py     # Google Sheets integration
│   └── whatsapp_tool.py   # WhatsApp messaging (legacy)
├── wa_gateway/            # WhatsApp gateway service (legacy)
├── main.py                # Main entry point for all agents
└── run_halaqa.py          # Standalone runner for Halaqa agent
```

## Quick Start

```bash
# Python setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run the agent
python main.py halaqa
```

## Environment Variables

Create `.env` in the project root:

```
# Google Sheets
SHEET_ID=1abcDEF...      # Google Sheet with commitments/transfers
SHEET_RANGE=Commitments!A:G  # Sheet range for commitment data

# Bank Authentication
OPENAI_API_KEY=sk-...     # OpenAI API key
TD_USERNAME=yourUsername  # TD EasyWeb username
TD_PASSWORD=yourPassword  # TD EasyWeb password
```

You also need a Google API client_secret.json file in the project root for Google Sheets access.

## Google Sheets Setup

The agent requires two worksheets in the Google Sheet specified by SHEET_ID:

1. **Commitments**: Contains information about monthly commitments
   - Columns: Name (A), Commitment Amount (B), Phone (G)
   
2. **Transfers**: Will be created automatically if it doesn't exist
   - Columns: Date, Sender, Amount, Description

The agent will:
1. Check commitments in the Commitments worksheet
2. Fetch Interac e-Transfers from TD Bank
3. Compare commitments with transfers received
4. Update the Transfers worksheet with new transfers

## Deployment

* **Agent cron** → see `.github/workflows/monthly.yml` for a free GitHub Actions scheduler.

## Security Considerations

This project handles sensitive financial information. Make sure to:
- Never commit `.env` files, tokens, or credentials to version control
- Use environment variables for all sensitive information
- Consider using a secure credential manager for production use 