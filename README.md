# PersonalAgents

A LangGraph-based collection of agents for personal automation tasks, including financial data management.

**Current Agents & Capabilities:**
1.  **Halaqa Agent**: Tracks monthly commitments and Interac e-Transfers, updating the "Transfers" worksheet in Google Sheets.
2.  **Financial Data Processor**: Parses PDF bank statements, imports transactions from Google Sheets, categorizes transactions using AI, and stores them in a central SQLite database (`personal.db`).

## Project Structure

```
PersonalAgents/
├── config/.env            # Environment variable configuration
├── config/.devdbrc        # Database connection configuration for clients
├── README.md              # This README file
├── main.py                # Main entry point for agents
├── requirements.txt       # Python dependencies
├── package.json           # Node.js dependencies (for finance scripts)
├── config/client_secret.json     # Google API client secret (ensure gitignored)
├── config/token.json             # Google API token (ensure gitignored)
│
├── agents/                # Agent implementations
│   └── halaqa_agent.py    # Halaqa fee and transfers tracking agent
│
├── data/                  # Data storage
│   ├── personal.db        # SQLite database for transactions and AI cache
│   └── downloaded_statements/ # Directory for PDF bank statements
│
├── finances/              # Financial data processing and management
│   ├── config/            # Configuration for finance scripts
│   │   ├── serviceAccountKey.json # Google Service Account key (ensure gitignored)
│   │   └── spending_overrides.json  # Manual transaction categorization overrides
│   ├── scripts/           # Scripts for financial data processing
│   │   ├── import_google_sheet_transactions.py # Imports transactions from Google Sheets
│   │   ├── process_pdf_statements.js           # Parses PDF bank statements using AI
│   │   ├── categorize_db_transactions.py       # Categorizes transactions in the DB
│   │   ├── process_transactions.js             # AI-based transaction tagging (Gemini)
│   │   └── ai_cache_utils.js                   # Caching utilities for AI calls
│   ├── docs/                # Documentation related to finances (if any)
│   └── TODO.md              # TODO list specific to finances
│
├── scripts/               # General utility scripts
│
└── tools/                 # Shared tools used by agents
    ├── bank_tool.py       # Bank account access tools (verify current use)
    ├── interac_scraper.py # Interac e-Transfer scraper (verify current use)
    └── sheets_tool.py     # Google Sheets integration

```

## Quick Start

```bash
# Python setup (for core agents)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Node.js setup (for finance scripts)
# Ensure Node.js and npm are installed
npm install

# Run an agent (example)
python main.py halaqa

# Run finance scripts (examples from finances/scripts/)
# Ensure .env is configured with API keys (OpenAI, Gemini)
# Ensure finances/config/serviceAccountKey.json is in place for Google Sheets access by some scripts
node finances/scripts/process_pdf_statements.js
python finances/scripts/import_google_sheet_transactions.py --db data/personal.db
python finances/scripts/categorize_db_transactions.py
node finances/scripts/process_transactions.js
```

## Environment Variables

Create `config/.env` in the project root with the following content (replace placeholders):

```
# Google Sheets (primarily for Halaqa Agent, some finance scripts might use service account)
SHEET_ID=1abcDEF...      # Google Sheet ID
# SHEET_RANGE=Commitments!A:G # Example, specific to agent/script needs

# OpenAI API Key (for PDF parsing in finance scripts)
OPENAI_API_KEY=sk-...

# Gemini API Key (for transaction tagging in finance scripts)
GEMINI_API_KEY=your_gemini_api_key

# TD Bank Authentication (if bank_tool.py is actively used)
# TD_USERNAME=yourUsername
# TD_PASSWORD=yourPassword
```

You also need:
*   `config/client_secret.json` in the project root for user-based Google Sheets/Drive access by some tools.
*   `finances/config/serviceAccountKey.json` for service account-based Google API access used by finance scripts.

## Database

The project uses an SQLite database located at `data/personal.db`. This database stores:
*   Processed transactions from bank statements and Google Sheets.
*   AI model responses cached to avoid redundant API calls.

## Financial Data Processing

The scripts in `finances/scripts/` provide a pipeline for:
1.  **PDF Statement Parsing**: `process_pdf_statements.js` uses OpenAI's GPT models to extract transactions from PDF files in `data/downloaded_statements/` and stores them in `personal.db`. It utilizes a cache for AI responses.
2.  **Google Sheets Import**: `import_google_sheet_transactions.py` fetches transactions from a specified Google Sheet and imports them into `personal.db`.
3.  **Transaction Categorization (Rule-based & AI)**:
    *   `categorize_db_transactions.py` applies rule-based categorization and updates missing currency information.
    *   `process_transactions.js` uses Google's Gemini AI to tag transactions with categories, merchants, and relevant tags, storing these enrichments in `personal.db`.

## Google Sheets Setup (Halaqa Agent)

The Halaqa agent requires two worksheets in the Google Sheet specified by `SHEET_ID`:

1.  **Commitments**: Contains information about monthly commitments.
    *   Columns: Name (A), Commitment Amount (B), Phone (G) (Verify current column usage)
   
2.  **Transfers**: Will be created/updated by the agent.
    *   Columns: Date, Sender, Amount, Description (Verify current column usage)

The Halaqa agent (if still primary focus, or describe its interaction with new finance system):
1.  Checks commitments in the Commitments worksheet.
2.  May fetch Interac e-Transfers (verify if `interac_scraper.py` and `bank_tool.py` are still the method).
3.  Compares commitments with transfers.
4.  Updates the Transfers worksheet.

## Deployment

*   **Agent cron** → see `.github/workflows/monthly.yml` for a GitHub Actions scheduler.

## Security Considerations

This project handles sensitive financial information. Make sure to:
- Never commit `config/.env` files, tokens, `config/client_secret.json`, or `finances/config/serviceAccountKey.json` to version control. Add them to `.gitignore`.
- Use environment variables for all sensitive information.
- Consider using a secure credential manager for production use. 